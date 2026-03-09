import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireGymManagementApi } from "@/modules/gym/auth";
import { encryptSensitiveValue, hashPII } from "@/lib/security/crypto";

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

export async function GET(request: Request) {
  const auth = await requireGymManagementApi();
  if (auth instanceof Response) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();

  const members = await db.member.findMany({
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

  const result = await db.$transaction(async (tx) => {
    const member = await tx.member.create({
      data: {
        tenantId: auth.tenantId,
        fullName: parsed.data.fullName,
        documentHash: hashPII(parsed.data.document),
        documentLast4: parsed.data.document.slice(-4),
        emailHash: parsed.data.email ? hashPII(parsed.data.email) : null,
        phoneHash: parsed.data.phone ? hashPII(parsed.data.phone) : null,
        sensitive: {
          create: {
            injuriesEnc: parsed.data.injuries ? encryptSensitiveValue(parsed.data.injuries) : null,
            conditionsEnc: parsed.data.conditions ? encryptSensitiveValue(parsed.data.conditions) : null,
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