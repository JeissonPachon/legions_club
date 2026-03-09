"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { canManageGym } from "@/modules/auth/roles";

type MePayload = {
  user: {
    role: "owner" | "manager" | "coach" | "athlete";
    isSuperAdmin: boolean;
  };
};

async function fetchMe(): Promise<MePayload | null> {
  const response = await fetch("/api/auth/me");
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error("No fue posible validar el acceso");
  }

  return (await response.json()) as MePayload;
}

export function useGymManagementPageGuard() {
  const router = useRouter();
  const meQuery = useQuery({
    queryKey: ["auth-me"],
    queryFn: fetchMe,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (meQuery.isLoading) {
      return;
    }

    const me = meQuery.data;
    if (!me) {
      router.replace("/auth/login");
      return;
    }

    if (me.user.isSuperAdmin) {
      router.replace("/dashboard/super-admin");
      return;
    }

    if (!canManageGym(me.user.role)) {
      router.replace("/dashboard/gym");
    }
  }, [meQuery.data, meQuery.isLoading, router]);

  const isCheckingAccess =
    meQuery.isLoading ||
    !meQuery.data ||
    meQuery.data.user.isSuperAdmin ||
    !canManageGym(meQuery.data.user.role);

  return {
    isCheckingAccess,
    error: meQuery.error,
  };
}
