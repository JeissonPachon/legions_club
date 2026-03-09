"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SuperAdminOverviewPayload = {
  tenantsTotal: number;
  activeTenants: number;
  suspendedTenants: number;
  archivedTenants: number;
  collectedThisMonthCents: number;
};

function formatCOP(amountCents: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

async function fetchOverview(): Promise<SuperAdminOverviewPayload> {
  const response = await fetch("/api/super-admin/overview");
  if (!response.ok) {
    throw new Error("No fue posible cargar el resumen SaaS");
  }
  return response.json() as Promise<SuperAdminOverviewPayload>;
}

export function SuperAdminOverview() {
  const query = useQuery({ queryKey: ["super-admin-overview"], queryFn: fetchOverview });

  const cards = [
    {
      title: "Gimnasios activos",
      value: query.data?.activeTenants ?? 0,
      subtitle: `Total ${query.data?.tenantsTotal ?? 0}`,
      icon: Building2,
    },
    {
      title: "Ingresos del mes",
      value: formatCOP(query.data?.collectedThisMonthCents ?? 0),
      subtitle: "Cobros SaaS registrados",
      icon: Wallet,
    },
    {
      title: "Gimnasios en riesgo",
      value: (query.data?.suspendedTenants ?? 0) + (query.data?.archivedTenants ?? 0),
      subtitle: `${query.data?.suspendedTenants ?? 0} suspendidos`,
      icon: Wallet,
    },
  ];

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Centro de control SaaS</p>
        <h1 className="text-2xl font-bold tracking-tight">Panel de Super Administrador</h1>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title} className="border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">{query.isLoading ? "..." : card.value}</div>
              <p className="text-xs text-muted-foreground">{card.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {query.isError ? <p className="text-sm text-destructive">No fue posible cargar el resumen SaaS.</p> : null}
    </div>
  );
}
