import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hashPassword } from "@/lib/auth/password";

const bootstrapSchema = z.object({
  bootstrapKey: z.string().min(8).optional(),
  tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  legalName: z.string().min(2),
  displayName: z.string().min(2),
  discipline: z.enum(["gym", "powerlifting", "crossfit", "pilates", "hyrox", "mma", "other"]),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bootstrapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid setup payload" }, { status: 400 });
  }

  if (process.env.NODE_ENV === "production") {
    if (!env.BOOTSTRAP_KEY || parsed.data.bootstrapKey !== env.BOOTSTRAP_KEY) {
      return NextResponse.json({ message: "Invalid bootstrap key" }, { status: 401 });
    }
  }

  const exists = await db.tenant.findUnique({
    where: { slug: parsed.data.tenantSlug.toLowerCase() },
  });

  if (exists) {
    return NextResponse.json({ message: "Tenant already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.adminPassword);

  const result = await db.$transaction(async (tx: any) => {
    const tenant = await tx.tenant.create({
      data: {
        slug: parsed.data.tenantSlug.toLowerCase(),
        legalName: parsed.data.legalName,
        displayName: parsed.data.displayName,
        discipline: parsed.data.discipline,
      },
    });

    const owner = await tx.user.create({
      data: {
        tenantId: tenant.id,
        role: "owner",
        fullName: parsed.data.adminName,
        email: parsed.data.adminEmail.toLowerCase(),
        passwordHash,
        phoneHash: "",
        phoneEnc: "",
      },
    });

    await tx.plan.createMany({
      data: [
        {
          tenantId: tenant.id,
          name: "Mensual Base",
          sessionsPerMonth: 12,
          durationDays: 30,
          priceCents: 8900000,
          currency: "COP",
        },
        {
          tenantId: tenant.id,
          name: "Mensual Pro",
          sessionsPerMonth: 20,
          durationDays: 30,
          priceCents: 12900000,
          currency: "COP",
        },
      ],
    });

    return { tenant, owner };
  });

  return NextResponse.json({
    ok: true,
    tenant: {
      id: result.tenant.id,
      slug: result.tenant.slug,
      displayName: result.tenant.displayName,
    },
    owner: {
      id: result.owner.id,
      email: result.owner.email,
    },
  });
}