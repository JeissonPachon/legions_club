import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { clearAuthCookie } from "@/lib/auth/cookies";

export async function POST() {
  const auth = await getAuthContext();

  if (auth) {
    await db.session.updateMany({
      where: {
        id: auth.sessionId,
        tenantId: auth.tenantId,
      },
      data: { revokedAt: new Date() },
    });
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookie(response);
  return response;
}