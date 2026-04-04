import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { decryptSensitiveValue, encryptSensitiveValue, hashPII } from "@/lib/security/crypto";
import { requireGymManagementApi } from "@/modules/gym/auth";

const updateMemberSchema = z.object({
  fullName: z.string().min(2).optional(),
  document: z.string().min(4).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  isActive: z.boolean().optional(),
  injuries: z.string().optional(),
  conditions: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  emergencyRelation: z.string().optional(),
});

type RouteContext = {
  params: Promise<{ memberId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const auth = await requireGymManagementApi();
  if (auth instanceof Response) {
    return auth;
  }

  const { memberId } = await context.params;

  const member = await db.member.findFirst({
    where: {
      id: memberId,
      tenantId: auth.tenantId,
      deletedAt: null,
    },
    include: {
      sensitive: true,
    },
  });

  if (!member) {
    return NextResponse.json({ message: "Member not found" }, { status: 404 });
  }

  return NextResponse.json({
    member: {
      id: member.id,
      fullName: member.fullName,
      documentLast4: member.documentLast4,
      hasEmail: Boolean(member.emailHash),
      hasPhone: Boolean(member.phoneHash),
      // ✅ phoneEnc ahora viene de sensitive
      phone: member.sensitive?.phoneEnc
        ? decryptSensitiveValue(member.sensitive.phoneEnc)
        : null,
      isActive: member.isActive,
      createdAt: member.createdAt,
      sensitive: member.sensitive
        ? {
            injuries: member.sensitive.injuriesEnc
              ? decryptSensitiveValue(member.sensitive.injuriesEnc)
              : null,
            conditions: member.sensitive.conditionsEnc
              ? decryptSensitiveValue(member.sensitive.conditionsEnc)
              : null,
            emergencyName: member.sensitive.emergencyNameEnc
              ? decryptSensitiveValue(member.sensitive.emergencyNameEnc)
              : null,
            emergencyPhone: member.sensitive.emergencyPhoneEnc
              ? decryptSensitiveValue(member.sensitive.emergencyPhoneEnc)
              : null,
            emergencyRelation: member.sensitive.emergencyRelationEnc
              ? decryptSensitiveValue(member.sensitive.emergencyRelationEnc)
              : null,
          }
        : null,
    },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireGymManagementApi();
  if (auth instanceof Response) {
    return auth;
  }

  const { memberId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const target = await db.member.findFirst({
    where: {
      id: memberId,
      tenantId: auth.tenantId,
      deletedAt: null,
    },
    include: { sensitive: true },
  });

  if (!target) {
    return NextResponse.json({ message: "Member not found" }, { status: 404 });
  }

  const sensitiveUpdate = {
    // ✅ phoneEnc ahora va en sensitive
    phoneEnc: parsed.data.phone ? encryptSensitiveValue(parsed.data.phone) : undefined,
    injuriesEnc: parsed.data.injuries ? encryptSensitiveValue(parsed.data.injuries) : undefined,
    conditionsEnc: parsed.data.conditions ? encryptSensitiveValue(parsed.data.conditions) : undefined,
    emergencyNameEnc: parsed.data.emergencyName
      ? encryptSensitiveValue(parsed.data.emergencyName)
      : undefined,
    emergencyPhoneEnc: parsed.data.emergencyPhone
      ? encryptSensitiveValue(parsed.data.emergencyPhone)
      : undefined,
    emergencyRelationEnc: parsed.data.emergencyRelation
      ? encryptSensitiveValue(parsed.data.emergencyRelation)
      : undefined,
  };

  // ✅ Eliminado el (db as any) y phoneEnc del member
  const member = await db.member.update({
    where: { id: target.id },
    data: {
      fullName: parsed.data.fullName,
      documentHash: parsed.data.document ? hashPII(parsed.data.document) : undefined,
      documentLast4: parsed.data.document ? parsed.data.document.slice(-4) : undefined,
      emailHash: parsed.data.email ? hashPII(parsed.data.email) : undefined,
      phoneHash: parsed.data.phone ? hashPII(parsed.data.phone) : undefined,
      // ← phoneEnc eliminado de aquí
      isActive: parsed.data.isActive,
      sensitive: target.sensitive
        ? { update: sensitiveUpdate }
        : { create: sensitiveUpdate },
    },
    select: {
      id: true,
      fullName: true,
      documentLast4: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ member });
}

export async function DELETE(_: Request, context: RouteContext) {
  const auth = await requireGymManagementApi();
  if (auth instanceof Response) {
    return auth;
  }

  const { memberId } = await context.params;

  await db.member.updateMany({
    where: {
      id: memberId,
      tenantId: auth.tenantId,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
      isActive: false,
    },
  });

  return NextResponse.json({ ok: true });
}