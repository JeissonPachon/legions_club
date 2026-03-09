import { redirect } from "next/navigation";
import { UserPanel } from "@/components/dashboard/user-panel";
import { getAuthContext } from "@/lib/auth/server";

export default async function UserDashboardPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect("/auth/login");
  }

  if (auth.role !== "athlete") {
    redirect("/dashboard");
  }

  return <UserPanel />;
}
