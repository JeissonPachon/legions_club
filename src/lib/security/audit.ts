import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

type WriteAuditLogInput = {
  tenantId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(input: WriteAuditLogInput) {
  await db.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadataJson: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}