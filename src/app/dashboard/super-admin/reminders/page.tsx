import { RemindersPanel } from "@/components/dashboard/reminders-panel";
import { requireSuperAdmin } from "../require-super-admin";

export default async function SuperAdminRemindersPage() {
  await requireSuperAdmin();

  return <RemindersPanel allowAllTenants />;
}
