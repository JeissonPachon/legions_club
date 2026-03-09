import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/modules/super-admin/auth";
import { getSuperAdminOverview } from "@/modules/super-admin/overview";

export async function GET() {
  const auth = await requireSuperAdminApi("Only super admins can view SaaS overview");
  if (auth instanceof Response) {
    return auth;
  }

  const overview = await getSuperAdminOverview();
  return NextResponse.json(overview);
}
