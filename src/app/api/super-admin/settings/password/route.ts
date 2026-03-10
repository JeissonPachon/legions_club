import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireSuperAdminApi } from "@/modules/super-admin/auth";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "La confirmacion no coincide con la nueva contrasena",
    path: ["confirmPassword"],
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "La nueva contrasena debe ser diferente a la actual",
    path: ["newPassword"],
  });

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi("Only super admins can change their password");
  if (auth instanceof Response) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { message: firstIssue?.message ?? "Payload invalido para cambio de contrasena" },
      { status: 400 },
    );
  }

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, passwordHash: true, tenantId: true },
  });

  if (!user) {
    return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 });
  }

  const validCurrentPassword = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!validCurrentPassword) {
    return NextResponse.json({ message: "La contrasena actual es incorrecta" }, { status: 401 });
  }

  const nextPasswordHash = await hashPassword(parsed.data.newPassword);

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { passwordHash: nextPasswordHash },
    }),
    db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: auth.userId,
        action: "super_admin_password_changed",
        entityType: "user_security",
        entityId: auth.userId,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, message: "Contrasena actualizada correctamente" });
}
