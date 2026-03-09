import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/server";

export default async function DashboardPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect("/auth/login");
  }

  if (auth.isSuperAdmin) {
    redirect("/dashboard/super-admin");
  }

  if (auth.role === "athlete") {
    redirect("/dashboard/user");
  }

  redirect("/dashboard/gym");
}