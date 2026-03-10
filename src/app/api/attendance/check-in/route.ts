import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/http/responses";
import { isStaffRole } from "@/modules/auth/roles";

const checkInSchema = z.object({
  memberId: z.string().uuid().optional(),
  qrPayload: z.string().min(8).optional(),
  idempotencyKey: z.string().min(10).optional(),
  notes: z.string().optional(),
}).refine((value) => Boolean(value.memberId || value.qrPayload), {
  message: "memberId or qrPayload is required",
});

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveMemberId(parsed: z.infer<typeof checkInSchema>): string | null {
  if (parsed.memberId && uuidRegex.test(parsed.memberId)) {
    return parsed.memberId;
  }

  if (!parsed.qrPayload) {
    return null;
  }

  const raw = parsed.qrPayload.trim();
  if (uuidRegex.test(raw)) {
    return raw;
  }

  if (raw.startsWith("http")) {
    try {
      const url = new URL(raw);
      const fromQuery = url.searchParams.get("memberId");
      if (fromQuery && uuidRegex.test(fromQuery)) {
        return fromQuery;
      }
    } catch {
      return null;
    }
  }

  try {
    const asJson = JSON.parse(raw) as { memberId?: string };
    if (asJson.memberId && uuidRegex.test(asJson.memberId)) {
      return asJson.memberId;
    }
  } catch {
    return null;
  }

  return null;
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }
  if (!isStaffRole(auth.role)) {
    return forbiddenResponse();
  }

  const body = await request.json().catch(() => null);
  const parsed = checkInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid check-in payload" }, { status: 400 });
  }

  const memberId = resolveMemberId(parsed.data);
  if (!memberId) {
    return NextResponse.json({ message: "Invalid QR payload or memberId" }, { status: 400 });
  }

  const idempotencyKey = parsed.data.idempotencyKey ?? randomUUID();

  const existingEvent = await db.attendanceEvent.findFirst({
    where: {
      tenantId: auth.tenantId,
      idempotencyKey,
    },
  });

  if (existingEvent) {
    return NextResponse.json({ ok: true, event: existingEvent, idempotent: true });
  }

  const subscription = await db.subscription.findFirst({
    where: {
      tenantId: auth.tenantId,
      memberId,
      status: "active",
      endDate: { gte: new Date() },
      sessionsRemaining: { gt: 0 },
    },
    orderBy: { endDate: "asc" },
  });

  if (!subscription) {
    return NextResponse.json({ message: "No active subscription with available sessions" }, { status: 400 });
  }

  const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const remainingBefore = subscription.sessionsRemaining;
    const remainingAfter = remainingBefore - 1;

    const updatedSubscription = await tx.subscription.update({
      where: { id: subscription.id },
      data: { sessionsRemaining: remainingAfter },
    });

    const event = await tx.attendanceEvent.create({
      data: {
        tenantId: auth.tenantId,
        memberId: subscription.memberId,
        subscriptionId: subscription.id,
        eventType: "check_in",
        deltaSessions: -1,
        remainingBefore,
        remainingAfter,
        idempotencyKey,
        performedByUserId: auth.userId,
        notes: parsed.data.notes,
      },
    });

    return { updatedSubscription, event };
  });

  return NextResponse.json({ ok: true, ...result }, { status: 201 });
}