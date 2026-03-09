import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { forbiddenResponse } from "@/lib/http/responses";
import { requireGymManagementApi } from "@/modules/gym/auth";

const reminderSchema = z.object({
  message: z.string().min(4).max(280),
  channel: z.enum(["email", "whatsapp", "both"]),
  scope: z.enum(["current_tenant", "all_active_tenants"]).default("current_tenant"),
});

export async function POST(request: Request) {
  const auth = await requireGymManagementApi({ allowSuperAdmin: true });
  if (auth instanceof Response) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  const parsed = reminderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid reminder payload" }, { status: 400 });
  }

  if (parsed.data.scope === "all_active_tenants" && !auth.isSuperAdmin) {
    return forbiddenResponse("Only super admins can send reminders to all gyms");
  }

  const tenantIds =
    parsed.data.scope === "all_active_tenants"
      ? (
          await db.tenant.findMany({
            where: { status: "active" },
            select: { id: true },
          })
        ).map((tenant) => tenant.id)
      : [auth.tenantId];

  const users = await db.user.findMany({
    where: {
      tenantId: { in: tenantIds },
      isActive: true,
    },
    select: {
      id: true,
      tenantId: true,
      email: true,
      fullName: true,
    },
    take: 1000,
  });

  let emailSent = 0;
  let whatsappQueued = 0;

  if (parsed.data.channel === "email" || parsed.data.channel === "both") {
    if (process.env.NODE_ENV === "development" || env.SMTP_HOST.includes("example")) {
      emailSent = users.length;
    } else {
      const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: false,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });

      for (const user of users) {
        await transporter.sendMail({
          from: env.EMAIL_FROM,
          to: user.email,
          subject: "Recordatorio Legions Club",
          text: `${parsed.data.message}\n\nEquipo Legions Club`,
          html: `<p>${parsed.data.message}</p><p><strong>Equipo Legions Club</strong></p>`,
        });
        emailSent += 1;
      }
    }
  }

  if (parsed.data.channel === "whatsapp" || parsed.data.channel === "both") {
    const groupedByTenant = new Map<string, number>();
    for (const user of users) {
      groupedByTenant.set(user.tenantId, (groupedByTenant.get(user.tenantId) ?? 0) + 1);
    }

    await Promise.all(
      Array.from(groupedByTenant.entries()).map(([tenantId, recipients]) =>
        db.auditLog.create({
          data: {
            tenantId,
            actorUserId: auth.userId,
            action: "reminder_whatsapp_queued",
            entityType: "reminder_batch",
            metadataJson: {
              scope: parsed.data.scope,
              recipients,
              message: parsed.data.message,
            },
          },
        }),
      ),
    );

    whatsappQueued = users.length;
  }

  await db.auditLog.create({
    data: {
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: "reminder_batch_sent",
      entityType: "reminder_batch",
      metadataJson: {
        scope: parsed.data.scope,
        channel: parsed.data.channel,
        usersTargeted: users.length,
        emailSent,
        whatsappQueued,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    usersTargeted: users.length,
    emailSent,
    whatsappQueued,
    whatsappMode: "queued",
  });
}
