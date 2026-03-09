import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireGymManagementApi } from "@/modules/gym/auth";

const createPlanSchema = z.object({
  name: z.string().min(2),
  sessionsPerMonth: z.number().int().positive(),
  durationDays: z.number().int().positive(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3).default("COP"),
});

export async function GET() {
  const auth = await requireGymManagementApi();
  if (auth instanceof Response) {
    return auth;
  }

  const plans = await db.plan.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ plans });
}

export async function POST(request: Request) {
  const auth = await requireGymManagementApi();
  if (auth instanceof Response) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  const parsed = createPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Payload invalido para crear el plan" }, { status: 400 });
  }

  const plan = await db.plan.create({
    data: {
      tenantId: auth.tenantId,
      name: parsed.data.name,
      sessionsPerMonth: parsed.data.sessionsPerMonth,
      durationDays: parsed.data.durationDays,
      priceCents: parsed.data.priceCents,
      currency: parsed.data.currency.toUpperCase(),
    },
  });

  return NextResponse.json({ plan }, { status: 201 });
}