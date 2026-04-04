import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireGymManagementApi } from "@/modules/gym/auth";

const createSchema = z.object({
  measuredAt: z.string().optional(),
  weightKg: z.number().optional(),
  heightCm: z.number().optional(),
  bodyFatPercent: z.number().optional(),
  cinturaCm: z.number().optional(),
  caderaCm: z.number().optional(),
  pechoCm: z.number().optional(),
  brazoDerechoCm: z.number().optional(),
  brazoIzquierdoCm: z.number().optional(),
  antebrazoDerechoCm: z.number().optional(),
  antebrazoIzquierdoCm: z.number().optional(),
  piernaDerechaCm: z.number().optional(),
  piernaIzquierdaCm: z.number().optional(),
  pantorrillaDerechaCm: z.number().optional(),
  pantorrillaIzquierdaCm: z.number().optional(),
  notas: z.string().optional(),
  fotosJson: z.any().optional(),
});

type RouteContext = {
  params: Promise<{ memberId: string }>;
};

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
  fotos_json: unknown;
  created_at: Date;
};

export async function GET(_: Request, context: RouteContext) {
  const auth = await requireGymManagementApi();
  if (auth instanceof Response) return auth;

  const { memberId } = await context.params;

  const measurements = await db.anthropometric.findMany({
    where: {
      tenant_id: auth.tenantId,
      member_id: memberId,
    },
    orderBy: { measured_at: "desc" },
    take: 200,
  });

  const normalized = (measurements as AnthropometricRow[]).map((m) => ({
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
    fotosJson: m.fotos_json,
    createdAt: m.created_at,
  }));

  return NextResponse.json({ measurements: normalized });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireGymManagementApi();
  if (auth instanceof Response) return auth;

  const { memberId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: "Invalid payload" }, { status: 400 });

  const member = await db.member.findFirst({ where: { id: memberId, tenantId: auth.tenantId, deletedAt: null } });
  if (!member) return NextResponse.json({ message: "Member not found" }, { status: 404 });

  const created = await db.anthropometric.create({
    data: {
      tenant_id: auth.tenantId,
      member_id: memberId,
      measured_at: parsed.data.measuredAt ? new Date(parsed.data.measuredAt) : undefined,
      weight_kg: parsed.data.weightKg,
      height_cm: parsed.data.heightCm,
      body_fat_percent: parsed.data.bodyFatPercent,
      cintura_cm: parsed.data.cinturaCm,
      cadera_cm: parsed.data.caderaCm,
      pecho_cm: parsed.data.pechoCm,
      brazo_derecho_cm: parsed.data.brazoDerechoCm,
      brazo_izquierdo_cm: parsed.data.brazoIzquierdoCm,
      antebrazo_derecho_cm: parsed.data.antebrazoDerechoCm,
      antebrazo_izquierdo_cm: parsed.data.antebrazoIzquierdoCm,
      pierna_derecha_cm: parsed.data.piernaDerechaCm,
      pierna_izquierda_cm: parsed.data.piernaIzquierdaCm,
      pantorrilla_derecha_cm: parsed.data.pantorrillaDerechaCm,
      pantorrilla_izquierda_cm: parsed.data.pantorrillaIzquierdaCm,
      notas: parsed.data.notas,
      fotos_json: parsed.data.fotosJson,
    },
  });

  return NextResponse.json({ measurement: created }, { status: 201 });
}
