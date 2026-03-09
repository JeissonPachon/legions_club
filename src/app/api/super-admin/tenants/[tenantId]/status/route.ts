import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSuperAdminApi } from "@/modules/super-admin/auth";

const updateStatusSchema = z.object({
  status: z.enum(["active", "suspended", "archived"]),
  reason: z.string().min(3).max(220).optional(),
});

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi("Only super admins can update tenant status");
  if (auth instanceof Response) {
    return auth;
  }

  const { tenantId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Payload invalido" }, { status: 400 });
  }

  const existing = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      status: true,
      displayName: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ message: "Gimnasio no encontrado" }, { status: 404 });
  }

  if (existing.status === "archived" && parsed.data.status !== "archived") {
    return NextResponse.json({ message: "No se puede modificar un gimnasio archivado" }, { status: 409 });
  }

  if (existing.status === parsed.data.status) {
    return NextResponse.json({
      ok: true,
      tenant: {
        id: existing.id,
        displayName: existing.displayName,
        status: existing.status,
      },
    });
  }

  const action =
    parsed.data.status === "active"
      ? "tenant_manually_activated"
      : parsed.data.status === "suspended"
        ? "tenant_manually_suspended"
        : "tenant_manually_archived";

  await db.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: existing.id },
      data: {
        status: parsed.data.status,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: existing.id,
        actorUserId: auth.userId,
        action,
        entityType: "tenant",
        entityId: existing.id,
        metadataJson: {
          previousStatus: existing.status,
          newStatus: parsed.data.status,
          reason:
            parsed.data.reason?.trim() ||
            (parsed.data.status === "archived"
              ? "Archivado manual desde panel super admin"
              : "Cambio manual desde panel super admin"),
        },
      },
    });
  });

  return NextResponse.json({
    ok: true,
    tenant: {
      id: existing.id,
      displayName: existing.displayName,
      status: parsed.data.status,
    },
  });
}
