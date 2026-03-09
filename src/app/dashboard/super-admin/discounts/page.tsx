import { SuperAdminDiscountsPanel } from "@/components/dashboard/super-admin-discounts-panel";
import { requireSuperAdmin } from "../require-super-admin";

export default async function SuperAdminDiscountsPage() {
  await requireSuperAdmin();

  return <SuperAdminDiscountsPanel />;
}
