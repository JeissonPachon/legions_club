import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSuperAdminApi } from "@/modules/super-admin/auth";
import { getSuperAdminPlatformSettings } from "@/modules/super-admin/settings";

const updateSettingsSchema = z.object({
  graceDays: z.number().int().min(1).max(45),
  globalReminderTemplate: z.string().min(4).max(280),
});

export async function GET() {
  const auth = await requireSuperAdminApi("Only super admins can access platform settings");
  if (auth instanceof Response) {
    return auth;
  }

  const settings = await getSuperAdminPlatformSettings();
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi("Only super admins can update platform settings");
  if (auth instanceof Response) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid platform settings payload" }, { status: 400 });
  }

  await db.auditLog.create({
    data: {
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: "super_admin_platform_settings_updated",
      entityType: "platform_config",
      metadataJson: {
        graceDays: parsed.data.graceDays,
        globalReminderTemplate: parsed.data.globalReminderTemplate.trim(),
      },
    },
  });

  const settings = await getSuperAdminPlatformSettings();
  return NextResponse.json({ ok: true, settings });
}
