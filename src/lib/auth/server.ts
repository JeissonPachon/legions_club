import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";
import { verifySessionJwt } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export type AuthContext = {
  userId: string;
  sessionId: string;
  tenantId: string;
  role: "owner" | "manager" | "coach" | "athlete";
  email: string;
  fullName: string;
  isSuperAdmin: boolean;
};

function isSuperAdminEmail(email: string) {
  if (!env.SUPER_ADMIN_EMAILS) {
    return false;
  }

  const superAdminEmails = env.SUPER_ADMIN_EMAILS.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  return superAdminEmails.includes(email.toLowerCase());
}

export async function getAuthContext(): Promise<AuthContext | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      return null;
    }

    const claims = await verifySessionJwt(token);

    const session = await db.session.findUnique({
      where: { id: claims.sid },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return null;
    }

    if (!session.user.isActive || session.user.tenantId !== claims.tenantId) {
      return null;
    }

    return {
      userId: claims.sub,
      sessionId: claims.sid,
      tenantId: claims.tenantId,
      role: claims.role,
      email: claims.email,
      fullName: claims.fullName,
      isSuperAdmin: isSuperAdminEmail(claims.email),
    };
  } catch {
    return null;
  }
}