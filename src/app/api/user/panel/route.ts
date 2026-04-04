import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/http/responses";
import { hashPII } from "@/lib/security/crypto";

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== "athlete") {
    return forbiddenResponse("Only athletes can access this panel");
  }

  const member = await db.member.findFirst({
    where: {
      tenantId: auth.tenantId,
      emailHash: hashPII(auth.email),
      deletedAt: null,
      isActive: true,
    },
    select: {
      id: true,
      fullName: true,
      documentLast4: true,
    },
  });

  if (!member) {
    return NextResponse.json({
      hasMember: false,
      message: "No athlete profile linked to this account yet",
    });
  }

  const subscription = await db.subscription.findFirst({
    where: {
      tenantId: auth.tenantId,
      memberId: member.id,
      status: "active",
      endDate: { gte: new Date() },
    },
    include: {
      plan: {
        select: {
          name: true,
          sessionsPerMonth: true,
        },
      },
    },
    orderBy: { endDate: "asc" },
  });

  const qrPayload = JSON.stringify({
    type: "legions-member-checkin",
    tenantId: auth.tenantId,
    memberId: member.id,
    userId: auth.userId,
  });

  // obtener nombre del gym (tenant)
  const tenant = await db.tenant.findUnique({ where: { id: auth.tenantId }, select: { displayName: true } });

  return NextResponse.json({
    hasMember: true,
    member,
    qrPayload,
    subscription: subscription
      ? {
          planName: subscription.plan.name,
          sessionsRemaining: subscription.sessionsRemaining,
          sessionsAssigned: subscription.sessionsAssigned,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
        }
      : null,
    gymName: tenant?.displayName ?? null,
  });
}
