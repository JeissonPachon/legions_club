import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth/server";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/http/responses";
import { canManageCollaborators } from "@/modules/auth/roles";

const createCollaboratorSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  if (!canManageCollaborators(auth.role)) {
    return forbiddenResponse();
  }

  const collaborators = await db.user.findMany({
    where: {
      tenantId: auth.tenantId,
      role: "coach",
    },
    orderBy: { createdAt: "desc" },
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

  return NextResponse.json({ collaborators });
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  if (!canManageCollaborators(auth.role)) {
    return forbiddenResponse();
  }

  const body = await request.json().catch(() => null);
  const parsed = createCollaboratorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Payload invalido para colaborador" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();

  const existing = await db.user.findFirst({
    where: {
      tenantId: auth.tenantId,
      email,
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ message: "Ya existe un usuario con ese correo" }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const collaborator = await db.$transaction(async (tx: any) => {
    const created = await tx.user.create({
      data: {
        tenantId: auth.tenantId,
        role: "coach",
        fullName: parsed.data.fullName.trim(),
        email,
        passwordHash,
        phoneHash: "",
        phoneEnc: "",
        isActive: true,
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

    await tx.auditLog.create({
      data: {
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        action: "collaborator_created",
        entityType: "user",
        entityId: created.id,
        metadataJson: {
          role: created.role,
          email: created.email,
          fullName: created.fullName,
        },
      },
    });

    return created;
  });

  return NextResponse.json({ collaborator }, { status: 201 });
}