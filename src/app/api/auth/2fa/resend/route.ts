import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { generateTwoFactorCode, hashTwoFactorCode } from "@/lib/auth/two-factor";
import { sendTwoFactorEmail } from "@/lib/email/send-two-factor-email";
import { checkRateLimit, getRequestIp } from "@/lib/security/rate-limit";

const resendSchema = z.object({
  challengeId: z.string().uuid(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = resendSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid challenge" }, { status: 400 });
  }

  const requestIp = getRequestIp(request);
  const resendLimit = await checkRateLimit(
    { keyPrefix: "auth-2fa-resend", limit: 5, window: "10 m" },
    `${parsed.data.challengeId}:${requestIp}`,
  );

  if (!resendLimit.allowed) {
    return NextResponse.json(
      { message: "Too many resend attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(resendLimit.retryAfterSeconds) },
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
          isActive: true,
        },
      },
    },
  });

  if (!challenge || challenge.purpose !== "login") {
    return NextResponse.json({ message: "Challenge not found" }, { status: 404 });
  }

  if (challenge.consumedAt) {
    return NextResponse.json({ message: "Challenge already used. Please login again." }, { status: 400 });
  }

  if (!challenge.user?.isActive) {
    return NextResponse.json({ message: "User is inactive" }, { status: 403 });
  }

  const code = generateTwoFactorCode();
  const expiresAt = new Date(Date.now() + env.AUTH_2FA_TTL_MINUTES * 60_000);

  await db.twoFactorChallenge.update({
    where: { id: challenge.id },
    data: {
      codeHash: hashTwoFactorCode(code),
      expiresAt,
      attemptCount: 0,
    },
  });

  try {
    await sendTwoFactorEmail(challenge.user.email, code);
  } catch {
    return NextResponse.json({ message: "Unable to send verification code" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    challengeId: challenge.id,
    expiresAt: expiresAt.toISOString(),
    message: "Verification code resent",
  });
}
