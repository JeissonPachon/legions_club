"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TenantRow = {
  id: string;
  displayName: string;
};

type DiscountRow = {
  id: string;
  name: string;
  discountType: "percent" | "fixed_cents";
  value: number;
  appliesTo: "all_active_gyms" | "single_gym";
  tenantId: string | null;
  tenantName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
};

async function fetchTenants(): Promise<{ tenants: TenantRow[] }> {
  const response = await fetch("/api/super-admin/tenants");
  if (!response.ok) {
    throw new Error("No fue posible cargar gimnasios");
  }
  return response.json() as Promise<{ tenants: TenantRow[] }>;
}

async function fetchDiscounts(): Promise<{ discounts: DiscountRow[] }> {
  const response = await fetch("/api/super-admin/discounts");
  if (!response.ok) {
    throw new Error("No fue posible cargar descuentos");
  }
  return response.json() as Promise<{ discounts: DiscountRow[] }>;
}

function formatCOP(amountCents: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

export function SuperAdminDiscountsPanel() {
  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed_cents">("percent");
  const [value, setValue] = useState("10");
  const [appliesTo, setAppliesTo] = useState<"all_active_gyms" | "single_gym">("all_active_gyms");
  const [tenantId, setTenantId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");

  const queryClient = useQueryClient();
  const tenantsQuery = useQuery({ queryKey: ["super-admin-tenants"], queryFn: fetchTenants });
  const discountsQuery = useQuery({ queryKey: ["super-admin-discounts"], queryFn: fetchDiscounts });

  const createDiscount = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/super-admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          discountType,
          value: Number(value),
          appliesTo,
          tenantId: appliesTo === "single_gym" ? tenantId : undefined,
          startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
          endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible crear el descuento");
      }

      return payload;
    },
    onSuccess: () => {
      setName("");
      setValue("10");
      setAppliesTo("all_active_gyms");
      setTenantId("");
      setStartsAt("");
      setEndsAt("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["super-admin-discounts"] });
    },
  });

  const isValid =
    name.trim().length >= 2 &&
    Number(value) > 0 &&
    (appliesTo === "all_active_gyms" || tenantId.length > 0);

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Reglas de descuento</CardTitle>
          <CardDescription>Crea descuentos temporales para todos los gimnasios activos o para uno especifico.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="discount-name">Nombre de la regla</Label>
            <Input id="discount-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="discount-type">Tipo de descuento</Label>
            <Select value={discountType} onValueChange={(value) => setDiscountType(value as "percent" | "fixed_cents")}>
              <SelectTrigger id="discount-type" className="w-full">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Porcentaje (%)</SelectItem>
                <SelectItem value="fixed_cents">Monto fijo (COP)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="discount-value">Valor</Label>
            <Input id="discount-value" value={value} onChange={(event) => setValue(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="discount-applies">Aplica a</Label>
            <Select value={appliesTo} onValueChange={(value) => setAppliesTo(value as "all_active_gyms" | "single_gym")}>
              <SelectTrigger id="discount-applies" className="w-full">
                <SelectValue placeholder="Alcance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_active_gyms">Todos los gimnasios activos</SelectItem>
                <SelectItem value="single_gym">Un solo gimnasio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {appliesTo === "single_gym" ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="discount-tenant">Gimnasio</Label>
              <Select value={tenantId} onValueChange={setTenantId}>
                <SelectTrigger id="discount-tenant" className="w-full">
                  <SelectValue placeholder="Selecciona gimnasio" />
                </SelectTrigger>
                <SelectContent>
                  {tenantsQuery.data?.tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="discount-starts">Inicio</Label>
            <Input id="discount-starts" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="discount-ends">Fin</Label>
            <Input id="discount-ends" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="discount-notes">Notas</Label>
            <Input id="discount-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Campana, motivo, etc" />
          </div>

          <Button className="sm:col-span-2" onClick={() => createDiscount.mutate()} disabled={createDiscount.isPending || !isValid}>
            {createDiscount.isPending ? "Guardando..." : "Crear regla de descuento"}
          </Button>

          {createDiscount.isError ? (
            <p className="sm:col-span-2 text-sm text-destructive">{createDiscount.error.message}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Historial de descuentos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {discountsQuery.isLoading ? <p>Cargando descuentos...</p> : null}
          {discountsQuery.data?.discounts.map((discount) => (
            <div key={discount.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{discount.name}</p>
                <span className="text-xs text-muted-foreground">{discount.isActive ? "Activo" : "Vencido"}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {discount.discountType === "percent" ? `${discount.value}%` : formatCOP(discount.value)}
                {" · "}
                {discount.appliesTo === "all_active_gyms" ? "Todos los gimnasios activos" : (discount.tenantName ?? "Un solo gimnasio")}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
