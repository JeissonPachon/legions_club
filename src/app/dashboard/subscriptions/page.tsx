"use client";

import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGymManagementPageGuard } from "@/components/dashboard/use-gym-management-page-guard";

type Subscription = {
  id: string;
  status: string;
  sessionsRemaining: number;
  startDate: string;
  endDate: string;
  member: { fullName: string; documentLast4: string };
  plan: { name: string };
};

type StatusFilter = "all" | "active" | "paused" | "canceled" | "expired";

async function fetchSubscriptions(month: string, status: StatusFilter): Promise<{ subscriptions: Subscription[] }> {
  const params = new URLSearchParams({ month });
  if (status !== "all") {
    params.set("status", status);
  }

  const response = await fetch(`/api/subscriptions?${params.toString()}`);
  if (!response.ok) {
    throw new Error("No fue posible cargar las suscripciones");
  }
  return response.json() as Promise<{ subscriptions: Subscription[] }>;
}

export default function SubscriptionsPage() {
  const { isCheckingAccess, error } = useGymManagementPageGuard();
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format("YYYY-MM"));
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("all");

  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }).map((_, index) => {
      const month = dayjs().subtract(index, "month");
      return {
        value: month.format("YYYY-MM"),
        label: month.format("MMMM YYYY"),
      };
    });
  }, []);

  const subscriptionsQuery = useQuery({
    queryKey: ["subscriptions", selectedMonth, selectedStatus],
    queryFn: () => fetchSubscriptions(selectedMonth, selectedStatus),
  });

  const selectedMonthLabel = dayjs(`${selectedMonth}-01`).format("MMMM YYYY");

  if (error) {
    return <p className="text-sm text-destructive">No fue posible validar permisos de acceso.</p>;
  }

  if (isCheckingAccess) {
    return <p className="text-sm text-muted-foreground">Verificando acceso...</p>;
  }

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Suscripciones por mes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
            <Label htmlFor="subscriptions-month">Mes</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger id="subscriptions-month" className="w-full sm:w-[260px]">
                <SelectValue placeholder="Selecciona un mes" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="subscriptions-status">Estado</Label>
              <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as StatusFilter)}>
                <SelectTrigger id="subscriptions-status" className="w-full sm:w-[260px]">
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activas</SelectItem>
                  <SelectItem value="paused">Pausadas</SelectItem>
                  <SelectItem value="canceled">Canceladas</SelectItem>
                  <SelectItem value="expired">Vencidas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            El plan se aplica en el proceso de registro del miembro. Esta vista es solo para consulta y seguimiento.
          </p>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Suscripciones de {selectedMonthLabel}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {subscriptionsQuery.isLoading ? <p>Cargando suscripciones...</p> : null}
          {!subscriptionsQuery.isLoading && (subscriptionsQuery.data?.subscriptions.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No hay suscripciones registradas en este mes.</p>
          ) : null}
          {subscriptionsQuery.data?.subscriptions.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div>
                <p className="font-medium">{item.member.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.plan.name} · Restantes {item.sessionsRemaining}
                </p>
                <p className="text-xs text-muted-foreground">
                  Inicio {dayjs(item.startDate).format("DD/MM/YYYY")} · Fin {dayjs(item.endDate).format("DD/MM/YYYY")}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{item.status}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
