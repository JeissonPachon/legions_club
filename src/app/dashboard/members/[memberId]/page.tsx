import { redirect } from "next/navigation";
import MeasurementsClient from "./measurements-client";
import { getAuthContext } from "@/lib/auth/server";
import { canManageGym } from "@/modules/auth/roles";
import { db } from "@/lib/db";

type Props = {
  params: { memberId: string };
};

export default async function MemberMeasurementsPage({ params }: Props) {
  const auth = await getAuthContext();
  if (!auth) redirect("/auth/login");
  if (!canManageGym(auth.role)) redirect("/dashboard");

  const member = await db.member.findFirst({ where: { id: params.memberId, tenantId: auth.tenantId, deletedAt: null }, select: { id: true, fullName: true } });
  if (!member) redirect("/dashboard/members");

  return <MeasurementsClient memberId={member.id} memberName={member.fullName} />;
}
