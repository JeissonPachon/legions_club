import { redirect } from "next/navigation";
import { getAuthContext, type AuthContext } from "@/lib/auth/server";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/http/responses";

export async function requireSuperAdminApi(
  forbiddenMessage = "Only super admins can access this resource",
): Promise<AuthContext | Response> {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  if (!auth.isSuperAdmin) {
    return forbiddenResponse(forbiddenMessage);
  }

  return auth;
}

export async function requireSuperAdminPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect("/auth/login");
  }

  if (!auth.isSuperAdmin) {
    redirect("/dashboard/gym");
  }
}
