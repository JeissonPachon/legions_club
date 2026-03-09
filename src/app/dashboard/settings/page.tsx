"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useGymManagementPageGuard } from "@/components/dashboard/use-gym-management-page-guard";

type Plan = {
  id: string;
  name: string;
  sessionsPerMonth: number;
  durationDays: number;
  priceCents: number;
  currency: string;
  isActive: boolean;
};

type EditablePlan = {
  name: string;
  sessionsPerMonth: string;
  durationDays: string;
  priceCOP: string;
  currency: string;
  isActive: boolean;
};

function toPositiveInt(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function copToCents(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

async function fetchPlans(): Promise<{ plans: Plan[] }> {
  const response = await fetch("/api/plans");
  if (!response.ok) {
    throw new Error("No fue posible cargar los planes");
  }
  return response.json() as Promise<{ plans: Plan[] }>;
}

export default function SettingsPage() {
  const { isCheckingAccess, error } = useGymManagementPageGuard();
  const [name, setName] = useState("");
  const [sessionsPerMonth, setSessionsPerMonth] = useState("12");
  const [durationDays, setDurationDays] = useState("30");
  const [priceCOP, setPriceCOP] = useState("89000");
  const [editablePlans, setEditablePlans] = useState<Record<string, EditablePlan>>({});
  const queryClient = useQueryClient();

  const plansQuery = useQuery({ queryKey: ["plans"], queryFn: fetchPlans });

  const createPlan = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sessionsPerMonth: Number(sessionsPerMonth),
          durationDays: Number(durationDays),
          priceCents: Math.round(Number(priceCOP) * 100),
          currency: "COP",
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible crear el plan");
      }
      return payload;
    },
    onSuccess: () => {
      setName("");
      setSessionsPerMonth("12");
      setDurationDays("30");
      setPriceCOP("89000");
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });

  const updatePlan = useMutation({
    mutationFn: async (input: { id: string; data: EditablePlan }) => {
      const payloadName = input.data.name.trim();
      const payloadCurrency = input.data.currency.trim().toUpperCase();
      const payloadSessionsPerMonth = toPositiveInt(input.data.sessionsPerMonth);
      const payloadDurationDays = toPositiveInt(input.data.durationDays);
      const payloadPriceCents = copToCents(input.data.priceCOP);

      if (payloadName.length < 2) {
        throw new Error("El nombre del plan debe tener al menos 2 caracteres");
      }

      if (payloadSessionsPerMonth === null) {
        throw new Error("Las sesiones por mes deben ser un numero entero mayor a 0");
      }

      if (payloadDurationDays === null) {
        throw new Error("La duracion en dias debe ser un numero entero mayor a 0");
      }

      if (payloadPriceCents === null) {
        throw new Error("El precio en COP debe ser un numero mayor o igual a 0");
      }

      if (payloadCurrency.length !== 3) {
        throw new Error("La moneda debe tener 3 letras (ejemplo: COP)");
      }

      const response = await fetch(`/api/plans/${input.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payloadName,
          sessionsPerMonth: payloadSessionsPerMonth,
          durationDays: payloadDurationDays,
          priceCents: payloadPriceCents,
          currency: payloadCurrency,
          isActive: input.data.isActive,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible actualizar el plan");
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });

  function formatCOP(amountCents: number) {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amountCents / 100);
  }

  function getEditablePlan(plan: Plan): EditablePlan {
    return (
      editablePlans[plan.id] ?? {
        name: plan.name,
        sessionsPerMonth: String(plan.sessionsPerMonth),
        durationDays: String(plan.durationDays),
        priceCOP: String(plan.priceCents / 100),
        currency: plan.currency,
        isActive: plan.isActive,
      }
    );
  }

  function patchEditablePlan(plan: Plan, patch: Partial<EditablePlan>) {
    setEditablePlans((current) => ({
      ...current,
      [plan.id]: {
        ...(current[plan.id] ?? {
          name: plan.name,
          sessionsPerMonth: String(plan.sessionsPerMonth),
          durationDays: String(plan.durationDays),
          priceCOP: String(plan.priceCents / 100),
          currency: plan.currency,
          isActive: plan.isActive,
        }),
        ...patch,
      },
    }));
  }

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
          <CardTitle>Crear plan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="plan-name">Nombre</Label>
            <Input id="plan-name" placeholder="Ejemplo: Plan mensual" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="plan-sessions">Sesiones por mes</Label>
            <Input
              id="plan-sessions"
              placeholder="Ejemplo: 12"
              value={sessionsPerMonth}
              onChange={(event) => setSessionsPerMonth(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="plan-duration">Duracion en dias</Label>
            <Input
              id="plan-duration"
              placeholder="Ejemplo: 30"
              value={durationDays}
              onChange={(event) => setDurationDays(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="plan-price">Precio mensual real (COP)</Label>
            <Input
              id="plan-price"
              placeholder="Ejemplo: 89000"
              inputMode="numeric"
              value={priceCOP}
              onChange={(event) => setPriceCOP(event.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>
          <Button
            className="sm:col-span-4"
            onClick={() => createPlan.mutate()}
            disabled={createPlan.isPending || name.length < 2}
          >
            {createPlan.isPending ? "Guardando..." : "Crear plan"}
          </Button>
          {createPlan.isError ? (
            <p className="sm:col-span-4 text-sm text-destructive">{createPlan.error.message}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Planes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {plansQuery.isLoading ? <p>Cargando planes...</p> : null}
          {plansQuery.isError ? <p className="text-destructive">No fue posible cargar los planes.</p> : null}
          {plansQuery.data?.plans.map((plan) => (
            <div key={plan.id} className="space-y-3 rounded-md border p-3">
              <div className="grid gap-2 sm:grid-cols-5">
                <div className="space-y-1">
                  <Label className="text-xs">Nombre</Label>
                  <Input
                    value={getEditablePlan(plan).name}
                    onChange={(event) => patchEditablePlan(plan, { name: event.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sesiones/mes</Label>
                  <Input
                    value={getEditablePlan(plan).sessionsPerMonth}
                    onChange={(event) => patchEditablePlan(plan, { sessionsPerMonth: event.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Duracion</Label>
                  <Input
                    value={getEditablePlan(plan).durationDays}
                    onChange={(event) => patchEditablePlan(plan, { durationDays: event.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Precio mensual (COP)</Label>
                  <Input
                    inputMode="numeric"
                    value={getEditablePlan(plan).priceCOP}
                    onChange={(event) =>
                      patchEditablePlan(plan, { priceCOP: event.target.value.replace(/[^0-9]/g, "") })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Moneda</Label>
                  <Input
                    value={getEditablePlan(plan).currency}
                    onChange={(event) => patchEditablePlan(plan, { currency: event.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    patchEditablePlan(plan, { isActive: !getEditablePlan(plan).isActive })
                  }
                >
                  {getEditablePlan(plan).isActive ? "Desactivar" : "Activar"}
                </Button>
                <Button
                  onClick={() => updatePlan.mutate({ id: plan.id, data: getEditablePlan(plan) })}
                  disabled={updatePlan.isPending}
                >
                  Guardar cambios
                </Button>
                <span className="text-xs text-muted-foreground">
                  Vista previa: {formatCOP(copToCents(getEditablePlan(plan).priceCOP) ?? 0)} · {getEditablePlan(plan).isActive ? "Activo" : "Inactivo"}
                </span>
              </div>
            </div>
          ))}
          {updatePlan.isError ? <p className="text-sm text-destructive">{updatePlan.error.message}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}