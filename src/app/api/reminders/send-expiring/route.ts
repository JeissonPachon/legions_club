import { NextResponse } from "next/server";
import { z } from "zod";
import dayjs from "dayjs";
import { db } from "@/lib/db";
import { requireSuperAdminApi } from "@/modules/super-admin/auth";
import { decryptSensitiveValue, hashPII } from "@/lib/security/crypto";
import { processWhatsappQueue } from "@/lib/notifications/whatsapp";

const schema = z.object({
  days: z.number().min(1).default(5),
  channel: z.enum(["email", "whatsapp", "both"]).default("both"),
  scope: z.enum(["current_tenant", "all_active_tenants"]).default("current_tenant"),
  tenantId: z.string().uuid().optional(),
});

type OutboxRow = {
  tenantId: string;
  toHash: string;
  template: "reminder_email" | "whatsapp";
  payloadJson: { to: string | null; body: string };
  status: "queued";
};

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi("Only super admins can send reminders");
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: "Invalid payload" }, { status: 400 });

  const { days, channel, scope, tenantId } = parsed.data;
  const start = new Date();
  const end = dayjs(start).add(days, "day").toDate();

  // Determine tenants
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

  for (const t of tenants) {
    // Incluir sensitive en member para acceder a phoneEnc
    const subscriptions = await db.subscription.findMany({
      where: {
        tenantId: t.id,
        status: "active",
        endDate: { lte: end, gte: start },
      },
      include: {
        member: {
          include: { sensitive: true },
        },
      },
    });

    usersTargeted += subscriptions.length;
    const outboxRows: OutboxRow[] = [];

    for (const s of subscriptions) {
      const m = s.member;
      const message = `Tu suscripcion vence el ${new Date(s.endDate).toLocaleDateString()}. Por favor renueva.`;

      // Email
      if ((channel === "email" || channel === "both") && m.emailHash) {
        outboxRows.push({
          tenantId: t.id,
          toHash: m.emailHash,
          template: "reminder_email",
          payloadJson: { to: null, body: message },
          status: "queued",
        });
        emailSent++;
      }

      // WhatsApp — phoneEnc viene de sensitive
      if (channel === "whatsapp" || channel === "both") {
        if (!m.sensitive?.phoneEnc) {
          whatsappSkippedNoPhone++;
        } else {
          try {
            const phone = decryptSensitiveValue(m.sensitive.phoneEnc);
            outboxRows.push({
              tenantId: t.id,
              toHash: hashPII(phone),
              template: "whatsapp",
              payloadJson: { to: phone, body: message },
              status: "queued",
            });
            whatsappQueued++;
          } catch (err) {
            whatsappSkippedDecryptError++;
            console.error("Error decrypting member phone for expiring reminder", {
              tenantId: t.id,
              memberId: m.id,
              err,
            });
          }
        }
      }
    }

    if (outboxRows.length > 0) await db.emailOutbox.createMany({ data: outboxRows });
  }

  // Procesa la cola de WhatsApp inmediatamente
  if (whatsappQueued > 0) {
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
    whatsappMode: "sent",
  });
}