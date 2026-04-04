import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { decryptSensitiveValue, encryptSensitiveValue, hashPII } from "@/lib/security/crypto";
import { requireSuperAdminApi } from "@/modules/super-admin/auth";

const createTenantSchema = z.object({
  tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  legalName: z.string().min(2),
  displayName: z.string().min(2),
  nit: z.string().min(3).optional(),
  discipline: z.enum(["gym", "powerlifting", "crossfit", "pilates", "hyrox", "mma", "other"]),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  adminPhone: z.string().min(7).regex(/^\+?[1-9]\d{6,14}$/),
});

export async function GET(request: Request) {
  const auth = await requireSuperAdminApi("Only super admins can view tenants");
  if (auth instanceof Response) {
    return auth;
  }

  const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";
  const baseWhere = { slug: { not: "platform-admin" } };

  const tenants = await db.tenant.findMany({
    where: includeArchived
      ? baseWhere
      : {
          ...baseWhere,
          status: { in: ["active", "suspended"] },
        },
    include: {
      users: {
        where: { role: "owner", isActive: true },
        select: {
          email: true,
          phoneEnc: true,
        },
        take: 1,
      },
      _count: {
        select: {
          users: true,
          members: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    tenants: tenants.map((tenant) => {
      const owner = tenant.users[0] ?? null;
      let ownerPhone: string | null = null;

      if (owner?.phoneEnc) {
        try {
          ownerPhone = decryptSensitiveValue(owner.phoneEnc);
        } catch {
          ownerPhone = null;
        }
      }

      return {
        id: tenant.id,
        slug: tenant.slug,
        displayName: tenant.displayName,
        legalName: tenant.legalName,
        nit: tenant.nit ?? null,
        discipline: tenant.discipline,
        status: tenant.status,
        createdAt: tenant.createdAt,
        usersCount: tenant._count.users,
        membersCount: tenant._count.members,
        ownerEmail: owner?.email ?? null,
        ownerPhone,
      };
    }),
  });
}

export async function POST(request: Request) {
  try {
    const auth = await requireSuperAdminApi("Only super admins can register tenants");
    if (auth instanceof Response) {
      return auth;
    }

    const body = await request.json().catch(() => null);
    const parsed = createTenantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }

    const tenantSlug = parsed.data.tenantSlug.toLowerCase();
    const adminEmail = parsed.data.adminEmail.toLowerCase();

    const existingTenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
    if (existingTenant) {
      return NextResponse.json({ message: "Tenant slug already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.adminPassword);

    const result = await db.$transaction(async (tx: any) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: tenantSlug,
          legalName: parsed.data.legalName,
          nit: parsed.data.nit ?? null,
          displayName: parsed.data.displayName,
          discipline: parsed.data.discipline,
        },
      });

      const owner = await tx.user.create({
        data: {
          tenantId: tenant.id,
          role: "owner",
          fullName: parsed.data.adminName,
          email: adminEmail,
          passwordHash,
          phoneHash: hashPII(parsed.data.adminPhone),
          phoneEnc: encryptSensitiveValue(parsed.data.adminPhone),
        },
      });

      const plans = await tx.plan.createMany({
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

      return { tenant, owner, plansCreated: plans.count };
    });

    return NextResponse.json(
      {
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
        plansCreated: result.plansCreated,
      },
      { status: 201 },
    );
  } catch (err) {
    // Log full error on server for debugging
    console.error("Error in POST /api/super-admin/tenants:", err);
    const message =
      process.env.NODE_ENV === "development"
        ? err instanceof Error
          ? err.message
          : String(err)
        : "Internal server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
