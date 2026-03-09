import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { unauthorizedResponse } from "@/lib/http/responses";

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  return NextResponse.json({
    user: {
      id: auth.userId,
      fullName: auth.fullName,
      email: auth.email,
      role: auth.role,
      tenantId: auth.tenantId,
      isSuperAdmin: auth.isSuperAdmin,
    },
  });
}