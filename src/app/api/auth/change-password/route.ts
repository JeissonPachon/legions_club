import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "La confirmacion no coincide con la nueva contrasena",
    path: ["confirmPassword"],
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "La nueva contrasena debe ser diferente a la actual",
    path: ["newPassword"],
  });

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ message: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ message: first?.message ?? "Payload invalido" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: auth.userId }, select: { id: true, passwordHash: true, tenantId: true } });
  if (!user) return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 });

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return NextResponse.json({ message: "La contrasena actual es incorrecta" }, { status: 401 });

  const nextHash = await hashPassword(parsed.data.newPassword);

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: nextHash } }),
    db.auditLog.create({ data: { tenantId: user.tenantId, actorUserId: auth.userId, action: "user_password_changed", entityType: "user_security", entityId: auth.userId } }),
  ]);

  return NextResponse.json({ ok: true, message: "Contrasena actualizada correctamente" });
}
