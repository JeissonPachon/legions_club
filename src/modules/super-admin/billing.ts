import dayjs from "dayjs";
import { getSaasMonthlyFeeSnapshot } from "@/lib/billing/monthly-fee";
import { getTenantBillingDates, getOverdueDays } from "@/lib/billing/saas";
import { db } from "@/lib/db";

type BillingStatus = "upcoming" | "paid" | "overdue";

export type SuperAdminBillingTenantRow = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantStatus: "active" | "suspended" | "archived";
  ownerName: string | null;
  ownerEmail: string | null;
  createdAt: Date;
  firstDueAt: Date;
  currentDueAt: Date | null;
  nextDueAt: Date;
  amountCents: number;
  billingStatus: BillingStatus;
  paidThisCycle: boolean;
  overdueDays: number;
  lastReminderAt: Date | null;
};

export type SuperAdminBillingSummaryPayload = {
  monthlyFeeCents: number;
  monthlyFeeEffectiveFrom: string | null;
  nextMonthlyFeeCents: number | null;
  nextMonthlyFeeEffectiveFrom: string | null;
  projectedMrrCents: number;
  collectedThisMonthCents: number;
  overdueTenants: number;
  suspendedTenants: number;
  tenants: SuperAdminBillingTenantRow[];
};

export async function getSuperAdminBillingSummary(now: Date = new Date()): Promise<SuperAdminBillingSummaryPayload> {
  const feeSnapshot = await getSaasMonthlyFeeSnapshot(now);
  const monthlyFeeCents = feeSnapshot.currentFeeCents;

  const tenants = await db.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: {
        where: {
          role: "owner",
          isActive: true,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
        },
        take: 1,
      },
    },
    take: 250,
  });

  const tenantRows = await Promise.all(
    tenants.map(async (tenant) => {
      const dates = getTenantBillingDates(tenant.createdAt, now);

      const paidThisCycle = dates.currentDueAt
        ? (await db.auditLog.count({
            where: {
              tenantId: tenant.id,
              action: "saas_monthly_payment_registered",
              createdAt: {
                gte: dates.currentDueAt,
                lt: dates.nextDueAt,
              },
            },
          })) > 0
        : false;

      const overdueDays = getOverdueDays(dates.currentDueAt, paidThisCycle, now);
      const status: BillingStatus = !dates.currentDueAt
        ? "upcoming"
        : paidThisCycle
          ? "paid"
          : overdueDays > 0
            ? "overdue"
            : "upcoming";

      const lastReminder = await db.auditLog.findFirst({
        where: {
          tenantId: tenant.id,
          action: "saas_monthly_reminder_sent",
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      return {
        tenantId: tenant.id,
        tenantName: tenant.displayName,
        tenantSlug: tenant.slug,
        tenantStatus: tenant.status,
        ownerName: tenant.users[0]?.fullName ?? null,
        ownerEmail: tenant.users[0]?.email ?? null,
        createdAt: tenant.createdAt,
        firstDueAt: dates.firstDueAt,
        currentDueAt: dates.currentDueAt,
        nextDueAt: dates.nextDueAt,
        amountCents: monthlyFeeCents,
        billingStatus: status,
        paidThisCycle,
        overdueDays,
        lastReminderAt: lastReminder?.createdAt ?? null,
      } satisfies SuperAdminBillingTenantRow;
    }),
  );

  const cycleStart = dayjs(now).startOf("month").toDate();
  const cycleEnd = dayjs(now).endOf("month").toDate();

  const paymentsThisMonth = await db.auditLog.findMany({
    where: {
      action: "saas_monthly_payment_registered",
      createdAt: {
        gte: cycleStart,
        lte: cycleEnd,
      },
    },
    select: {
      metadataJson: true,
    },
  });

  let collectedCents = 0;
  for (const payment of paymentsThisMonth) {
    const metadata = payment.metadataJson as { amountCents?: number } | null;
    if (typeof metadata?.amountCents === "number") {
      collectedCents += metadata.amountCents;
    } else {
      collectedCents += monthlyFeeCents;
    }
  }

  const projectedMrrCents = tenantRows.filter((tenant) => tenant.tenantStatus === "active").length * monthlyFeeCents;

  return {
    monthlyFeeCents,
    monthlyFeeEffectiveFrom: feeSnapshot.currentEffectiveFrom,
    nextMonthlyFeeCents: feeSnapshot.nextFeeCents,
    nextMonthlyFeeEffectiveFrom: feeSnapshot.nextEffectiveFrom,
    projectedMrrCents,
    collectedThisMonthCents: collectedCents,
    overdueTenants: tenantRows.filter((tenant) => tenant.overdueDays > 0).length,
    suspendedTenants: tenantRows.filter((tenant) => tenant.tenantStatus === "suspended").length,
    tenants: tenantRows,
  };
}
