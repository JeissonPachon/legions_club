import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireSuperAdminApi } from "@/modules/super-admin/auth";
import { decryptSensitiveValue, hashPII } from "@/lib/security/crypto";
import { processWhatsappQueue } from "@/lib/notifications/whatsapp";

const sendSchema = z.object({
  message: z.string().min(4),
  channel: z.enum(["email", "whatsapp", "both"]).default("both"),
  scope: z.enum(["current_tenant", "all_active_tenants"]).default("current_tenant"),
  tenantId: z.string().uuid().optional(),
  whatsappMode: z.enum(["sent", "manual"]).default("sent"),
});

type OutboxRow = {
  tenantId: string;
  toHash: string;
  template: "whatsapp";
  payloadJson: { to: string; body: string };
  status: "queued";
};

type ManualWhatsappLink = {
  name: string;
  phone: string;
  url: string;
};

function buildManualWhatsappLink(phone: string, message: string): string | null {
  const normalizedPhone = phone.replace(/\D/g, "");
  if (normalizedPhone.length < 8) {
    return null;
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi("Only super admins can send reminders");
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: "Invalid payload" }, { status: 400 });

  const { message, channel, scope, tenantId, whatsappMode } = parsed.data;

  // Determine tenants to target
  let tenants = [] as { id: string }[];
  if (scope === "all_active_tenants") {
    tenants = await db.tenant.findMany({ where: { status: "active" }, select: { id: true } });
  } else if (tenantId) {
    const t = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!t) return NextResponse.json({ message: "Tenant not found" }, { status: 404 });
    tenants = [t];
  } else if (auth.tenantId) {
    tenants = [{ id: auth.tenantId }];
  } else {
    return NextResponse.json({ message: "No tenant specified" }, { status: 400 });
  }

  let usersTargeted = 0;
  let emailSent = 0;
  let whatsappQueued = 0;
  let whatsappSkippedNoPhone = 0;
  let whatsappSkippedDecryptError = 0;
  const whatsappManualLinks: ManualWhatsappLink[] = [];

  for (const t of tenants) {
    // ✅ Incluir phoneEnc del owner/manager para WhatsApp
    const adminUsers = await db.user.findMany({
      where: { tenantId: t.id, isActive: true, role: { in: ["owner", "manager"] } },
      select: { email: true, fullName: true, phoneEnc: true },
    });

    usersTargeted += adminUsers.length;

    const outboxRows: OutboxRow[] = [];

    // Email para admins
    if (channel === "email" || channel === "both") {
      const shouldSend =
        process.env.NODE_ENV !== "development" &&
        !(typeof env.SMTP_HOST === "string" && env.SMTP_HOST.includes("example"));

      if (shouldSend) {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: Number(env.SMTP_PORT),
          secure: Number(env.SMTP_PORT) === 465,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        });

        for (const u of adminUsers) {
          try {
            await transporter.sendMail({
              from: env.EMAIL_FROM,
              to: u.email,
              subject: "Recordatorio Legions Club",
              text: `${message}\n\nEquipo Legions Club`,
              html: `<p>${message}</p><p><strong>Equipo Legions Club</strong></p>`,
            });
            emailSent++;
          } catch (err) {
            console.error("Failed sending reminder email to user", u.email, err);
          }
        }
      } else {
        emailSent += adminUsers.length;
      }
    }

    // ✅ WhatsApp para admins usando phoneEnc del User
    if (channel === "whatsapp" || channel === "both") {
      for (const u of adminUsers) {
        if (!u.phoneEnc) {
          whatsappSkippedNoPhone++;
          continue;
        }

        try {
          const phone = decryptSensitiveValue(u.phoneEnc);
          if (whatsappMode === "manual") {
            const url = buildManualWhatsappLink(phone, message);
            if (!url) {
              whatsappSkippedNoPhone++;
              continue;
            }

            whatsappManualLinks.push({
              name: u.fullName ?? u.email,
              phone,
              url,
            });
          } else {
            outboxRows.push({
              tenantId: t.id,
              toHash: hashPII(phone),
              template: "whatsapp",
              payloadJson: { to: phone, body: message },
              status: "queued",
            });
            whatsappQueued++;
          }
        } catch (err) {
          whatsappSkippedDecryptError++;
          console.error("Error decrypting admin phone:", err);
        }
      }
    }

    if (outboxRows.length > 0) {
      await db.emailOutbox.createMany({ data: outboxRows });
    }
  }

  // Procesa la cola de WhatsApp inmediatamente
  if (whatsappMode === "sent" && whatsappQueued > 0) {
    try {
      await processWhatsappQueue();
    } catch (err) {
      console.error("Error procesando cola WhatsApp:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    usersTargeted,
    emailSent,
    whatsappQueued,
    whatsappSkippedNoPhone,
    whatsappSkippedDecryptError,
    whatsappMode,
    whatsappManualLinks,
  });
}