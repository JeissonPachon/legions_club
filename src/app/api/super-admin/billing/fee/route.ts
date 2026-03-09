import { NextResponse } from "next/server";
import { z } from "zod";
import {
  calculateIpcAdjustedFeeCents,
  getCurrentSaasMonthlyFeeCents,
  getSaasMonthlyFeeSnapshot,
} from "@/lib/billing/monthly-fee";
import { db } from "@/lib/db";
import { requireSuperAdminApi } from "@/modules/super-admin/auth";

const updateFeeSchema = z.object({
  newFeeCents: z.number().int().positive().optional(),
  ipcPercent: z.number().min(0).max(100).optional(),
  effectiveFrom: z.string().datetime().optional(),
  reason: z.string().min(4).max(220).optional(),
}).refine((data) => typeof data.newFeeCents === "number" || typeof data.ipcPercent === "number", {
  message: "Debe enviar newFeeCents o ipcPercent",
});

export async function GET() {
  const auth = await requireSuperAdminApi("Only super admins can view billing fee");
  if (auth instanceof Response) {
    return auth;
  }

  const snapshot = await getSaasMonthlyFeeSnapshot();
  return NextResponse.json({
    monthlyFeeCents: snapshot.currentFeeCents,
    monthlyFeeEffectiveFrom: snapshot.currentEffectiveFrom,
    nextMonthlyFeeCents: snapshot.nextFeeCents,
    nextMonthlyFeeEffectiveFrom: snapshot.nextEffectiveFrom,
  });
}

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi("Only super admins can update billing fee");
  if (auth instanceof Response) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateFeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const previousFeeCents = await getCurrentSaasMonthlyFeeCents();
  const effectiveFrom = parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : new Date();

  if (Number.isNaN(effectiveFrom.getTime())) {
    return NextResponse.json({ message: "Fecha de vigencia invalida" }, { status: 400 });
  }

  const newFeeCents =
    typeof parsed.data.newFeeCents === "number"
      ? parsed.data.newFeeCents
      : calculateIpcAdjustedFeeCents({
          currentFeeCents: previousFeeCents,
          ipcPercent: parsed.data.ipcPercent ?? 0,
        });

  await db.auditLog.create({
    data: {
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: "saas_billing_fee_updated",
      entityType: "billing_config",
      metadataJson: {
        previousFeeCents,
        newFeeCents,
        ipcPercent: parsed.data.ipcPercent ?? null,
        effectiveFrom: effectiveFrom.toISOString(),
        reason: parsed.data.reason?.trim() || "Ajuste anual por IPC",
      },
    },
  });

  const snapshot = await getSaasMonthlyFeeSnapshot();
  const appliedNow = effectiveFrom <= new Date();

  return NextResponse.json({
    ok: true,
    previousFeeCents,
    monthlyFeeCents: newFeeCents,
    effectiveFrom: effectiveFrom.toISOString(),
    appliedNow,
    activeMonthlyFeeCents: snapshot.currentFeeCents,
    nextMonthlyFeeCents: snapshot.nextFeeCents,
    nextMonthlyFeeEffectiveFrom: snapshot.nextEffectiveFrom,
  });
}
