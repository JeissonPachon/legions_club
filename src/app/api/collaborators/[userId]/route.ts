import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/http/responses";
import { canManageCollaborators } from "@/modules/auth/roles";

const updateCollaboratorSchema = z.object({
  isActive: z.boolean(),
});

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  if (!canManageCollaborators(auth.role)) {
    return forbiddenResponse();
  }

  const body = await request.json().catch(() => null);
  const parsed = updateCollaboratorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Payload invalido" }, { status: 400 });
  }

  const { userId } = await context.params;
  if (userId === auth.userId && !parsed.data.isActive) {
    return NextResponse.json({ message: "No puedes desactivarte desde este modulo" }, { status: 400 });
  }

  const collaborator = await db.user.findFirst({
    where: {
      id: userId,
      tenantId: auth.tenantId,
      role: "coach",
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  if (!collaborator) {
    return NextResponse.json({ message: "Colaborador no encontrado" }, { status: 404 });
  }

  const updated = await db.$transaction(async (tx) => {
    const next = await tx.user.update({
      where: { id: collaborator.id },
      data: { isActive: parsed.data.isActive },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        action: parsed.data.isActive ? "collaborator_activated" : "collaborator_suspended",
        entityType: "user",
        entityId: next.id,
        metadataJson: {
          role: next.role,
          email: next.email,
          fullName: next.fullName,
        },
      },
    });

    return next;
  });

  return NextResponse.json({ collaborator: updated });
}