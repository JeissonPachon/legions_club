import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth/server";
import { getCurrentSaasMonthlyFeeCents } from "@/lib/billing/monthly-fee";
import { getTenantBillingDates, getOverdueDays } from "@/lib/billing/saas";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/http/responses";
import { getSuperAdminPlatformSettings } from "@/modules/super-admin/settings";

const automationSchema = z.object({
  dryRun: z.boolean().default(false),
});

function hasAutomationToken(request: Request) {
  if (!env.BILLING_AUTOMATION_TOKEN) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${env.BILLING_AUTOMATION_TOKEN}`;
}

function getSuperAdminEmailList() {
  return (env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function resolveActorUserId(explicitUserId?: string) {
  if (explicitUserId) {
    return explicitUserId;
  }

  const superAdminEmails = getSuperAdminEmailList();
  if (superAdminEmails.length === 0) {
    return null;
  }

  const actor = await db.user.findFirst({
    where: {
      isActive: true,
      email: {
        in: superAdminEmails,
      },
    },
    select: { id: true },
  });

  return actor?.id ?? null;
}

async function sendBillingReminderEmail(to: string, gymName: string, overdueDays: number) {
  if (process.env.NODE_ENV === "development" || env.SMTP_HOST.includes("example")) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject: `Pago mensual pendiente - ${gymName}`,
    text: `Tu mensualidad SaaS de Legions Club esta pendiente. Dias de mora: ${overdueDays}. Por favor regulariza el pago para evitar suspension.`,
    html: `<p>Tu mensualidad SaaS de <strong>Legions Club</strong> esta pendiente.</p><p><strong>Dias de mora:</strong> ${overdueDays}</p><p>Por favor regulariza el pago para evitar suspension.</p>`,
  });
}

async function runAutomation({
  actorUserId,
  dryRun,
}: {
  actorUserId: string;
  dryRun: boolean;
}) {
  const now = new Date();
  const monthlyFeeCents = await getCurrentSaasMonthlyFeeCents();
  const settings = await getSuperAdminPlatformSettings();
  let remindersSent = 0;
  let tenantsSuspended = 0;

  const tenants = await db.tenant.findMany({
    where: {
      status: { in: ["active", "suspended"] },
      slug: { not: "platform-admin" },
    },
    include: {
      users: {
        where: { role: "owner", isActive: true },
        select: { email: true },
      },
    },
    take: 500,
  });

  for (const tenant of tenants) {
    const dates = getTenantBillingDates(tenant.createdAt, now);
    if (!dates.currentDueAt) {
      continue;
    }

    const paidThisCycle =
      (await db.auditLog.count({
        where: {
          tenantId: tenant.id,
          action: "saas_monthly_payment_registered",
          createdAt: {
            gte: dates.currentDueAt,
            lt: dates.nextDueAt,
          },
        },
      })) > 0;

    if (paidThisCycle) {
      continue;
    }

    const overdueDays = getOverdueDays(dates.currentDueAt, paidThisCycle, now);
    if (overdueDays <= 0) {
      continue;
    }

    const reminderAlreadySent =
      (await db.auditLog.count({
        where: {
          tenantId: tenant.id,
          action: "saas_monthly_reminder_sent",
          createdAt: {
            gte: dates.currentDueAt,
            lt: dates.nextDueAt,
          },
        },
      })) > 0;

    if (!reminderAlreadySent) {
      remindersSent += 1;

      if (!dryRun) {
        for (const owner of tenant.users) {
          await sendBillingReminderEmail(owner.email, tenant.displayName, overdueDays);
        }

        await db.auditLog.create({
          data: {
            tenantId: tenant.id,
            actorUserId,
            action: "saas_monthly_reminder_sent",
            entityType: "tenant_billing",
            metadataJson: {
              overdueDays,
              amountCents: monthlyFeeCents,
              dueAt: dates.currentDueAt,
            },
          },
        });
      }
    }

    if (overdueDays >= settings.graceDays && tenant.status === "active") {
      tenantsSuspended += 1;

      if (!dryRun) {
        await db.tenant.update({ where: { id: tenant.id }, data: { status: "suspended" } });

        await db.auditLog.create({
          data: {
            tenantId: tenant.id,
            actorUserId,
            action: "tenant_suspended_non_payment",
            entityType: "tenant",
            entityId: tenant.id,
            metadataJson: {
              overdueDays,
              graceDays: settings.graceDays,
            },
          },
        });
      }
    }
  }

  return {
    ok: true,
    dryRun,
    remindersSent,
    tenantsSuspended,
    graceDays: settings.graceDays,
  };
}

export async function GET(request: Request) {
  const tokenAuthorized = hasAutomationToken(request);
  const auth = await getAuthContext();

  if (!tokenAuthorized && !auth) {
    return unauthorizedResponse();
  }

  if (!tokenAuthorized && auth && !auth.isSuperAdmin) {
    return forbiddenResponse("Only super admins can execute billing automation");
  }

  const actorUserId = await resolveActorUserId(auth?.userId);
  if (!actorUserId) {
    return NextResponse.json(
      { message: "No active super admin user found to write automation audit logs" },
      { status: 400 },
    );
  }

  const result = await runAutomation({ actorUserId, dryRun: false });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const tokenAuthorized = hasAutomationToken(request);
  const auth = await getAuthContext();

  if (!tokenAuthorized && !auth) {
    return unauthorizedResponse();
  }

  if (!tokenAuthorized && auth && !auth.isSuperAdmin) {
    return forbiddenResponse("Only super admins can execute billing automation");
  }

  const body = await request.json().catch(() => ({}));
  const parsed = automationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const actorUserId = await resolveActorUserId(auth?.userId);
  if (!actorUserId) {
    return NextResponse.json(
      { message: "No active super admin user found to write automation audit logs" },
      { status: 400 },
    );
  }

  const result = await runAutomation({ actorUserId, dryRun: parsed.data.dryRun });
  return NextResponse.json(result);
}
