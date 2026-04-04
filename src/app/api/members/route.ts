import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireGymManagementApi } from "@/modules/gym/auth";
import { encryptSensitiveValue, hashPII } from "@/lib/security/crypto";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { sendMemberPasswordEmail } from "@/lib/email/send-member-password-email";

const createMemberSchema = z.object({
  fullName: z.string().min(2),
  document: z.string().min(4),
  planId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  injuries: z.string().optional(),
  conditions: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  emergencyRelation: z.string().optional(),
});

type MemberListRow = {
  id: string;
  fullName: string;
  documentLast4: string;
  emailHash: string | null;
  phoneHash: string | null;
  isActive: boolean;
  createdAt: Date;
};

export async function GET(request: Request) {
  const auth = await requireGymManagementApi();
  if (auth instanceof Response) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();

  const members: MemberListRow[] = await db.member.findMany({
    where: {
      tenantId: auth.tenantId,
      deletedAt: null,
      ...(search
        ? {
            fullName: {
              contains: search,
              mode: "insensitive",
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      fullName: true,
      documentLast4: true,
      emailHash: true,
      phoneHash: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    members: members.map((member) => ({
      id: member.id,
      fullName: member.fullName,
      documentLast4: member.documentLast4,
      isActive: member.isActive,
      createdAt: member.createdAt,
      hasEmail: Boolean(member.emailHash),
      hasPhone: Boolean(member.phoneHash),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireGymManagementApi();
  if (auth instanceof Response) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  const parsed = createMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid member payload" }, { status: 400 });
  }

  const selectedPlan = parsed.data.planId
    ? await db.plan.findFirst({
        where: {
          id: parsed.data.planId,
          tenantId: auth.tenantId,
          isActive: true,
        },
      })
    : null;

  if (parsed.data.planId && !selectedPlan) {
    return NextResponse.json({ message: "Plan no encontrado o inactivo" }, { status: 404 });
  }

  const result = await db.$transaction(async (tx: any) => {
    // Generar contraseña aleatoria segura
    const plainPassword = randomBytes(8).toString("base64url");
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    // 1. Crear el miembro
    const member = await tx.member.create({
      data: {
        tenantId: auth.tenantId,
        fullName: parsed.data.fullName,
        documentHash: hashPII(parsed.data.document),
        documentLast4: parsed.data.document.slice(-4),
        emailHash: parsed.data.email ? hashPII(parsed.data.email) : null,
        phoneHash: parsed.data.phone ? hashPII(parsed.data.phone) : null,
        // ← phoneEnc eliminado de aquí
        sensitive: {
          create: {
            phoneEnc: parsed.data.phone ? encryptSensitiveValue(parsed.data.phone) : null, // ✅ movido aquí
            injuriesEnc: parsed.data.injuries ? encryptSensitiveValue(parsed.data.injuries) : null,
            conditionsEnc: parsed.data.conditions
              ? encryptSensitiveValue(parsed.data.conditions)
              : null,
            emergencyNameEnc: parsed.data.emergencyName
              ? encryptSensitiveValue(parsed.data.emergencyName)
              : null,
            emergencyPhoneEnc: parsed.data.emergencyPhone
              ? encryptSensitiveValue(parsed.data.emergencyPhone)
              : null,
            emergencyRelationEnc: parsed.data.emergencyRelation
              ? encryptSensitiveValue(parsed.data.emergencyRelation)
              : null,
          },
        },
      },
      select: {
        id: true,
        fullName: true,
        documentLast4: true,
        isActive: true,
        createdAt: true,
      },
    });

    // 2. Crear el User por separado si tiene email (Member y User no tienen relación directa)
    if (parsed.data.email) {
      await tx.user.create({
        data: {
          tenantId: auth.tenantId,
          fullName: parsed.data.fullName,
          email: parsed.data.email.toLowerCase(),
          passwordHash,
          phoneHash: parsed.data.phone ? hashPII(parsed.data.phone) : "",
          phoneEnc: parsed.data.phone ? encryptSensitiveValue(parsed.data.phone) : "",
          role: "athlete",
          isActive: true,
        },
      });

      // 3. Enviar contraseña por email
      await sendMemberPasswordEmail(parsed.data.email, plainPassword);
    }

    let createdSubscriptionId: string | null = null;

    if (selectedPlan) {
      const startDate = new Date();
      const endDate = dayjs(startDate).add(selectedPlan.durationDays, "day").toDate();

      const subscription = await tx.subscription.create({
        data: {
          tenantId: auth.tenantId,
          memberId: member.id,
          planId: selectedPlan.id,
          sessionsAssigned: selectedPlan.sessionsPerMonth,
          sessionsRemaining: selectedPlan.sessionsPerMonth,
          startDate,
          endDate,
          createdByUserId: auth.userId,
          status: "active",
        },
      });

      createdSubscriptionId = subscription.id;

      await tx.auditLog.create({
        data: {
          tenantId: auth.tenantId,
          actorUserId: auth.userId,
          action: "finance_income",
          entityType: "subscription",
          entityId: subscription.id,
          metadataJson: {
            entryType: "income",
            amountCents: selectedPlan.priceCents,
            category: "membership",
            note: `Ingreso por membresia: ${selectedPlan.name}`,
            occurredAt: startDate.toISOString(),
            source: "member_registration",
            subscriptionId: subscription.id,
            memberId: member.id,
            memberName: member.fullName,
            planId: selectedPlan.id,
            planName: selectedPlan.name,
          },
        },
      });
    }

    return {
      member,
      subscriptionId: createdSubscriptionId,
      planName: selectedPlan?.name ?? null,
    };
  });

  return NextResponse.json(
    {
      member: result.member,
      subscription: result.subscriptionId
        ? {
            id: result.subscriptionId,
            planName: result.planName,
          }
        : null,
    },
    { status: 201 },
  );
}