import { SuperAdminTenantForm } from "@/components/dashboard/super-admin-tenant-form";
import { requireSuperAdmin } from "../require-super-admin";

export default async function SuperAdminTenantsPage() {
  await requireSuperAdmin();

  return <SuperAdminTenantForm />;
}
