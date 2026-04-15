import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireGymManagementApi } from "@/modules/gym/auth";

const createSubscriptionSchema = z.object({
  memberId: z.string().uuid(),
  planId: z.string().uuid(),
  startDate: z.string().datetime().optional(),
});

const updateSubscriptionStatusSchema = z.object({
  subscriptionId: z.string().uuid(),
  isActive: z.boolean(),
  reason: z.string().min(3).max(220).optional(),
});

const subscriptionStatusSchema = z.enum(["active", "paused", "canceled", "expired"]);

export async function GET(request: Request) {
  const auth = await requireGymManagementApi();
  if (auth instanceof Response) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId") ?? undefined;
  const month = searchParams.get("month") ?? undefined;
  const statusRaw = searchParams.get("status");

  const statusParsed = statusRaw ? subscriptionStatusSchema.safeParse(statusRaw) : null;
  if (statusRaw && !statusParsed?.success) {
    return NextResponse.json({ message: "Estado invalido" }, { status: 400 });
  }

  const monthStart = month ? dayjs(`${month}-01`).startOf("month") : null;
  const monthEnd = month ? dayjs(`${month}-01`).endOf("month") : null;

  if (month && (!monthStart?.isValid() || !monthEnd?.isValid())) {
    return NextResponse.json({ message: "Mes invalido. Usa formato YYYY-MM" }, { status: 400 });
  }

  const subscriptions = await db.subscription.findMany({
    where: {
      tenantId: auth.tenantId,
      ...(memberId ? { memberId } : {}),
      ...(statusParsed?.success ? { status: statusParsed.data } : {}),
      ...(monthStart && monthEnd
        ? {
            startDate: {
              gte: monthStart.toDate(),
              lte: monthEnd.toDate(),
            },
          }
        : {}),
    },
    include: {
      member: { select: { id: true, fullName: true, documentLast4: true } },
      plan: { select: { id: true, name: true, sessionsPerMonth: true, priceCents: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ subscriptions });
}

export async function POST(request: Request) {
  const auth = await requireGymManagementApi();
  if (auth instanceof Response) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  const parsed = createSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid subscription payload" }, { status: 400 });
  }

  const [member, plan] = await Promise.all([
    db.member.findFirst({
      where: {
        id: parsed.data.memberId,
        tenantId: auth.tenantId,
        deletedAt: null,
        isActive: true,
      },
    }),
    db.plan.findFirst({
      where: {
        id: parsed.data.planId,
        tenantId: auth.tenantId,
        isActive: true,
      },
    }),
  ]);

  if (!member || !plan) {
    return NextResponse.json({ message: "Member or plan not found" }, { status: 404 });
  }

  const startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : new Date();
  const endDate = dayjs(startDate).add(plan.durationDays, "day").toDate();

  const subscription = await db.$transaction(async (tx: any) => {
    const createdSubscription = await tx.subscription.create({
      data: {
        tenantId: auth.tenantId,
        memberId: member.id,
        planId: plan.id,
        sessionsAssigned: plan.sessionsPerMonth,
        sessionsRemaining: plan.sessionsPerMonth,
        startDate,
        endDate,
        createdByUserId: auth.userId,
        status: "active",
      },
    });

    // Mirror membership sale into finance logs so gym cashflow stays linked to subscriptions.
    await tx.auditLog.create({
      data: {
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        action: "finance_income",
        entityType: "subscription",
        entityId: createdSubscription.id,
        metadataJson: {
          entryType: "income",
          amountCents: plan.priceCents,
          category: "membership",
          note: `Ingreso por membresia: ${plan.name}`,
          occurredAt: startDate.toISOString(),
          source: "subscription",
          subscriptionId: createdSubscription.id,
          memberId: member.id,
          memberName: member.fullName,
          planId: plan.id,
          planName: plan.name,
        },
      },
    });

    return createdSubscription;
  });

  return NextResponse.json({ subscription }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireGymManagementApi();
  if (auth instanceof Response) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSubscriptionStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid status update payload" }, { status: 400 });
  }

  const subscription = await db.subscription.findFirst({
    where: {
      id: parsed.data.subscriptionId,
      tenantId: auth.tenantId,
    },
    select: {
      id: true,
      status: true,
      endDate: true,
      canceledAt: true,
      cancelReason: true,
      memberId: true,
      planId: true,
    },
  });

  if (!subscription) {
    return NextResponse.json({ message: "Subscription not found" }, { status: 404 });
  }

  const targetStatus = parsed.data.isActive ? "active" : "canceled";
  if (subscription.status === targetStatus) {
    return NextResponse.json({ ok: true, subscription });
  }

  if (parsed.data.isActive && subscription.endDate < new Date()) {
    return NextResponse.json(
      { message: "No se puede reactivar una suscripcion vencida. Crea una nueva suscripcion." },
      { status: 409 },
    );
  }

  const cancelReason = parsed.data.reason?.trim() || "Cambio manual desde panel de suscripciones";

  const updated = await db.$transaction(async (tx: any) => {
    const next = await tx.subscription.update({
      where: { id: subscription.id },
      data: parsed.data.isActive
        ? {
            status: "active",
            canceledAt: null,
            cancelReason: null,
          }
        : {
            status: "canceled",
            canceledAt: new Date(),
            cancelReason,
          },
      select: {
        id: true,
        status: true,
        canceledAt: true,
        cancelReason: true,
        endDate: true,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        action: "subscription_status_updated",
        entityType: "subscription",
        entityId: subscription.id,
        metadataJson: {
          previousStatus: subscription.status,
          nextStatus: next.status,
          reason: cancelReason,
          memberId: subscription.memberId,
          planId: subscription.planId,
        },
      },
    });

    return next;
  });

  return NextResponse.json({ ok: true, subscription: updated });
}