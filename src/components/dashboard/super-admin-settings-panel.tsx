"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type PlatformSettingsPayload = {
  graceDays: number;
  globalReminderTemplate: string;
  updatedAt: string | null;
};

async function fetchPlatformSettings(): Promise<PlatformSettingsPayload> {
  const response = await fetch("/api/super-admin/settings");
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message ?? "No fue posible cargar la configuracion global");
  }

  return payload as PlatformSettingsPayload;
}

const configBlocks = [
  {
    title: "Facturacion SaaS",
    description: "Tarifa vigente, ajuste por IPC, vigencias programadas, pagos y cortes automaticos.",
    href: "/dashboard/super-admin/finance",
    cta: "Ir a Finanzas SaaS",
  },
  {
    title: "Comunicaciones y recordatorios",
    description: "Mensajes operativos, alcance por gimnasio y campanas globales.",
    href: "/dashboard/super-admin/reminders",
    cta: "Ir a Recordatorios",
  },
  {
    title: "Politica comercial",
    description: "Reglas de descuento, vigencias y aplicacion por gimnasio o por red completa.",
    href: "/dashboard/super-admin/discounts",
    cta: "Ir a Descuentos",
  },
  {
    title: "Gobierno de gimnasios",
    description: "Alta de gimnasios, activacion o suspension manual y seguimiento de estado.",
    href: "/dashboard/super-admin/tenants",
    cta: "Ir a Gimnasios",
  },
];

export function SuperAdminSettingsPanel() {
  const queryClient = useQueryClient();
  const [graceDaysDraft, setGraceDaysDraft] = useState<string | null>(null);
  const [globalReminderTemplateDraft, setGlobalReminderTemplateDraft] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["super-admin-platform-settings"],
    queryFn: fetchPlatformSettings,
  });

  const graceDays = graceDaysDraft ?? String(settingsQuery.data?.graceDays ?? 5);
  const globalReminderTemplate =
    globalReminderTemplateDraft ?? settingsQuery.data?.globalReminderTemplate ?? "";

  const saveSettings = useMutation({
    mutationFn: async () => {
      const parsedGraceDays = Number(graceDays);
      const response = await fetch("/api/super-admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          graceDays: parsedGraceDays,
          globalReminderTemplate,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible guardar configuracion");
      }

      return payload;
    },
    onSuccess: async () => {
      setGraceDaysDraft(null);
      setGlobalReminderTemplateDraft(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["super-admin-platform-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["super-admin-billing-summary"] }),
      ]);
    },
  });

  const parsedGraceDays = Number(graceDays);
  const isGraceDaysValid = Number.isInteger(parsedGraceDays) && parsedGraceDays >= 1 && parsedGraceDays <= 45;
  const isTemplateValid = globalReminderTemplate.trim().length >= 4 && globalReminderTemplate.trim().length <= 280;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Configuracion central</p>
        <h1 className="text-2xl font-bold tracking-tight">Ajustes de Super Administrador</h1>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Ajustes globales activos</CardTitle>
          <CardDescription>
            Estos valores impactan automatizaciones y comunicacion para toda la plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="saas-grace-days">Dias de gracia para suspension SaaS</Label>
              <Input
                id="saas-grace-days"
                inputMode="numeric"
                value={graceDays}
                onChange={(event) => setGraceDaysDraft(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="5"
              />
              <p className="text-xs text-muted-foreground">
                Si un gimnasio supera este limite sin pago, se suspende en el corte automatico.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="global-reminder-template">Plantilla de recordatorio global</Label>
              <Textarea
                id="global-reminder-template"
                value={globalReminderTemplate}
                onChange={(event) => setGlobalReminderTemplateDraft(event.target.value)}
                placeholder="Mensaje por defecto para recordatorios de cobranza"
              />
              <p className="text-xs text-muted-foreground">Se usa como base para campañas globales.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => saveSettings.mutate()}
              disabled={saveSettings.isPending || !isGraceDaysValid || !isTemplateValid}
            >
              {saveSettings.isPending ? "Guardando..." : "Guardar configuracion"}
            </Button>
            {settingsQuery.data?.updatedAt ? (
              <p className="text-xs text-muted-foreground">
                Ultima actualizacion: {new Date(settingsQuery.data.updatedAt).toLocaleString("es-CO")}
              </p>
            ) : null}
          </div>

          {settingsQuery.isLoading ? <p className="text-sm text-muted-foreground">Cargando configuracion...</p> : null}
          {settingsQuery.isError ? <p className="text-sm text-destructive">No fue posible cargar configuracion.</p> : null}
          {saveSettings.isError ? <p className="text-sm text-destructive">{saveSettings.error.message}</p> : null}
          {saveSettings.isSuccess ? <p className="text-sm text-muted-foreground">Configuracion guardada.</p> : null}
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Que administrar desde Configuracion</CardTitle>
          <CardDescription>
            Usa esta seccion como hub para definir reglas globales de la plataforma sin mezclar operacion diaria.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Seguridad: cuentas super admin autorizadas, sesiones y acceso a acciones criticas.</p>
          <p>2. Politica de cobro: tarifa base, IPC anual, dias de gracia y criterio de suspension.</p>
          <p>3. Comunicaciones: plantillas y reglas para recordatorios automaticos y manuales.</p>
          <p>4. Politica comercial: descuentos globales y por gimnasio con fechas de vigencia.</p>
          <p>5. Gobierno operativo: alta, suspension y reactivacion de gimnasios.</p>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {configBlocks.map((block) => (
          <Card key={block.title} className="border-2">
            <CardHeader>
              <CardTitle className="text-base">{block.title}</CardTitle>
              <CardDescription>{block.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={block.href}>{block.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
