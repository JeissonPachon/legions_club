import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireGymManagementApi } from "@/modules/gym/auth";
import type { Prisma } from "@prisma/client";

const updateFinanceEntrySchema = z
  .object({
    entryType: z.enum(["income", "expense"]).optional(),
    amountCents: z.number().int().positive().optional(),
    category: z.string().min(2).max(50).optional(),
    note: z.string().max(250).nullable().optional(),
    occurredAt: z.string().datetime().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

function isFinanceAction(action: string) {
  return action === "finance_income" || action === "finance_expense";
}

function asMutableMetadata(metadataJson: unknown): Record<string, unknown> {
  if (!metadataJson || typeof metadataJson !== "object" || Array.isArray(metadataJson)) {
    return {};
  }

  return { ...(metadataJson as Record<string, unknown>) };
}

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireGymManagementApi({ forbiddenMessage: "Only staff can edit finance entries" });
  if (auth instanceof Response) {
    return auth;
  }

  const { entryId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateFinanceEntrySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid finance update payload" }, { status: 400 });
  }

  const current = await db.auditLog.findFirst({
    where: {
      id: entryId,
      tenantId: auth.tenantId,
    },
    select: {
      id: true,
      action: true,
      metadataJson: true,
    },
  });

  if (!current || !isFinanceAction(current.action)) {
    return NextResponse.json({ message: "Movimiento financiero no encontrado" }, { status: 404 });
  }

  const metadata = asMutableMetadata(current.metadataJson);
  const nextEntryType = parsed.data.entryType ?? (current.action === "finance_income" ? "income" : "expense");

  if (parsed.data.amountCents !== undefined) {
    metadata.amountCents = parsed.data.amountCents;
  }

  if (parsed.data.category !== undefined) {
    metadata.category = parsed.data.category;
  }

  if (parsed.data.note !== undefined) {
    metadata.note = parsed.data.note;
  }

  if (parsed.data.occurredAt !== undefined) {
    metadata.occurredAt = new Date(parsed.data.occurredAt).toISOString();
  }

  metadata.entryType = nextEntryType;

  await db.auditLog.update({
    where: { id: current.id },
    data: {
      action: nextEntryType === "income" ? "finance_income" : "finance_expense",
      metadataJson: metadata as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireGymManagementApi({ forbiddenMessage: "Only staff can delete finance entries" });
  if (auth instanceof Response) {
    return auth;
  }

  const { entryId } = await context.params;

  const current = await db.auditLog.findFirst({
    where: {
      id: entryId,
      tenantId: auth.tenantId,
    },
    select: {
      id: true,
      action: true,
    },
  });

  if (!current || !isFinanceAction(current.action)) {
    return NextResponse.json({ message: "Movimiento financiero no encontrado" }, { status: 404 });
  }

  await db.auditLog.delete({ where: { id: current.id } });

  return NextResponse.json({ ok: true });
}
