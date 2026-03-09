import dayjs from "dayjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireGymManagementApi } from "@/modules/gym/auth";
import type { Prisma } from "@prisma/client";

const createFinanceEntrySchema = z.object({
  entryType: z.enum(["income", "expense"]),
  amountCents: z.number().int().positive(),
  category: z.string().min(2).max(50),
  note: z.string().max(250).optional(),
  occurredAt: z.string().datetime().optional(),
});

type FinanceEntry = {
  id: string;
  entryType: "income" | "expense";
  amountCents: number;
  category: string;
  note: string | null;
  occurredAt: string;
  createdAt: string;
  actorUserId: string;
};

function toFinanceEntry(log: {
  id: string;
  action: string;
  actorUserId: string;
  metadataJson: Prisma.JsonValue | null;
  createdAt: Date;
}): FinanceEntry | null {
  if (!log.metadataJson || typeof log.metadataJson !== "object" || Array.isArray(log.metadataJson)) {
    return null;
  }

  const metadata = log.metadataJson as Record<string, unknown>;
  const entryType = metadata.entryType;
  const amountCents = metadata.amountCents;
  const category = metadata.category;
  const note = metadata.note;
  const occurredAt = metadata.occurredAt;

  if ((entryType !== "income" && entryType !== "expense") || typeof amountCents !== "number") {
    return null;
  }

  return {
    id: log.id,
    entryType,
    amountCents,
    category: typeof category === "string" ? category : "other",
    note: typeof note === "string" ? note : null,
    occurredAt: typeof occurredAt === "string" ? occurredAt : log.createdAt.toISOString(),
    createdAt: log.createdAt.toISOString(),
    actorUserId: log.actorUserId,
  };
}

export async function GET() {
  const auth = await requireGymManagementApi({ forbiddenMessage: "Only staff can view gym finance" });
  if (auth instanceof Response) {
    return auth;
  }

  const logs = await db.auditLog.findMany({
    where: {
      tenantId: auth.tenantId,
      action: { in: ["finance_income", "finance_expense"] },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const entries = logs.map(toFinanceEntry).filter((entry): entry is FinanceEntry => entry !== null);

  const monthStart = dayjs().startOf("month");
  const monthEntries = entries.filter((entry) => dayjs(entry.occurredAt).isAfter(monthStart.subtract(1, "millisecond")));

  const monthIncomeCents = monthEntries
    .filter((entry) => entry.entryType === "income")
    .reduce((acc, entry) => acc + entry.amountCents, 0);

  const monthExpenseCents = monthEntries
    .filter((entry) => entry.entryType === "expense")
    .reduce((acc, entry) => acc + entry.amountCents, 0);

  return NextResponse.json({
    entries,
    summary: {
      monthIncomeCents,
      monthExpenseCents,
      monthNetCents: monthIncomeCents - monthExpenseCents,
      entriesCount: entries.length,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireGymManagementApi({ forbiddenMessage: "Only staff can register finance entries" });
  if (auth instanceof Response) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  const parsed = createFinanceEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid finance payload" }, { status: 400 });
  }

  const occurredAt = parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date();

  const log = await db.auditLog.create({
    data: {
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: parsed.data.entryType === "income" ? "finance_income" : "finance_expense",
      entityType: "finance_entry",
      metadataJson: {
        entryType: parsed.data.entryType,
        amountCents: parsed.data.amountCents,
        category: parsed.data.category,
        note: parsed.data.note ?? null,
        occurredAt: occurredAt.toISOString(),
      },
    },
  });

  return NextResponse.json({ ok: true, id: log.id }, { status: 201 });
}
