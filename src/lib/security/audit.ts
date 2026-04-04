import { db } from "@/lib/db";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

type WriteAuditLogInput = {
  tenantId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, JsonValue>;
};

export async function writeAuditLog(input: WriteAuditLogInput) {
  await db.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadataJson: input.metadata,
    },
  });
}