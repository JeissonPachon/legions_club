import { db } from "@/lib/db";
import { env } from "@/lib/env";

type FeeMetadata = {
  newFeeCents?: number;
  effectiveFrom?: string;
};

type FeeUpdateRow = {
  metadataJson: unknown;
  createdAt: Date;
};

export type SazasFeeSnapshot = {
  currentFeeCents: number;
  currentEffectiveFrom: string | null;
  nextFeeCents: number | null;
  nextEffectiveFrom: string | null;
};

function parseFeeUpdate(update: FeeUpdateRow) {
  const metadata = update.metadataJson as FeeMetadata | null;
  if (typeof metadata?.newFeeCents !== "number" || metadata.newFeeCents <= 0) {
    return null;
  }

  const effectiveAt = metadata.effectiveFrom ? new Date(metadata.effectiveFrom) : update.createdAt;
  if (Number.isNaN(effectiveAt.getTime())) {
    return null;
  }

  return {
    feeCents: metadata.newFeeCents,
    effectiveAt,
  };
}

export async function getSaasMonthlyFeeSnapshot(atDate: Date = new Date()): Promise<SazasFeeSnapshot> {
  const feeUpdates = await db.auditLog.findMany({
    where: {
      action: "saas_billing_fee_updated",
      entityType: "billing_config",
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      metadataJson: true,
      createdAt: true,
    },
  });

  let currentFeeCents = env.SAAS_MONTHLY_FEE_CENTS;
  let currentEffectiveFrom: string | null = null;
  let nextFeeCents: number | null = null;
  let nextEffectiveFrom: string | null = null;

  for (const update of feeUpdates) {
    const parsed = parseFeeUpdate(update);
    if (!parsed) {
      continue;
    }

    if (parsed.effectiveAt <= atDate) {
      currentFeeCents = parsed.feeCents;
      currentEffectiveFrom = parsed.effectiveAt.toISOString();
      break;
    }
  }

  for (const update of feeUpdates) {
    const parsed = parseFeeUpdate(update);
    if (!parsed) {
      continue;
    }

    if (parsed.effectiveAt > atDate) {
      if (!nextEffectiveFrom || parsed.effectiveAt.toISOString() < nextEffectiveFrom) {
        nextFeeCents = parsed.feeCents;
        nextEffectiveFrom = parsed.effectiveAt.toISOString();
      }
    }
  }

  return {
    currentFeeCents,
    currentEffectiveFrom,
    nextFeeCents,
    nextEffectiveFrom,
  };
}

export async function getCurrentSaasMonthlyFeeCents(atDate: Date = new Date()) {
  const snapshot = await getSaasMonthlyFeeSnapshot(atDate);
  return snapshot.currentFeeCents;
}

export function calculateIpcAdjustedFeeCents({
  currentFeeCents,
  ipcPercent,
  roundToCop = 100,
}: {
  currentFeeCents: number;
  ipcPercent: number;
  roundToCop?: number;
}) {
  const multiplier = 1 + ipcPercent / 100;
  const rawCop = (currentFeeCents / 100) * multiplier;
  const roundedCop = Math.round(rawCop / roundToCop) * roundToCop;
  return Math.max(100, roundedCop * 100);
}
