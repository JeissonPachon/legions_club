import { SuperAdminFinancePanel } from "@/components/dashboard/super-admin-finance-panel";
import { requireSuperAdmin } from "../require-super-admin";

export default async function SuperAdminFinancePage() {
  await requireSuperAdmin();

  return <SuperAdminFinancePanel />;
}
