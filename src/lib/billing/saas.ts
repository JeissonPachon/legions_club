import dayjs from "dayjs";

type BillingCycleDates = {
  firstDueAt: Date;
  currentDueAt: Date | null;
  nextDueAt: Date;
};

export function getTenantBillingDates(createdAt: Date, now: Date = new Date()): BillingCycleDates {
  const nowD = dayjs(now);
  const firstDue = dayjs(createdAt).add(1, "month");

  if (nowD.isBefore(firstDue)) {
    return {
      firstDueAt: firstDue.toDate(),
      currentDueAt: null,
      nextDueAt: firstDue.toDate(),
    };
  }

  let currentDue = firstDue;
  while (currentDue.add(1, "month").isBefore(nowD) || currentDue.add(1, "month").isSame(nowD)) {
    currentDue = currentDue.add(1, "month");
  }

  return {
    firstDueAt: firstDue.toDate(),
    currentDueAt: currentDue.toDate(),
    nextDueAt: currentDue.add(1, "month").toDate(),
  };
}

export function getOverdueDays(currentDueAt: Date | null, paidThisCycle: boolean, now: Date = new Date()) {
  if (!currentDueAt || paidThisCycle) {
    return 0;
  }

  const diff = dayjs(now).diff(dayjs(currentDueAt), "day");
  return diff > 0 ? diff : 0;
}
