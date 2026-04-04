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
  emailSent?: number;
  emailQueued?: number;
  whatsappQueued: number;
  whatsappSkippedNoPhone?: number;
  whatsappSkippedDecryptError?: number;
  whatsappMode: "queued" | "sent" | "manual";
  whatsappManualLinks?: Array<{ name: string; phone: string; url: string }>;
};

type ExpiringMemberAlert = {
  memberId: string;
  fullName: string;
  subscriptionId: string;
  endDate: string;
  daysLeft: number;
  whatsappUrl: string | null;
};

type ExpiringMembersResponse = {
  ok: boolean;
  days: number;
  count: number;
  expiringMembers: ExpiringMemberAlert[];
};

export function RemindersPanel({ allowAllTenants }: Props) {
  const defaultMessage = "Recordatorio: revisa tu plan y agenda tus sesiones de esta semana.";
  const [messageDraft, setMessageDraft] = useState<string | null>(null);
  const [channel, setChannel] = useState<"email" | "whatsapp" | "both">("both");
  const [whatsappMode, setWhatsappMode] = useState<"sent" | "manual">("sent");
  const [expiringDays, setExpiringDays] = useState<number>(5);
  const [scope, setScope] = useState<"current_tenant" | "all_active_tenants">(
    allowAllTenants ? "all_active_tenants" : "current_tenant",
  );

  const effectiveWhatsappMode: "sent" | "manual" = allowAllTenants ? whatsappMode : "manual";
  const reminderMutation = useMutation({
    mutationFn: async (vars?: { tenantId?: string | null }) => {
      const response = await fetch(allowAllTenants ? "/api/reminders/send" : "/api/reminders/send-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          allowAllTenants
            ? { message, channel, scope, tenantId: vars?.tenantId, whatsappMode }
            : { message, channel, whatsappMode: effectiveWhatsappMode },
        ),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible enviar recordatorios");
      }

      return payload as ReminderResponse;
    },
  });

  const sendExpiringMutation = useMutation({
    mutationFn: async (days: number = 5) => {
      const response = await fetch("/api/reminders/send-expiring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days, channel, scope }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible enviar recordatorios automáticos");
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

  const tenantsQuery = useQuery({
    queryKey: ["super-admin-tenants"],
    queryFn: async () => {
      if (!allowAllTenants) return [];
      const res = await fetch("/api/super-admin/tenants");
      if (!res.ok) return [];
      const payload = await res.json();
      return payload.tenants as { id: string; displayName: string }[];
    },
    enabled: allowAllTenants,
  });

  const expiringMembersQuery = useQuery({
    queryKey: ["gym-expiring-members", expiringDays],
    queryFn: async () => {
      if (allowAllTenants) {
        return null;
      }

      const response = await fetch(`/api/reminders/expiring-members?days=${expiringDays}`);
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message ?? "No fue posible cargar alertas de vencimiento");
      }

      return payload as ExpiringMembersResponse;
    },
    enabled: !allowAllTenants,
    staleTime: 15_000,
  });

  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const message =
    messageDraft ??
    (allowAllTenants
      ? settingsQuery.data?.globalReminderTemplate ?? defaultMessage
      : defaultMessage);

  const isValid = message.trim().length >= 4;

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle>{allowAllTenants ? "Recordatorios masivos" : "Recordatorios a miembros"}</CardTitle>
        <CardDescription>
          {allowAllTenants
            ? "Usa este modulo para campanas manuales a administradores. La cobranza mensual automatica SaaS se gestiona desde el panel financiero."
            : "Usa este modulo para enviar recordatorios a miembros activos de tu gimnasio."}
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
                <SelectItem value="whatsapp">{allowAllTenants ? "WhatsApp (cola)" : "WhatsApp (manual)"}</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {allowAllTenants ? (
            <div className="space-y-2">
              <Label htmlFor="reminder-scope">Alcance</Label>
              <Select value={scope} onValueChange={(value) => setScope(value as "current_tenant" | "all_active_tenants")}>
                <SelectTrigger id="reminder-scope" className="w-full">
                  <SelectValue placeholder="Selecciona alcance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current_tenant">Gimnasio actual</SelectItem>
                  <SelectItem value="all_active_tenants">Todos los gimnasios activos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {allowAllTenants && (channel === "whatsapp" || channel === "both") ? (
          <div className="space-y-2">
            <Label htmlFor="whatsapp-mode">Modo WhatsApp</Label>
            <Select value={whatsappMode} onValueChange={(value) => setWhatsappMode(value as "sent" | "manual")}>
              <SelectTrigger id="whatsapp-mode" className="w-full">
                <SelectValue placeholder="Selecciona modo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sent">Automatico (cola)</SelectItem>
                <SelectItem value="manual">Manual (botones wa.me)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {allowAllTenants && scope !== "all_active_tenants" ? (
          <div className="space-y-2">
            <Label htmlFor="tenant">Seleccionar gimnasio</Label>
            <Select value={selectedTenantId ?? ""} onValueChange={(v) => setSelectedTenantId(v || null)}>
              <SelectTrigger id="tenant" className="w-full">
                <SelectValue placeholder="Selecciona gimnasio" />
              </SelectTrigger>
              <SelectContent>
                {tenantsQuery.data?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {!allowAllTenants ? (
          <div className="space-y-3 rounded-md border p-3">
            <div className="grid gap-3 sm:grid-cols-[120px_1fr] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="expiring-days">Alerta en dias</Label>
                <Input
                  id="expiring-days"
                  type="number"
                  min={1}
                  max={30}
                  value={expiringDays}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);
                    setExpiringDays(Number.isFinite(nextValue) ? Math.min(30, Math.max(1, nextValue)) : 5);
                  }}
                />
              </div>

              <Button type="button" variant="outline" onClick={() => expiringMembersQuery.refetch()} disabled={expiringMembersQuery.isFetching}>
                {expiringMembersQuery.isFetching ? "Actualizando alertas..." : "Actualizar alertas por vencimiento"}
              </Button>
            </div>

            {expiringMembersQuery.isError ? <p className="text-sm text-destructive">{expiringMembersQuery.error.message}</p> : null}

            {expiringMembersQuery.data ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Alertas: {expiringMembersQuery.data.count} miembros vencen en los proximos {expiringMembersQuery.data.days} dias.
                </p>
                {(expiringMembersQuery.data.expiringMembers?.length ?? 0) > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {expiringMembersQuery.data.expiringMembers.map((member) => (
                      <div key={`${member.memberId}-${member.subscriptionId}`} className="rounded-md border p-2">
                        <p className="text-sm font-medium">{member.fullName}</p>
                        <p className="text-xs text-muted-foreground">Vence: {new Date(member.endDate).toLocaleDateString()} ({member.daysLeft} dias)</p>
                        {member.whatsappUrl ? (
                          <Button className="mt-2 w-full" variant="outline" size="sm" asChild>
                            <a href={member.whatsappUrl} target="_blank" rel="noreferrer">
                              Enviar WhatsApp manual
                            </a>
                          </Button>
                        ) : (
                          <p className="mt-2 text-xs text-destructive">Sin telefono disponible</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No hay miembros por vencer en ese rango.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <Button onClick={() => reminderMutation.mutate({ tenantId: selectedTenantId })} disabled={reminderMutation.isPending || !isValid}>
          {reminderMutation.isPending ? "Enviando..." : "Enviar recordatorios"}
        </Button>

        {allowAllTenants ? (
          <div className="pt-2">
            <Button onClick={() => sendExpiringMutation.mutate(5)} disabled={sendExpiringMutation.isPending} variant="outline">
              {sendExpiringMutation.isPending ? "Enviando automáticos..." : "Enviar recordatorios (5 días antes)"}
            </Button>
          </div>
        ) : null}

        {reminderMutation.isError ? (
          <p className="text-sm text-destructive">{reminderMutation.error.message}</p>
        ) : null}

        {reminderMutation.isSuccess ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Listo. Destinatarios: {reminderMutation.data.usersTargeted}. Correos: {reminderMutation.data.emailSent ?? reminderMutation.data.emailQueued ?? 0}. {reminderMutation.data.whatsappMode === "manual" ? `WhatsApp manual listo: ${reminderMutation.data.whatsappManualLinks?.length ?? 0}.` : `WhatsApp en cola: ${reminderMutation.data.whatsappQueued}.`} Sin telefono: {reminderMutation.data.whatsappSkippedNoPhone ?? 0}. Errores de desencriptacion: {reminderMutation.data.whatsappSkippedDecryptError ?? 0}.
            </p>
            {reminderMutation.data.whatsappMode === "manual" && (reminderMutation.data.whatsappManualLinks?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                <p className="font-medium text-foreground">Envio manual listo ({reminderMutation.data.whatsappManualLinks?.length})</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {reminderMutation.data.whatsappManualLinks?.map((link) => (
                    <Button key={`${link.phone}-${link.name}`} variant="outline" size="sm" asChild>
                      <a href={link.url} target="_blank" rel="noreferrer">
                        WhatsApp: {link.name}
                      </a>
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
