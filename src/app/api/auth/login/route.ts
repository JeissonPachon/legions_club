import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { generateTwoFactorCode, hashTwoFactorCode } from "@/lib/auth/two-factor";
import { env } from "@/lib/env";
import { sendTwoFactorEmail } from "@/lib/email/send-two-factor-email";
import { checkRateLimit, getRequestIp } from "@/lib/security/rate-limit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
});

function isSuperAdminEmail(email: string) {
  if (!env.SUPER_ADMIN_EMAILS) {
    return false;
  }

  return env.SUPER_ADMIN_EMAILS.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0)
    .includes(email.toLowerCase());
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 400 });
    }

    const { email, password, tenantSlug } = parsed.data;
    const requestIp = getRequestIp(request);

    const ipLimit = await checkRateLimit(
      { keyPrefix: "auth-login-ip", limit: 20, window: "1 m" },
      requestIp,
    );
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { message: "Too many login attempts. Try again in a moment." },
        {
          status: 429,
          headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
        },
      );
    }

    const emailLimit = await checkRateLimit(
      { keyPrefix: "auth-login-email", limit: 8, window: "10 m" },
      `${email.toLowerCase()}:${requestIp}`,
    );
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { message: "Too many login attempts for this account. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(emailLimit.retryAfterSeconds) },
        },
      );
    }

    const users = await db.user.findMany({
      where: {
        email: email.toLowerCase(),
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        tenantId: true,
        isActive: true,
        tenant: {
          select: {
            id: true,
            slug: true,
            displayName: true,
            status: true,
          },
        },
      },
    });

    const isDevelopment = process.env.NODE_ENV === "development";

    if (users.length === 0) {
      return NextResponse.json(
        {
          message: isDevelopment
            ? "No existe un usuario activo para este correo."
            : "Invalid credentials",
        },
        { status: 401 },
      );
    }

    if (users.length > 1 && !tenantSlug) {
      return NextResponse.json(
        {
          message: "Multiple accounts found",
          tenants: users.map((u) => ({ slug: u.tenant.slug, displayName: u.tenant.displayName })),
          requiresTenantSelection: true,
        },
        { status: 409 },
      );
    }

    const user = tenantSlug
      ? users.find((candidate) => candidate.tenant.slug === tenantSlug.toLowerCase())
      : users[0];

    if (!user) {
      return NextResponse.json(
        {
          message: isDevelopment
            ? "El tenant seleccionado no coincide con el usuario."
            : "Invalid credentials",
        },
        { status: 401 },
      );
    }

    const tenant = user.tenant;
    const isSuperAdmin = isSuperAdminEmail(user.email);

    if (!user || !user.isActive) {
      return NextResponse.json(
        {
          message: isDevelopment ? "El usuario esta inactivo." : "Invalid credentials",
        },
        { status: 401 },
      );
    }

    if (user.tenant.status !== "active" && !isSuperAdmin) {
      return NextResponse.json(
        {
          message:
            "Tu gimnasio esta suspendido o inactivo. Contacta al administrador para reactivarlo.",
        },
        { status: 403 },
      );
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        {
          message: isDevelopment ? "Contrasena incorrecta." : "Invalid credentials",
        },
        { status: 401 },
      );
    }

    const code = generateTwoFactorCode();
    const expiresAt = new Date(Date.now() + env.AUTH_2FA_TTL_MINUTES * 60_000);

    const challenge = await db.twoFactorChallenge.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        codeHash: hashTwoFactorCode(code),
        expiresAt,
        purpose: "login",
      },
    });

    try {
      await sendTwoFactorEmail(user.email, code);
    } catch {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ message: "Unable to send verification code" }, { status: 500 });
      }
    }

    return NextResponse.json({
      requiresTwoFactor: true,
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt.toISOString(),
      devCode: process.env.NODE_ENV === "development" ? code : undefined,
    });
  } catch (err) {
    console.error("/api/auth/login error:", err);
    return NextResponse.json({ message: "Error inesperado en el servidor" }, { status: 500 });
  }
}