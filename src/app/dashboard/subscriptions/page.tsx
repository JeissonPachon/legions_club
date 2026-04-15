"use client";

import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGymManagementPageGuard } from "@/components/dashboard/use-gym-management-page-guard";
import { QrShareActions } from "@/components/qr/qr-share-actions";

type Subscription = {
  id: string;
  status: string;
  sessionsRemaining: number;
  startDate: string;
  endDate: string;
  member: { id: string; fullName: string; documentLast4: string };
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
  const queryClient = useQueryClient();
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

  const updateStatusMutation = useMutation({
    mutationFn: async ({ subscriptionId, isActive }: { subscriptionId: string; isActive: boolean }) => {
      const response = await fetch("/api/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId,
          isActive,
          reason: isActive
            ? "Reactivacion manual desde panel de suscripciones"
            : "Desactivacion manual para control administrativo",
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible actualizar el estado de la suscripcion");
      }

      return payload;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
    },
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
            Puedes activar o desactivar suscripciones para mantener datos operativos correctos en reportes y paneles.
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
              <div className="flex flex-col items-end gap-2">
                <span className="text-xs text-muted-foreground">{item.status}</span>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={item.status === "active" ? "destructive" : "default"}
                    disabled={updateStatusMutation.isPending}
                    onClick={() =>
                      updateStatusMutation.mutate({
                        subscriptionId: item.id,
                        isActive: item.status !== "active",
                      })
                    }
                  >
                    {item.status === "active" ? "Desactivar" : "Activar"}
                  </Button>
                  <QrShareActions
                    qrImageUrl={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(item.member.id)}`}
                  />
                </div>
              </div>
            </div>
          ))}
          {updateStatusMutation.isError ? (
            <p className="text-sm text-destructive">{updateStatusMutation.error.message}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
