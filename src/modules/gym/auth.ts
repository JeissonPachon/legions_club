import { getAuthContext, type AuthContext } from "@/lib/auth/server";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/http/responses";
import { canManageGym } from "@/modules/auth/roles";

type GymGuardOptions = {
  allowSuperAdmin?: boolean;
  forbiddenMessage?: string;
};

export async function requireGymManagementApi(
  options: GymGuardOptions = {},
): Promise<AuthContext | Response> {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  if (options.allowSuperAdmin && auth.isSuperAdmin) {
    return auth;
  }

  if (!canManageGym(auth.role)) {
    return forbiddenResponse(options.forbiddenMessage ?? "Forbidden");
  }

  return auth;
}
