import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type AnthropometricRow = {
  id: string;
  measured_at: Date;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_percent: number | null;
  cintura_cm: number | null;
  cadera_cm: number | null;
  pecho_cm: number | null;
  brazo_derecho_cm: number | null;
  brazo_izquierdo_cm: number | null;
  antebrazo_derecho_cm: number | null;
  antebrazo_izquierdo_cm: number | null;
  pierna_derecha_cm: number | null;
  pierna_izquierda_cm: number | null;
  pantorrilla_derecha_cm: number | null;
  pantorrilla_izquierda_cm: number | null;
  notas: string | null;
};

export async function POST(req: Request) {
  const { userId, tenantId } = await req.json();
  if (!userId || !tenantId) return NextResponse.json({ message: "Faltan datos" }, { status: 400 });

  // Buscar miembro por userId y tenantId (no direct users relation in schema)
  const member = await db.member.findFirst({ where: { tenantId, isActive: true } });
  // Si no hay relación directa, buscar por email (legacy)
  let memberId = member?.id;
  if (!memberId) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
    if (user?.email) {
      const m = await db.member.findFirst({ where: { tenantId, emailHash: user.email } });
      memberId = m?.id;
    }
  }
  if (!memberId) return NextResponse.json({ message: "No se encontró el miembro" }, { status: 404 });

  // Medidas antropométricas
  const anthropometrics = await db.anthropometric.findMany({
    where: { member_id: memberId },
    orderBy: { measured_at: "desc" },
  });

  // Obtener nombre del gym (tenant)
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { displayName: true } });

  // Subscripción activa
  const subscription = await db.subscription.findFirst({
    where: {
      memberId,
      status: "active",
      endDate: { gte: new Date() },
    },
    include: { plan: true },
    orderBy: { endDate: "desc" },
  });

  return NextResponse.json({
    member: { id: memberId },
    anthropometrics: (anthropometrics as AnthropometricRow[]).map((m) => ({
      id: m.id,
      measuredAt: m.measured_at,
      weightKg: m.weight_kg,
      heightCm: m.height_cm,
      bodyFatPercent: m.body_fat_percent,
      cinturaCm: m.cintura_cm,
      caderaCm: m.cadera_cm,
      pechoCm: m.pecho_cm,
      brazoDerechoCm: m.brazo_derecho_cm,
      brazoIzquierdoCm: m.brazo_izquierdo_cm,
      antebrazoDerechoCm: m.antebrazo_derecho_cm,
      antebrazoIzquierdoCm: m.antebrazo_izquierdo_cm,
      piernaDerechaCm: m.pierna_derecha_cm,
      piernaIzquierdaCm: m.pierna_izquierda_cm,
      pantorrillaDerechaCm: m.pantorrilla_derecha_cm,
      pantorrillaIzquierdaCm: m.pantorrilla_izquierda_cm,
      notes: m.notas,
    })),
    subscription: subscription
      ? {
          planName: subscription.plan?.name,
          endDate: subscription.endDate,
          sessionsRemaining: subscription.sessionsRemaining,
        }
      : null,
    gymName: tenant?.displayName ?? null,
  });
}
