import dayjs from "dayjs";
import { db } from "@/lib/db";

export type SuperAdminOverviewPayload = {
  tenantsTotal: number;
  activeTenants: number;
  suspendedTenants: number;
  archivedTenants: number;
  collectedThisMonthCents: number;
};

export async function getSuperAdminOverview(): Promise<SuperAdminOverviewPayload> {
  const monthStart = dayjs().startOf("month").toDate();
  const monthEnd = dayjs().endOf("month").toDate();
  const tenantWhere = { slug: { not: "platform-admin" } };

  const [tenantsTotal, activeTenants, suspendedTenants, archivedTenants, monthlyPayments] = await Promise.all([
    db.tenant.count({ where: tenantWhere }),
    db.tenant.count({ where: { ...tenantWhere, status: "active" } }),
    db.tenant.count({ where: { ...tenantWhere, status: "suspended" } }),
    db.tenant.count({ where: { ...tenantWhere, status: "archived" } }),
    db.auditLog.findMany({
      where: {
        action: "saas_monthly_payment_registered",
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      select: {
        metadataJson: true,
      },
    }),
  ]);

  let collectedThisMonthCents = 0;
  for (const payment of monthlyPayments) {
    const metadata = payment.metadataJson as { amountCents?: number } | null;
    if (typeof metadata?.amountCents === "number" && metadata.amountCents > 0) {
      collectedThisMonthCents += metadata.amountCents;
    }
  }

  return {
    tenantsTotal,
    activeTenants,
    suspendedTenants,
    archivedTenants,
    collectedThisMonthCents,
  };
}
