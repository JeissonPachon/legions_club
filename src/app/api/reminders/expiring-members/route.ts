import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { decryptSensitiveValue } from "@/lib/security/crypto";
import { requireGymManagementApi } from "@/modules/gym/auth";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(5),
});

type ExpiringMember = {
  memberId: string;
  fullName: string;
  subscriptionId: string;
  endDate: string;
  daysLeft: number;
  whatsappUrl: string | null;
};

function buildManualWhatsappLink(phone: string, message: string): string | null {
  const normalizedPhone = phone.replace(/\D/g, "");
  if (normalizedPhone.length < 8) {
    return null;
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export async function GET(request: Request) {
  const auth = await requireGymManagementApi({
    forbiddenMessage: "Only owner or manager can view expiring member reminders",
  });
  if (auth instanceof Response) {
    return auth;
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    days: url.searchParams.get("days") ?? "5",
  });

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid query" }, { status: 400 });
  }

  const now = new Date();
  const end = dayjs(now).add(parsed.data.days, "day").toDate();

  const subscriptions = await db.subscription.findMany({
    where: {
      tenantId: auth.tenantId,
      status: "active",
      endDate: {
        gte: now,
        lte: end,
      },
      member: {
        deletedAt: null,
        isActive: true,
      },
    },
    include: {
      member: {
        include: {
          sensitive: {
            select: {
              phoneEnc: true,
            },
          },
        },
      },
    },
    orderBy: {
      endDate: "asc",
    },
  });

  const expiringMembers: ExpiringMember[] = [];

  for (const subscription of subscriptions) {
    const member = subscription.member;
    const daysLeft = dayjs(subscription.endDate).startOf("day").diff(dayjs(now).startOf("day"), "day");

    let whatsappUrl: string | null = null;
    if (member.sensitive?.phoneEnc) {
      try {
        const phone = decryptSensitiveValue(member.sensitive.phoneEnc);
        const message = `Hola ${member.fullName}, tu suscripcion vence el ${dayjs(subscription.endDate).format("DD/MM/YYYY")}. Escribenos para renovarla.`;
        whatsappUrl = buildManualWhatsappLink(phone, message);
      } catch (error) {
        console.error("Failed to decrypt member phone for expiring list", {
          tenantId: auth.tenantId,
          memberId: member.id,
          error,
        });
      }
    }

    expiringMembers.push({
      memberId: member.id,
      fullName: member.fullName,
      subscriptionId: subscription.id,
      endDate: subscription.endDate.toISOString(),
      daysLeft,
      whatsappUrl,
    });
  }

  return NextResponse.json({
    ok: true,
    days: parsed.data.days,
    count: expiringMembers.length,
    expiringMembers,
  });
}
