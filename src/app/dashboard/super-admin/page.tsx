import { SuperAdminOverview } from "@/components/dashboard/super-admin-overview";
import { requireSuperAdmin } from "./require-super-admin";

export default async function SuperAdminPage() {
  await requireSuperAdmin();

  return (
    <SuperAdminOverview />
  );
}
