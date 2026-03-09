"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  allowAllTenants: boolean;
};

type ReminderResponse = {
  ok: boolean;
  usersTargeted: number;
  emailSent: number;
  whatsappQueued: number;
  whatsappMode: "queued";
};

export function RemindersPanel({ allowAllTenants }: Props) {
  const defaultMessage = "Recordatorio: revisa tu plan y agenda tus sesiones de esta semana.";
  const [messageDraft, setMessageDraft] = useState<string | null>(null);
  const [channel, setChannel] = useState<"email" | "whatsapp" | "both">("both");
  const [scope, setScope] = useState<"current_tenant" | "all_active_tenants">(
    allowAllTenants ? "all_active_tenants" : "current_tenant",
  );

  const reminderMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, channel, scope }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible enviar recordatorios");
      }

      return payload as ReminderResponse;
    },
  });

  const settingsQuery = useQuery({
    queryKey: ["super-admin-platform-settings"],
    queryFn: async () => {
      const response = await fetch("/api/super-admin/settings");
      if (!response.ok) {
        return null;
      }

      return (await response.json()) as { globalReminderTemplate?: string };
    },
    enabled: allowAllTenants,
    staleTime: 30_000,
  });

  const message =
    messageDraft ??
    (allowAllTenants
      ? settingsQuery.data?.globalReminderTemplate ?? defaultMessage
      : defaultMessage);

  const isValid = message.trim().length >= 4;

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle>Recordatorios masivos</CardTitle>
        <CardDescription>
          Usa este modulo para campanas manuales. La cobranza mensual automatica SaaS se gestiona desde el panel financiero.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="reminder-message">Mensaje</Label>
          <Input id="reminder-message" value={message} onChange={(event) => setMessageDraft(event.target.value)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="reminder-channel">Canal</Label>
            <Select value={channel} onValueChange={(value) => setChannel(value as "email" | "whatsapp" | "both")}>
              <SelectTrigger id="reminder-channel" className="w-full">
                <SelectValue placeholder="Selecciona canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Correo</SelectItem>
                <SelectItem value="whatsapp">WhatsApp (cola)</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-scope">Alcance</Label>
            <Select
              value={scope}
              onValueChange={(value) => setScope(value as "current_tenant" | "all_active_tenants")}
              disabled={!allowAllTenants}
            >
              <SelectTrigger id="reminder-scope" className="w-full">
                <SelectValue placeholder="Selecciona alcance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_tenant">Gimnasio actual</SelectItem>
                {allowAllTenants ? <SelectItem value="all_active_tenants">Todos los gimnasios activos</SelectItem> : null}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={() => reminderMutation.mutate()} disabled={reminderMutation.isPending || !isValid}>
          {reminderMutation.isPending ? "Enviando..." : "Enviar recordatorios"}
        </Button>

        {reminderMutation.isError ? (
          <p className="text-sm text-destructive">{reminderMutation.error.message}</p>
        ) : null}

        {reminderMutation.isSuccess ? (
          <p className="text-sm text-muted-foreground">
            Listo. Destinatarios: {reminderMutation.data.usersTargeted}. Correos enviados: {reminderMutation.data.emailSent}. WhatsApp en cola: {reminderMutation.data.whatsappQueued}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
