import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashTwoFactorCode } from "@/lib/auth/two-factor";
import { createSessionToken, hashSessionToken, signSessionJwt } from "@/lib/auth/session";
import { setAuthCookie } from "@/lib/auth/cookies";
import { env } from "@/lib/env";
import { hashPII } from "@/lib/security/crypto";
import { checkRateLimit, getRequestIp } from "@/lib/security/rate-limit";

const verifySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().length(6),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = verifySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid verification code" }, { status: 400 });
  }

  const requestIp = getRequestIp(request);
  const ipLimit = await checkRateLimit(
    { keyPrefix: "auth-2fa-ip", limit: 25, window: "5 m" },
    requestIp,
  );

  if (!ipLimit.allowed) {
    return NextResponse.json(
      { message: "Too many verification attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
      },
    );
  }

  const challengeLimit = await checkRateLimit(
    { keyPrefix: "auth-2fa-challenge", limit: 10, window: "10 m" },
    `${parsed.data.challengeId}:${requestIp}`,
  );

  if (!challengeLimit.allowed) {
    return NextResponse.json(
      { message: "Too many verification attempts for this challenge." },
      {
        status: 429,
        headers: { "Retry-After": String(challengeLimit.retryAfterSeconds) },
      },
    );
  }

  const challenge = await db.twoFactorChallenge.findUnique({
    where: { id: parsed.data.challengeId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          fullName: true,
          isActive: true,
          tenantId: true,
        },
      },
    },
  });

  if (!challenge || challenge.purpose !== "login") {
    return NextResponse.json({ message: "Challenge not found" }, { status: 404 });
  }

  if (challenge.consumedAt || challenge.expiresAt < new Date()) {
    return NextResponse.json({ message: "Challenge expired" }, { status: 400 });
  }

  if (challenge.attemptCount >= 5) {
    return NextResponse.json({ message: "Challenge blocked" }, { status: 429 });
  }

  const validCode = challenge.codeHash === hashTwoFactorCode(parsed.data.code);
  if (!validCode) {
    await db.twoFactorChallenge.update({
      where: { id: challenge.id },
      data: { attemptCount: { increment: 1 } },
    });
    return NextResponse.json({ message: "Invalid verification code" }, { status: 400 });
  }

  const rawSessionToken = createSessionToken();
  const expiresAt = new Date(Date.now() + env.AUTH_SESSION_DAYS * 24 * 60 * 60 * 1000);

  const session = await db.session.create({
    data: {
      tenantId: challenge.tenantId,
      userId: challenge.userId,
      sessionTokenHash: hashSessionToken(rawSessionToken),
      ipHash: hashPII(request.headers.get("x-forwarded-for") ?? "local"),
      userAgent: request.headers.get("user-agent") ?? "unknown",
      expiresAt,
    },
  });

  await db.$transaction([
    db.twoFactorChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    }),
    db.user.update({
      where: { id: challenge.userId },
      data: { lastLoginAt: new Date() },
    }),
  ]);

  const jwt = await signSessionJwt({
    sub: challenge.userId,
    sid: session.id,
    tenantId: challenge.tenantId,
    role: challenge.user.role,
    email: challenge.user.email,
    fullName: challenge.user.fullName,
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      id: challenge.user.id,
      fullName: challenge.user.fullName,
      email: challenge.user.email,
      role: challenge.user.role,
    },
  });

  setAuthCookie(response, jwt);
  return response;
}