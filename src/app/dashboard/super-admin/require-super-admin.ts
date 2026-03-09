import { requireSuperAdminPage } from "@/modules/super-admin/auth";

export async function requireSuperAdmin() {
  await requireSuperAdminPage();
}
