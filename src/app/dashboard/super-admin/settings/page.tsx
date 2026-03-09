import { SuperAdminSettingsPanel } from "@/components/dashboard/super-admin-settings-panel";
import { requireSuperAdmin } from "../require-super-admin";

export default async function SuperAdminSettingsPage() {
  await requireSuperAdmin();

  return <SuperAdminSettingsPanel />;
}
