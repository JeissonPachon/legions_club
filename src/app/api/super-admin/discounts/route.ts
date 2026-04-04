import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSuperAdminApi } from "@/modules/super-admin/auth";

const createDiscountSchema = z.object({
  name: z.string().min(2).max(80),
  discountType: z.enum(["percent", "fixed_cents"]),
  value: z.number().positive(),
  appliesTo: z.enum(["all_active_gyms", "single_gym"]),
  tenantId: z.string().uuid().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  notes: z.string().max(240).optional(),
});

type DiscountRow = {
  id: string;
  name: string;
  discountType: "percent" | "fixed_cents";
  value: number;
  appliesTo: "all_active_gyms" | "single_gym";
  tenantId: string | null;
  tenantName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
};

type DiscountAuditLogRow = {
  id: string;
  metadataJson: unknown;
  createdAt: Date;
};

function toDiscount(log: {
  id: string;
  metadataJson: unknown;
  createdAt: Date;
}): Omit<DiscountRow, "tenantName"> | null {
  if (!log.metadataJson || typeof log.metadataJson !== "object" || Array.isArray(log.metadataJson)) {
    return null;
  }

  const metadata = log.metadataJson as Record<string, unknown>;
  const name = metadata.name;
  const discountType = metadata.discountType;
  const value = metadata.value;
  const appliesTo = metadata.appliesTo;

  if (
    typeof name !== "string" ||
    (discountType !== "percent" && discountType !== "fixed_cents") ||
    typeof value !== "number" ||
    (appliesTo !== "all_active_gyms" && appliesTo !== "single_gym")
  ) {
    return null;
  }

  const startsAt = typeof metadata.startsAt === "string" ? metadata.startsAt : null;
  const endsAt = typeof metadata.endsAt === "string" ? metadata.endsAt : null;
  const now = new Date();
  const isActive =
    (startsAt ? new Date(startsAt) <= now : true) &&
    (endsAt ? new Date(endsAt) >= now : true);

  return {
    id: log.id,
    name,
    discountType,
    value,
    appliesTo,
    tenantId: typeof metadata.tenantId === "string" ? metadata.tenantId : null,
    startsAt,
    endsAt,
    notes: typeof metadata.notes === "string" ? metadata.notes : null,
    isActive,
    createdAt: log.createdAt.toISOString(),
  };
}

export async function GET() {
  const auth = await requireSuperAdminApi("Only super admins can view discount rules");
  if (auth instanceof Response) {
    return auth;
  }

  const logs: DiscountAuditLogRow[] = await db.auditLog.findMany({
    where: {
      action: "discount_created",
      entityType: "discount_rule",
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const rawDiscounts: Array<Omit<DiscountRow, "tenantName">> = [];
  for (const log of logs) {
    const discount = toDiscount(log);
    if (discount) {
      rawDiscounts.push(discount);
    }
  }

  const tenantIds = Array.from(new Set(rawDiscounts.map((discount) => discount.tenantId).filter(Boolean))) as string[];

  const tenants = tenantIds.length
    ? await db.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, displayName: true },
      })
    : [];

  const tenantMap = new Map(tenants.map((tenant) => [tenant.id, tenant.displayName]));

  const discounts: DiscountRow[] = rawDiscounts.map((discount) => ({
    ...discount,
    tenantName: discount.tenantId ? (tenantMap.get(discount.tenantId) ?? null) : null,
  }));

  return NextResponse.json({ discounts });
}

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi("Only super admins can create discount rules");
  if (auth instanceof Response) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  const parsed = createDiscountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid discount payload" }, { status: 400 });
  }

  if (parsed.data.discountType === "percent" && parsed.data.value > 100) {
    return NextResponse.json({ message: "Percent discount cannot exceed 100" }, { status: 400 });
  }

  if (parsed.data.appliesTo === "single_gym" && !parsed.data.tenantId) {
    return NextResponse.json({ message: "tenantId is required for single gym discount" }, { status: 400 });
  }

  if (parsed.data.tenantId) {
    const tenant = await db.tenant.findUnique({ where: { id: parsed.data.tenantId } });
    if (!tenant) {
      return NextResponse.json({ message: "Target gym not found" }, { status: 404 });
    }
  }

  const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : null;
  const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;

  if (startsAt && endsAt && startsAt > endsAt) {
    return NextResponse.json({ message: "startsAt cannot be after endsAt" }, { status: 400 });
  }

  const discountId = randomUUID();

  const log = await db.auditLog.create({
    data: {
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: "discount_created",
      entityType: "discount_rule",
      entityId: discountId,
      metadataJson: {
        name: parsed.data.name,
        discountType: parsed.data.discountType,
        value: parsed.data.value,
        appliesTo: parsed.data.appliesTo,
        tenantId: parsed.data.tenantId ?? null,
        startsAt: startsAt ? startsAt.toISOString() : null,
        endsAt: endsAt ? endsAt.toISOString() : null,
        notes: parsed.data.notes ?? null,
      },
    },
  });

  return NextResponse.json({ ok: true, discountId: log.id }, { status: 201 });
}
