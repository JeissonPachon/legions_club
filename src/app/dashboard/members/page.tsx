"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type Member = {
  id: string;
  fullName: string;
  documentLast4: string;
  isActive: boolean;
  createdAt: string;
  hasEmail: boolean;
  hasPhone: boolean;
};

type MemberDetails = {
  member: {
    id: string;
    fullName: string;
    documentLast4: string;
    hasEmail: boolean;
    hasPhone: boolean;
    isActive: boolean;
    sensitive: {
      injuries: string | null;
      conditions: string | null;
      emergencyName: string | null;
      emergencyPhone: string | null;
      emergencyRelation: string | null;
    } | null;
  };
};

async function fetchMembers(): Promise<{ members: Member[] }> {
  const response = await fetch("/api/members");
  if (!response.ok) {
    throw new Error("No fue posible cargar los miembros");
  }
  return response.json() as Promise<{ members: Member[] }>;
}

async function fetchPlans(): Promise<{ plans: Plan[] }> {
  const response = await fetch("/api/plans");
  if (!response.ok) {
    throw new Error("No fue posible cargar los planes");
  }
  return response.json() as Promise<{ plans: Plan[] }>;
}

function formatCOP(amountCents: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

export default function MembersPage() {
  const { isCheckingAccess, error } = useGymManagementPageGuard();
  const [fullName, setFullName] = useState("");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [injuries, setInjuries] = useState("");
  const [conditions, setConditions] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");
  const [planId, setPlanId] = useState("");

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editDocument, setEditDocument] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editInjuries, setEditInjuries] = useState("");
  const [editConditions, setEditConditions] = useState("");
  const [editEmergencyName, setEditEmergencyName] = useState("");
  const [editEmergencyPhone, setEditEmergencyPhone] = useState("");
  const [editEmergencyRelation, setEditEmergencyRelation] = useState("");

  const queryClient = useQueryClient();

  const membersQuery = useQuery({ queryKey: ["members"], queryFn: fetchMembers });
  const plansQuery = useQuery({ queryKey: ["plans"], queryFn: fetchPlans });
  const activePlans = plansQuery.data?.plans.filter((plan) => plan.isActive) ?? [];
  const selectedPlan = activePlans.find((plan) => plan.id === planId) ?? null;

  const createMember = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          document,
          planId: planId || undefined,
          email: email || undefined,
          phone: phone || undefined,
          injuries: injuries || undefined,
          conditions: conditions || undefined,
          emergencyName: emergencyName || undefined,
          emergencyPhone: emergencyPhone || undefined,
          emergencyRelation: emergencyRelation || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible crear el miembro");
      }
      return payload;
    },
    onSuccess: () => {
      setFullName("");
      setDocument("");
      setEmail("");
      setPhone("");
      setInjuries("");
      setConditions("");
      setEmergencyName("");
      setEmergencyPhone("");
      setEmergencyRelation("");
      setPlanId("");
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const updateMember = useMutation({
    mutationFn: async () => {
      if (!editingMemberId) {
        throw new Error("No se selecciono ningun miembro");
      }

      const response = await fetch(`/api/members/${editingMemberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: editFullName,
          document: editDocument || undefined,
          email: editEmail || undefined,
          phone: editPhone || undefined,
          isActive: editIsActive,
          injuries: editInjuries || undefined,
          conditions: editConditions || undefined,
          emergencyName: editEmergencyName || undefined,
          emergencyPhone: editEmergencyPhone || undefined,
          emergencyRelation: editEmergencyRelation || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible actualizar el miembro");
      }

      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setEditingMemberId(null);
    },
  });

  async function startEdit(memberId: string) {
    const response = await fetch(`/api/members/${memberId}`);
    const payload = (await response.json()) as MemberDetails;
    if (!response.ok) {
      return;
    }

    setEditingMemberId(memberId);
    setEditFullName(payload.member.fullName);
    setEditDocument("");
    setEditEmail("");
    setEditPhone("");
    setEditIsActive(payload.member.isActive);
    setEditInjuries(payload.member.sensitive?.injuries ?? "");
    setEditConditions(payload.member.sensitive?.conditions ?? "");
    setEditEmergencyName(payload.member.sensitive?.emergencyName ?? "");
    setEditEmergencyPhone(payload.member.sensitive?.emergencyPhone ?? "");
    setEditEmergencyRelation(payload.member.sensitive?.emergencyRelation ?? "");
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
          <CardTitle>Agregar miembro (perfil completo)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="member-full-name">Nombre completo</Label>
            <Input
              id="member-full-name"
              placeholder="Ejemplo: Maria Perez"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="member-document">Documento</Label>
            <Input
              id="member-document"
              placeholder="Ejemplo: 123456789"
              value={document}
              onChange={(event) => setDocument(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="member-email">Correo (opcional)</Label>
            <Input
              id="member-email"
              placeholder="correo@dominio.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="member-phone">Telefono (opcional)</Label>
            <Input
              id="member-phone"
              placeholder="3001234567"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="member-injuries">Lesiones (opcional)</Label>
            <Input
              id="member-injuries"
              placeholder="Describe lesiones relevantes"
              value={injuries}
              onChange={(event) => setInjuries(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="member-plan-id">Plan inicial (opcional)</Label>
            <Select
              value={planId}
              onValueChange={(value) => setPlanId(value === "none" ? "" : value)}
            >
              <SelectTrigger id="member-plan-id" className="w-full">
                <SelectValue placeholder="Selecciona plan para activar suscripcion al crear" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin plan inicial</SelectItem>
                {activePlans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} · {formatCOP(plan.priceCents)} · {plan.durationDays} dias
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPlan ? (
              <p className="text-xs text-muted-foreground">
                Se creara suscripcion: {selectedPlan.name} · {selectedPlan.sessionsPerMonth} sesiones/mes · {formatCOP(selectedPlan.priceCents)}.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Si no eliges plan, solo se crea el perfil del miembro.</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="member-conditions">Condiciones medicas (opcional)</Label>
            <Input
              id="member-conditions"
              placeholder="Alergias, condiciones, medicamentos"
              value={conditions}
              onChange={(event) => setConditions(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="member-emergency-name">Nombre contacto de emergencia</Label>
            <Input
              id="member-emergency-name"
              placeholder="Nombre y apellido"
              value={emergencyName}
              onChange={(event) => setEmergencyName(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="member-emergency-phone">Telefono contacto de emergencia</Label>
            <Input
              id="member-emergency-phone"
              placeholder="3001234567"
              value={emergencyPhone}
              onChange={(event) => setEmergencyPhone(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="member-emergency-relation">Parentesco de emergencia</Label>
            <Input
              id="member-emergency-relation"
              placeholder="Ejemplo: Madre, Hermano"
              value={emergencyRelation}
              onChange={(event) => setEmergencyRelation(event.target.value)}
            />
          </div>
          <Button
            className="sm:col-span-3"
            onClick={() => createMember.mutate()}
            disabled={createMember.isPending || fullName.length < 2 || document.length < 4}
          >
            {createMember.isPending ? "Guardando..." : "Crear miembro"}
          </Button>
          {createMember.isError ? (
            <p className="sm:col-span-3 text-sm text-destructive">{createMember.error.message}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Miembros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {membersQuery.isLoading ? <p>Cargando miembros...</p> : null}
          {membersQuery.isError ? (
            <p className="text-destructive">No fue posible cargar los miembros.</p>
          ) : null}
          {membersQuery.data?.members.map((member) => (
            <div key={member.id} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{member.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    Doc ****{member.documentLast4} · {member.hasEmail ? "correo" : "sin correo"} · {member.hasPhone ? "telefono" : "sin telefono"}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{member.isActive ? "Activo" : "Inactivo"}</span>
              </div>

              <Button variant="outline" onClick={() => startEdit(member.id)}>
                Editar miembro
              </Button>

              {editingMemberId === member.id ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nombre completo</Label>
                    <Input value={editFullName} onChange={(event) => setEditFullName(event.target.value)} placeholder="Nombre completo" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nuevo documento (opcional)</Label>
                    <Input value={editDocument} onChange={(event) => setEditDocument(event.target.value)} placeholder="Documento" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nuevo correo (opcional)</Label>
                    <Input value={editEmail} onChange={(event) => setEditEmail(event.target.value)} placeholder="correo@dominio.com" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nuevo telefono (opcional)</Label>
                    <Input value={editPhone} onChange={(event) => setEditPhone(event.target.value)} placeholder="3001234567" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Lesiones</Label>
                    <Input value={editInjuries} onChange={(event) => setEditInjuries(event.target.value)} placeholder="Lesiones" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Condiciones</Label>
                    <Input value={editConditions} onChange={(event) => setEditConditions(event.target.value)} placeholder="Condiciones" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nombre de emergencia</Label>
                    <Input value={editEmergencyName} onChange={(event) => setEditEmergencyName(event.target.value)} placeholder="Nombre de emergencia" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefono de emergencia</Label>
                    <Input value={editEmergencyPhone} onChange={(event) => setEditEmergencyPhone(event.target.value)} placeholder="Telefono de emergencia" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Parentesco de emergencia</Label>
                    <Input value={editEmergencyRelation} onChange={(event) => setEditEmergencyRelation(event.target.value)} placeholder="Parentesco de emergencia" />
                  </div>
                  <Button variant="outline" onClick={() => setEditIsActive((current) => !current)}>
                    {editIsActive ? "Desactivar" : "Activar"}
                  </Button>
                  <Button onClick={() => updateMember.mutate()} disabled={updateMember.isPending || editFullName.length < 2}>
                    {updateMember.isPending ? "Guardando..." : "Guardar cambios"}
                  </Button>
                </div>
              ) : null}

              {updateMember.isError && editingMemberId === member.id ? (
                <p className="text-sm text-destructive">{updateMember.error.message}</p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}