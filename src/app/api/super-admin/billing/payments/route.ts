import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSaasMonthlyFeeCents } from "@/lib/billing/monthly-fee";
import { getTenantBillingDates } from "@/lib/billing/saas";
import { db } from "@/lib/db";
import { requireSuperAdminApi } from "@/modules/super-admin/auth";

const paymentSchema = z.object({
  tenantId: z.string().uuid(),
  amountCents: z.number().int().positive().optional(),
  notes: z.string().max(280).optional(),
});

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi("Only super admins can register SaaS payments");
  if (auth instanceof Response) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const tenant = await db.tenant.findUnique({
    where: { id: parsed.data.tenantId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      displayName: true,
    },
  });

  if (!tenant) {
    return NextResponse.json({ message: "Gimnasio no encontrado" }, { status: 404 });
  }

  const currentFeeCents = await getCurrentSaasMonthlyFeeCents();
  const amountCents = parsed.data.amountCents ?? currentFeeCents;
  const cycle = getTenantBillingDates(tenant.createdAt, new Date());

  await db.$transaction(async (tx: any) => {
    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorUserId: auth.userId,
        action: "saas_monthly_payment_registered",
        entityType: "tenant_billing",
        metadataJson: {
          amountCents,
          currency: "COP",
          notes: parsed.data.notes?.trim() || null,
          currentDueAt: cycle.currentDueAt,
          nextDueAt: cycle.nextDueAt,
        },
      },
    });

    if (tenant.status === "suspended") {
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { status: "active" },
      });

      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorUserId: auth.userId,
          action: "tenant_reactivated_after_payment",
          entityType: "tenant",
          entityId: tenant.id,
          metadataJson: {
            reason: "monthly_payment",
            amountCents,
          },
        },
      });
    }
  });

  return NextResponse.json({
    ok: true,
    tenant: {
      id: tenant.id,
      displayName: tenant.displayName,
    },
    amountCents,
  });
}
