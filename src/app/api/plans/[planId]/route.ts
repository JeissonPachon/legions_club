import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireGymManagementApi } from "@/modules/gym/auth";

const updatePlanSchema = z.object({
  name: z.string().min(2).optional(),
  sessionsPerMonth: z.number().int().positive().optional(),
  durationDays: z.number().int().positive().optional(),
  priceCents: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  isActive: z.boolean().optional(),
});

type RouteContext = {
  params: Promise<{ planId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireGymManagementApi({
    forbiddenMessage: "Only staff can update plans",
  });
  if (auth instanceof Response) {
    return auth;
  }

  const { planId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updatePlanSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Payload invalido para actualizar el plan" }, { status: 400 });
  }

  const existing = await db.plan.findFirst({
    where: {
      id: planId,
      tenantId: auth.tenantId,
    },
  });

  if (!existing) {
    return NextResponse.json({ message: "Plan no encontrado" }, { status: 404 });
  }

  const plan = await db.plan.update({
    where: { id: existing.id },
    data: {
      ...parsed.data,
      currency: parsed.data.currency?.toUpperCase(),
    },
  });

  return NextResponse.json({ plan });
}

export async function DELETE(_: Request, context: RouteContext) {
  const auth = await requireGymManagementApi({
    forbiddenMessage: "Only staff can delete plans",
  });
  if (auth instanceof Response) {
    return auth;
  }

  const { planId } = await context.params;

  const existing = await db.plan.findFirst({
    where: {
      id: planId,
      tenantId: auth.tenantId,
    },
  });

  if (!existing) {
    return NextResponse.json({ message: "Plan no encontrado" }, { status: 404 });
  }

  await db.plan.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}