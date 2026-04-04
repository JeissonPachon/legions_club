import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireGymManagementApi } from "@/modules/gym/auth";

const updateSchema = z.object({
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
  notes: z.string().optional(),
  photosJson: z.any().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const auth = await requireGymManagementApi();
  if (auth instanceof Response) return auth;

  const { id } = await context.params;

  const measurement = await db.anthropometric.findFirst({
    where: {
      id,
      tenant_id: auth.tenantId,
    },
  });

  if (!measurement) return NextResponse.json({ message: "Not found" }, { status: 404 });

  return NextResponse.json({ measurement });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireGymManagementApi();
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: "Invalid payload" }, { status: 400 });

  const existing = await db.anthropometric.findFirst({ where: { id, tenant_id: auth.tenantId } });
  if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const updated = await db.anthropometric.update({
    where: { id: existing.id },
    data: {
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
      notas: parsed.data.notes,
      fotos_json: parsed.data.photosJson,
    },
  });

  return NextResponse.json({ measurement: updated });
}

export async function DELETE(_: Request, context: RouteContext) {
  const auth = await requireGymManagementApi();
  if (auth instanceof Response) return auth;

  const { id } = await context.params;

  const existing = await db.anthropometric.findFirst({ where: { id, tenant_id: auth.tenantId } });
  if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });

  await db.anthropometric.delete({ where: { id: existing.id } });

  return NextResponse.json({ ok: true });
}
