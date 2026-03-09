import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/modules/super-admin/auth";
import { getSuperAdminBillingSummary } from "@/modules/super-admin/billing";

export async function GET() {
  const auth = await requireSuperAdminApi("Only super admins can view SaaS billing");
  if (auth instanceof Response) {
    return auth;
  }

  const summary = await getSuperAdminBillingSummary();
  return NextResponse.json(summary);
}
