import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/auth/server";
import { unauthorizedResponse } from "@/lib/http/responses";

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  const todayStart = dayjs().startOf("day").toDate();

  const [activeAthletes, activeSubscriptions, todayCheckIns] = await Promise.all([
    db.member.count({ where: { tenantId: auth.tenantId, isActive: true, deletedAt: null } }),
    db.subscription.count({
      where: {
        tenantId: auth.tenantId,
        status: "active",
        endDate: { gte: new Date() },
      },
    }),
    db.attendanceEvent.count({
      where: {
        tenantId: auth.tenantId,
        eventType: "check_in",
        createdAt: { gte: todayStart },
      },
    }),
  ]);

  return NextResponse.json({
    activeAthletes,
    activeSubscriptions,
    todayCheckIns,
  });
}