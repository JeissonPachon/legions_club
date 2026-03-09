"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BillingTenant = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantStatus: "active" | "suspended" | "archived";
  ownerName: string | null;
  ownerEmail: string | null;
  createdAt: string;
  firstDueAt: string;
  currentDueAt: string | null;
  nextDueAt: string;
  amountCents: number;
  billingStatus: "upcoming" | "paid" | "overdue";
  paidThisCycle: boolean;
  overdueDays: number;
  lastReminderAt: string | null;
};

type BillingSummary = {
  monthlyFeeCents: number;
  monthlyFeeEffectiveFrom: string | null;
  nextMonthlyFeeCents: number | null;
  nextMonthlyFeeEffectiveFrom: string | null;
  projectedMrrCents: number;
  collectedThisMonthCents: number;
  overdueTenants: number;
  suspendedTenants: number;
  tenants: BillingTenant[];
};

function formatCOP(amountCents: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

async function fetchSummary(): Promise<BillingSummary> {
  const response = await fetch("/api/super-admin/billing/summary");
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message ?? "No fue posible cargar finanzas SaaS");
  }

  return payload as BillingSummary;
}

export function SuperAdminFinancePanel() {
  const queryClient = useQueryClient();
  const [noteByTenant, setNoteByTenant] = useState<Record<string, string>>({});
  const [newMonthlyFeeDraft, setNewMonthlyFeeDraft] = useState<string | null>(null);
  const [ipcPercent, setIpcPercent] = useState("");
  const [defaultEffectiveFrom] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [effectiveFromDraft, setEffectiveFromDraft] = useState<string | null>(null);
  const [feeReason, setFeeReason] = useState("Ajuste anual por costos y normativa local");

  const summaryQuery = useQuery({
    queryKey: ["super-admin-billing-summary"],
    queryFn: fetchSummary,
  });

  const newMonthlyFee =
    newMonthlyFeeDraft ??
    (summaryQuery.data?.monthlyFeeCents
      ? String(Math.round(summaryQuery.data.monthlyFeeCents / 100))
      : "");
  const effectiveFrom = effectiveFromDraft ?? defaultEffectiveFrom;

  const automationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/super-admin/billing/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible ejecutar la automatizacion");
      }
      return payload as { remindersSent: number; tenantsSuspended: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-billing-summary"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-overview"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-tenants"] });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async ({ tenantId, notes }: { tenantId: string; notes?: string }) => {
      const response = await fetch("/api/super-admin/billing/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, notes }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible registrar el pago");
      }

      return payload as {
        ok: boolean;
        appliedNow: boolean;
        activeMonthlyFeeCents: number;
        nextMonthlyFeeCents: number | null;
        nextMonthlyFeeEffectiveFrom: string | null;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-billing-summary"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-overview"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-tenants"] });
    },
  });

  const updateFeeMutation = useMutation({
    mutationFn: async ({
      monthlyFeeCOP,
      reason,
      ipc,
      effectiveAt,
    }: {
      monthlyFeeCOP?: number;
      reason?: string;
      ipc?: number;
      effectiveAt?: string;
    }) => {
      const response = await fetch("/api/super-admin/billing/fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newFeeCents: typeof monthlyFeeCOP === "number" ? Math.round(monthlyFeeCOP * 100) : undefined,
          ipcPercent: typeof ipc === "number" ? ipc : undefined,
          effectiveFrom: effectiveAt ? new Date(effectiveAt).toISOString() : undefined,
          reason,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible actualizar la tarifa mensual");
      }

      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-billing-summary"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-overview"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-tenants"] });
    },
  });

  const parsedNewFee = Number(newMonthlyFee);
  const parsedIpcPercent = Number(ipcPercent.replace(",", "."));
  const feeIsValid = Number.isFinite(parsedNewFee) && parsedNewFee > 0;
  const ipcWasProvided = ipcPercent.trim().length > 0;
  const ipcIsValid = ipcWasProvided && Number.isFinite(parsedIpcPercent) && parsedIpcPercent >= 0;

  function previewIpcAdjustedCop() {
    if (!summaryQuery.data?.monthlyFeeCents || !ipcIsValid) {
      return null;
    }

    const currentCop = summaryQuery.data.monthlyFeeCents / 100;
    const calculated = currentCop * (1 + parsedIpcPercent / 100);
    const rounded = Math.round(calculated / 100) * 100;
    return Math.max(100, rounded);
  }

  const ipcPreviewCop = previewIpcAdjustedCop();

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Finanzas SaaS mensual</CardTitle>
          <CardDescription>
            Controla mensualidades por gimnasio, detecta mora y ejecuta recordatorios/suspensiones automaticas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Tarifa vigente</p>
              <p className="text-xl font-black">{formatCOP(summaryQuery.data?.monthlyFeeCents ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Desde: {formatDate(summaryQuery.data?.monthlyFeeEffectiveFrom ?? null)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">MRR proyectado</p>
              <p className="text-xl font-black">{formatCOP(summaryQuery.data?.projectedMrrCents ?? 0)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Cobrado este mes</p>
              <p className="text-xl font-black">{formatCOP(summaryQuery.data?.collectedThisMonthCents ?? 0)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Gimnasios en mora</p>
              <p className="text-xl font-black">{summaryQuery.data?.overdueTenants ?? 0}</p>
            </div>
          </div>

          {summaryQuery.data?.nextMonthlyFeeCents ? (
            <p className="text-xs text-muted-foreground">
              Tarifa programada: {formatCOP(summaryQuery.data.nextMonthlyFeeCents)} desde {formatDate(summaryQuery.data.nextMonthlyFeeEffectiveFrom)}.
            </p>
          ) : null}

          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm font-semibold">Ajustar tarifa mensual SaaS</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="saas-monthly-fee">Nueva tarifa mensual (COP)</Label>
                <Input
                  id="saas-monthly-fee"
                  inputMode="numeric"
                  value={newMonthlyFee}
                  onChange={(event) => setNewMonthlyFeeDraft(event.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="99000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saas-monthly-fee-ipc">IPC anual (%)</Label>
                <Input
                  id="saas-monthly-fee-ipc"
                  inputMode="decimal"
                  value={ipcPercent}
                  onChange={(event) => setIpcPercent(event.target.value.replace(/[^0-9.,]/g, ""))}
                  placeholder="9.28"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saas-monthly-fee-effective">Vigencia</Label>
                <Input
                  id="saas-monthly-fee-effective"
                  type="datetime-local"
                  value={effectiveFrom}
                  onChange={(event) => setEffectiveFromDraft(event.target.value)}
                />
              </div>
              <div className="space-y-2 lg:col-span-1">
                <Label htmlFor="saas-monthly-fee-reason">Motivo</Label>
                <Input
                  id="saas-monthly-fee-reason"
                  value={feeReason}
                  onChange={(event) => setFeeReason(event.target.value)}
                  placeholder="Ajuste anual por ley o por costos operativos"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                onClick={() =>
                  updateFeeMutation.mutate({
                    monthlyFeeCOP: parsedNewFee,
                    reason: feeReason.trim() || undefined,
                    effectiveAt: effectiveFrom || undefined,
                  })
                }
                disabled={!feeIsValid || updateFeeMutation.isPending}
              >
                {updateFeeMutation.isPending ? "Actualizando..." : "Actualizar tarifa"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (ipcPreviewCop) {
                    setNewMonthlyFeeDraft(String(ipcPreviewCop));
                  }
                }}
                disabled={!ipcPreviewCop || updateFeeMutation.isPending}
              >
                Aplicar calculo IPC
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  updateFeeMutation.mutate({
                    ipc: parsedIpcPercent,
                    reason: feeReason.trim() || `Ajuste anual por IPC (${ipcPercent}%)`,
                    effectiveAt: effectiveFrom || undefined,
                  })
                }
                disabled={!ipcIsValid || updateFeeMutation.isPending}
              >
                Guardar aumento por IPC
              </Button>
              <p className="text-xs text-muted-foreground">Este valor se usa en MRR, recordatorios y pago por defecto.</p>
            </div>
            {ipcPreviewCop ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Vista previa IPC: {formatCOP(summaryQuery.data?.monthlyFeeCents ?? 0)}{" -> "}{formatCOP(ipcPreviewCop * 100)}
              </p>
            ) : null}
            {updateFeeMutation.isError ? <p className="mt-2 text-sm text-destructive">{updateFeeMutation.error.message}</p> : null}
            {updateFeeMutation.isSuccess ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {updateFeeMutation.data.appliedNow
                  ? "Tarifa aplicada de inmediato."
                  : `Tarifa programada para ${formatDate(updateFeeMutation.data.nextMonthlyFeeEffectiveFrom)}.`}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => automationMutation.mutate()} disabled={automationMutation.isPending}>
              {automationMutation.isPending ? "Procesando..." : "Ejecutar corte mensual automatico"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Este proceso envia recordatorios de mora y suspende gimnasios que superen dias de gracia.
            </p>
          </div>

          {automationMutation.isSuccess ? (
            <p className="text-sm text-muted-foreground">
              Automatizacion ejecutada. Recordatorios: {automationMutation.data.remindersSent}. Suspendidos: {automationMutation.data.tenantsSuspended}.
            </p>
          ) : null}
          {automationMutation.isError ? <p className="text-sm text-destructive">{automationMutation.error.message}</p> : null}

          {summaryQuery.isLoading ? <p className="text-sm">Cargando estado financiero...</p> : null}
          {summaryQuery.isError ? <p className="text-sm text-destructive">No fue posible cargar el estado financiero.</p> : null}

          <div className="space-y-2">
            {summaryQuery.data?.tenants.map((tenant) => (
              <div key={tenant.tenantId} className="rounded-md border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{tenant.tenantName}</p>
                    <p className="text-xs text-muted-foreground">
                      {tenant.tenantSlug} · Estado cuenta: {tenant.billingStatus} · Estado tenant: {tenant.tenantStatus}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vence: {formatDate(tenant.currentDueAt)} · Proximo corte: {formatDate(tenant.nextDueAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Mora: {tenant.overdueDays} dias · Ultimo recordatorio: {formatDate(tenant.lastReminderAt)}
                    </p>
                  </div>

                  <div className="w-full space-y-2 sm:w-[320px]">
                    <div className="space-y-2">
                      <Label htmlFor={`billing-note-${tenant.tenantId}`}>Nota de pago</Label>
                      <Input
                        id={`billing-note-${tenant.tenantId}`}
                        value={noteByTenant[tenant.tenantId] ?? ""}
                        onChange={(event) =>
                          setNoteByTenant((prev) => ({
                            ...prev,
                            [tenant.tenantId]: event.target.value,
                          }))
                        }
                        placeholder="Transferencia, efectivo, referencia, etc"
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() =>
                        paymentMutation.mutate({
                          tenantId: tenant.tenantId,
                          notes: noteByTenant[tenant.tenantId]?.trim() || undefined,
                        })
                      }
                      disabled={paymentMutation.isPending}
                    >
                      {paymentMutation.isPending ? "Registrando..." : `Registrar pago ${formatCOP(tenant.amountCents)}`}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {paymentMutation.isError ? <p className="text-sm text-destructive">{paymentMutation.error.message}</p> : null}
          {paymentMutation.isSuccess ? (
            <p className="text-sm text-muted-foreground">Pago registrado correctamente y estado actualizado.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
