import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const DEFAULT_GLOBAL_REMINDER_TEMPLATE =
  "Recordatorio: tu mensualidad esta pendiente. Regulariza tu pago para evitar suspension del servicio.";

export type SuperAdminPlatformSettings = {
  graceDays: number;
  globalReminderTemplate: string;
  updatedAt: string | null;
};

type RawSettingsMetadata = {
  graceDays?: unknown;
  globalReminderTemplate?: unknown;
};

export async function getSuperAdminPlatformSettings(): Promise<SuperAdminPlatformSettings> {
  const latest = await db.auditLog.findFirst({
    where: {
      action: "super_admin_platform_settings_updated",
      entityType: "platform_config",
    },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      metadataJson: true,
    },
  });

  const metadata = (latest?.metadataJson ?? null) as RawSettingsMetadata | null;

  const graceDays =
    typeof metadata?.graceDays === "number" && Number.isInteger(metadata.graceDays) && metadata.graceDays >= 1
      ? metadata.graceDays
      : env.SAAS_GRACE_DAYS;

  const globalReminderTemplate =
    typeof metadata?.globalReminderTemplate === "string" && metadata.globalReminderTemplate.trim().length >= 4
      ? metadata.globalReminderTemplate.trim()
      : DEFAULT_GLOBAL_REMINDER_TEMPLATE;

  return {
    graceDays,
    globalReminderTemplate,
    updatedAt: latest?.createdAt.toISOString() ?? null,
  };
}
