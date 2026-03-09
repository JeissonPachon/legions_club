import { SignJWT, jwtVerify } from "jose";
import { randomUUID, createHash } from "crypto";
import { env } from "@/lib/env";

const authSecret = new TextEncoder().encode(env.AUTH_JWT_SECRET);

export type SessionClaims = {
  sub: string;
  sid: string;
  tenantId: string;
  role: "owner" | "manager" | "coach" | "athlete";
  email: string;
  fullName: string;
};

export function createSessionToken() {
  return randomUUID();
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function signSessionJwt(claims: SessionClaims) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${env.AUTH_SESSION_DAYS}d`)
    .sign(authSecret);
}

export async function verifySessionJwt(token: string) {
  const { payload } = await jwtVerify(token, authSecret);
  return payload as unknown as SessionClaims;
}