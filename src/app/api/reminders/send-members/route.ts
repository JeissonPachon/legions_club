import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireGymManagementApi } from "@/modules/gym/auth";
import { decryptSensitiveValue, hashPII } from "@/lib/security/crypto";
import { processWhatsappQueue } from "@/lib/notifications/whatsapp";

const sendMembersSchema = z.object({
  message: z.string().min(4),
  channel: z.enum(["email", "whatsapp", "both"]).default("both"),
  whatsappMode: z.enum(["sent", "manual"]).default("manual"),
});

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
  const auth = await requireGymManagementApi({
    forbiddenMessage: "Only owner or manager can send member reminders",
  });
  if (auth instanceof Response) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  const parsed = sendMembersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const { message, channel, whatsappMode } = parsed.data;

  const members = await db.member.findMany({
    where: {
      tenantId: auth.tenantId,
      deletedAt: null,
      isActive: true,
    },
    include: {
      sensitive: {
        select: { phoneEnc: true },
      },
    },
  });

  const usersTargeted = members.length;
  let emailQueued = 0;
  let whatsappQueued = 0;
  let whatsappSkippedNoPhone = 0;
  let whatsappSkippedDecryptError = 0;
  const whatsappManualLinks: ManualWhatsappLink[] = [];

  const outboxRows: Array<{
    tenantId: string;
    toHash: string;
    template: string;
    payloadJson: { to: string | null; body: string };
    status: string;
  }> = [];

  for (const member of members) {
    if (channel === "email" || channel === "both") {
      if (member.emailHash) {
        outboxRows.push({
          tenantId: auth.tenantId,
          toHash: member.emailHash,
          template: "reminder_email",
          payloadJson: { to: null, body: message },
          status: "queued",
        });
        emailQueued++;
      }
    }

    if (channel === "whatsapp" || channel === "both") {
      const phoneEnc = member.sensitive?.phoneEnc;
      if (!phoneEnc) {
        whatsappSkippedNoPhone++;
        continue;
      }

      try {
        const phone = decryptSensitiveValue(phoneEnc);
        if (whatsappMode === "manual") {
          const url = buildManualWhatsappLink(phone, message);
          if (!url) {
            whatsappSkippedNoPhone++;
            continue;
          }

          whatsappManualLinks.push({
            name: member.fullName ?? "Miembro",
            phone,
            url,
          });
        } else {
          outboxRows.push({
            tenantId: auth.tenantId,
            toHash: hashPII(phone),
            template: "whatsapp",
            payloadJson: { to: phone, body: message },
            status: "queued",
          });
          whatsappQueued++;
        }
      } catch (error) {
        whatsappSkippedDecryptError++;
        console.error("Failed to decrypt member phone for WhatsApp reminder", {
          tenantId: auth.tenantId,
          memberId: member.id,
          error,
        });
      }
    }
  }

  if (outboxRows.length > 0) {
    await db.emailOutbox.createMany({ data: outboxRows });
  }

  if (whatsappMode === "sent" && whatsappQueued > 0) {
    try {
      await processWhatsappQueue();
    } catch (error) {
      console.error("Error processing WhatsApp queue for member reminders", {
        tenantId: auth.tenantId,
        error,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    usersTargeted,
    emailQueued,
    whatsappQueued,
    whatsappSkippedNoPhone,
    whatsappSkippedDecryptError,
    whatsappMode,
    whatsappManualLinks,
  });
}
