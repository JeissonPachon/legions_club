import { AppShell } from "@/components/layout/app-shell";
import { getAuthContext } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthContext();

  if (!auth) {
    redirect("/auth/login");
  }

  const mode = auth.isSuperAdmin ? "super-admin" : auth.role === "athlete" ? "user" : "gym";
  const tenant = await db.tenant.findUnique({
    where: { id: auth.tenantId },
    select: { slug: true },
  });

  return <AppShell mode={mode} tenantSlug={tenant?.slug} role={auth.role}>{children}</AppShell>;
}