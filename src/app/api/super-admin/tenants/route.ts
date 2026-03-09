import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { requireSuperAdminApi } from "@/modules/super-admin/auth";

const createTenantSchema = z.object({
  tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  legalName: z.string().min(2),
  displayName: z.string().min(2),
  discipline: z.enum(["gym", "powerlifting", "crossfit", "pilates", "hyrox", "mma", "other"]),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
});

export async function GET(request: Request) {
  const auth = await requireSuperAdminApi("Only super admins can view tenants");
  if (auth instanceof Response) {
    return auth;
  }

  const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";

  const tenants = await db.tenant.findMany({
    where: includeArchived ? undefined : { status: { in: ["active", "suspended"] } },
    include: {
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
    tenants: tenants.map((tenant) => ({
      id: tenant.id,
      slug: tenant.slug,
      displayName: tenant.displayName,
      legalName: tenant.legalName,
      discipline: tenant.discipline,
      status: tenant.status,
      createdAt: tenant.createdAt,
      usersCount: tenant._count.users,
      membersCount: tenant._count.members,
    })),
  });
}

export async function POST(request: Request) {
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

  const result = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug: tenantSlug,
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
        email: adminEmail,
        passwordHash,
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
}
