import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSuperAdminApi } from "@/modules/super-admin/auth";

const updateTenantSchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
  legalName: z.string().min(2).optional(),
  displayName: z.string().min(2).optional(),
  discipline: z.enum(["gym", "powerlifting", "crossfit", "pilates", "hyrox", "mma", "other"]).optional(),
});

const deleteTenantSchema = z.object({
  verificationText: z.string().min(4),
});

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi("Only super admins can edit tenants");
  if (auth instanceof Response) {
    return auth;
  }

  const { tenantId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateTenantSchema.safeParse(body);

  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ message: "Payload invalido" }, { status: 400 });
  }

  const existing = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      slug: true,
      displayName: true,
      legalName: true,
      discipline: true,
      status: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ message: "Gimnasio no encontrado" }, { status: 404 });
  }

  if (existing.status === "archived") {
    return NextResponse.json({ message: "No se puede editar un gimnasio archivado" }, { status: 409 });
  }

  const nextSlug = parsed.data.slug?.toLowerCase();
  if (nextSlug && nextSlug !== existing.slug) {
    const slugTaken = await db.tenant.findUnique({ where: { slug: nextSlug }, select: { id: true } });
    if (slugTaken) {
      return NextResponse.json({ message: "El slug ya esta en uso" }, { status: 409 });
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.update({
      where: { id: existing.id },
      data: {
        slug: nextSlug,
        legalName: parsed.data.legalName,
        displayName: parsed.data.displayName,
        discipline: parsed.data.discipline,
      },
      select: {
        id: true,
        slug: true,
        displayName: true,
        legalName: true,
        discipline: true,
        status: true,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: existing.id,
        actorUserId: auth.userId,
        action: "tenant_profile_updated",
        entityType: "tenant",
        entityId: existing.id,
        metadataJson: {
          previous: {
            slug: existing.slug,
            displayName: existing.displayName,
            legalName: existing.legalName,
            discipline: existing.discipline,
          },
          next: {
            slug: tenant.slug,
            displayName: tenant.displayName,
            legalName: tenant.legalName,
            discipline: tenant.discipline,
          },
        },
      },
    });

    return tenant;
  });

  return NextResponse.json({ ok: true, tenant: updated });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi("Only super admins can delete tenants");
  if (auth instanceof Response) {
    return auth;
  }

  const { tenantId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = deleteTenantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Payload invalido" }, { status: 400 });
  }

  if (auth.tenantId === tenantId) {
    return NextResponse.json({ message: "No puedes eliminar el gimnasio de tu propia sesion" }, { status: 409 });
  }

  const existing = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true, displayName: true },
  });

  if (!existing) {
    return NextResponse.json({ message: "Gimnasio no encontrado" }, { status: 404 });
  }

  const expectedVerification = `ELIMINAR ${existing.slug}`;
  if (parsed.data.verificationText.trim() !== expectedVerification) {
    return NextResponse.json(
      { message: `Verificacion invalida. Debes escribir exactamente: ${expectedVerification}` },
      { status: 400 },
    );
  }

  try {
    await db.tenant.delete({ where: { id: existing.id } });
  } catch {
    return NextResponse.json(
      { message: "No fue posible eliminar el gimnasio. Intenta archivarlo y revisar dependencias." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, deletedTenantId: existing.id, deletedTenantName: existing.displayName });
}
