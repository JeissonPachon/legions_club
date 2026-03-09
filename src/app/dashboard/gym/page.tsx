import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { GymFinancePanel } from "@/components/dashboard/gym-finance-panel";
import { RemindersPanel } from "@/components/dashboard/reminders-panel";
import { SystemStatus } from "@/components/dashboard/system-status";
import { getAuthContext } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { canManageGym } from "@/modules/auth/roles";
import { redirect } from "next/navigation";

export default async function GymDashboardPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect("/auth/login");
  }

  if (auth.isSuperAdmin || auth.role === "athlete") {
    redirect("/dashboard");
  }

  const tenant = await db.tenant.findUnique({
    where: { id: auth.tenantId },
    select: { slug: true },
  });

  const titleLabel = tenant?.slug ? tenant.slug.toUpperCase() : "GYM";

  return (
    <div className="space-y-5">
      <DashboardOverview titleLabel={titleLabel} />
      {canManageGym(auth.role) ? (
        <>
          <SystemStatus />
          <RemindersPanel allowAllTenants={false} />
          <GymFinancePanel />
        </>
      ) : null}
    </div>
  );
}
