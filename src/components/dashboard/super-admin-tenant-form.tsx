"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Discipline = "gym" | "powerlifting" | "crossfit" | "pilates" | "hyrox" | "mma" | "other";

const disciplineOptions: Array<{ value: Discipline; label: string }> = [
  { value: "gym", label: "Gym" },
  { value: "powerlifting", label: "Powerlifting" },
  { value: "crossfit", label: "Crossfit" },
  { value: "pilates", label: "Pilates" },
  { value: "hyrox", label: "Hyrox" },
  { value: "mma", label: "MMA" },
  { value: "other", label: "Other" },
];

type TenantRow = {
  id: string;
  slug: string;
  displayName: string;
  legalName: string;
  nit: string | null;
  discipline: string;
  status: string;
  createdAt: string;
  usersCount: number;
  membersCount: number;
  ownerEmail: string | null;
  ownerPhone: string | null;
};

type TenantCreateResponse = {
  tenant: {
    displayName: string;
  };
  owner: {
    email: string;
  };
  message?: string;
};

async function fetchTenants(includeArchived: boolean): Promise<{ tenants: TenantRow[] }> {
  const params = new URLSearchParams();
  if (includeArchived) {
    params.set("includeArchived", "true");
  }

  const response = await fetch(`/api/super-admin/tenants?${params.toString()}`);
  if (!response.ok) {
    throw new Error("No fue posible cargar gimnasios");
  }
  return response.json() as Promise<{ tenants: TenantRow[] }>;
}

export function SuperAdminTenantForm() {
  const queryClient = useQueryClient();
  const [tenantSlug, setTenantSlug] = useState("");
  const [legalName, setLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [discipline, setDiscipline] = useState<Discipline>("gym");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [nit, setNit] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [editSlug, setEditSlug] = useState("");
  const [editLegalName, setEditLegalName] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editDiscipline, setEditDiscipline] = useState<Discipline>("gym");
  const [editAdminEmail, setEditAdminEmail] = useState("");
  const [editAdminPhone, setEditAdminPhone] = useState("");

  const tenantsQuery = useQuery({
    queryKey: ["super-admin-tenants", showArchived],
    queryFn: () => fetchTenants(showArchived),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ tenantId, status }: { tenantId: string; status: "active" | "suspended" | "archived" }) => {
      const response = await fetch(`/api/super-admin/tenants/${tenantId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reason:
            status === "suspended"
              ? "Suspension manual preventiva"
              : status === "archived"
                ? "Archivado para limpieza operativa"
                : "Reactivacion manual",
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible actualizar el estado del gimnasio");
      }

      return payload;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["super-admin-tenants"] }),
        queryClient.invalidateQueries({ queryKey: ["super-admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["super-admin-billing-summary"] }),
      ]);
    },
  });

  const editTenantMutation = useMutation({
    mutationFn: async (input: {
      tenantId: string;
      slug: string;
      legalName: string;
      displayName: string;
      discipline: Discipline;
      adminEmail?: string;
      adminPhone?: string;
    }) => {
      const response = await fetch(`/api/super-admin/tenants/${input.tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: input.slug,
          legalName: input.legalName,
          displayName: input.displayName,
          discipline: input.discipline,
          ...(input.adminEmail ? { adminEmail: input.adminEmail } : {}),
          ...(input.adminPhone ? { adminPhone: input.adminPhone } : {}),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible editar el gimnasio");
      }

      return payload;
    },
    onSuccess: async () => {
      setEditingTenantId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["super-admin-tenants"] }),
        queryClient.invalidateQueries({ queryKey: ["super-admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["super-admin-billing-summary"] }),
      ]);
    },
  });

  const deleteTenantMutation = useMutation({
    mutationFn: async (input: { tenantId: string; verificationText: string }) => {
      const response = await fetch(`/api/super-admin/tenants/${input.tenantId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationText: input.verificationText }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible eliminar el gimnasio");
      }

      return payload;
    },
    onSuccess: async (payload: { requiresRelogin?: boolean }) => {
      if (payload.requiresRelogin) {
        window.location.href = "/auth/login";
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["super-admin-tenants"] }),
        queryClient.invalidateQueries({ queryKey: ["super-admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["super-admin-billing-summary"] }),
      ]);
    },
  });

  function startEditTenant(tenant: TenantRow) {
    setEditingTenantId(tenant.id);
    setEditSlug(tenant.slug);
    setEditLegalName(tenant.legalName);
    setEditDisplayName(tenant.displayName);
    setEditDiscipline(tenant.discipline as Discipline);
    setEditAdminEmail(tenant.ownerEmail ?? "");
    setEditAdminPhone(tenant.ownerPhone ?? "");
  }

  function deleteTenantWithVerification(tenant: TenantRow) {
    const expected = `ELIMINAR ${tenant.slug}`;
    const verificationText = window.prompt(
      `Esta accion es permanente. Para confirmar escribe exactamente: ${expected}`,
      "",
    );

    if (!verificationText) {
      return;
    }

    deleteTenantMutation.mutate({ tenantId: tenant.id, verificationText });
  }

  const phoneRegex = /^\+?[1-9]\d{6,14}$/; // E.164-ish: optional +, 7-15 digits, no leading zero

  const isValid =
    tenantSlug.length >= 2 &&
    legalName.length >= 2 &&
    displayName.length >= 2 &&
    // nit is optional but if provided should be at least 3 chars
    (nit.length === 0 || nit.length >= 3) &&
    adminName.length >= 2 &&
    adminEmail.includes("@") &&
    adminPassword.length >= 8 &&
    phoneRegex.test(adminPhone);

  async function handleSubmit() {
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/super-admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          legalName,
            nit,
          displayName,
          discipline,
          adminName,
          adminEmail,
            adminPassword,
            ...(adminPhone ? { adminPhone } : {}),
        }),
      });

      let payload: TenantCreateResponse | null = null;
      try {
        payload = (await response.json()) as TenantCreateResponse;
      } catch {
        // empty or invalid JSON
        const text = await response.text().catch(() => "");
        payload = text ? { message: text, tenant: { displayName: "" }, owner: { email: "" } } : null;
      }

      if (!response.ok) {
        const msg = payload?.message || response.statusText || "No fue posible crear el gimnasio";
        throw new Error(msg);
      }

      if (!payload?.tenant?.displayName || !payload?.owner?.email) {
        throw new Error("Respuesta invalida del servidor al crear gimnasio");
      }

      setTenantSlug("");
      setLegalName("");
      setDisplayName("");
      setNit("");
      setDiscipline("gym");
      setAdminName("");
      setAdminEmail("");
      setAdminPhone("");
      setAdminPassword("");

      setSuccess(
        `Gimnasio ${payload.tenant.displayName} creado. Cuenta administrador: ${payload.owner.email}`,
      );
      await tenantsQuery.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible crear el gimnasio");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Registrar nuevo gimnasio</CardTitle>
          <CardDescription>
            Crea un nuevo gimnasio, usuario administrador y planes por defecto en una sola accion.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tenantSlug">Slug del gimnasio</Label>
              <Input
                id="tenantSlug"
                placeholder="iron-temple"
                value={tenantSlug}
                onChange={(event) => setTenantSlug(event.target.value.toLowerCase().replace(/\s+/g, "-"))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discipline">Disciplina</Label>
              <Select value={discipline} onValueChange={(value) => setDiscipline(value as Discipline)}>
                <SelectTrigger id="discipline" className="w-full">
                  <SelectValue placeholder="Selecciona disciplina" />
                </SelectTrigger>
                <SelectContent>
                  {disciplineOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="legalName">Razon social</Label>
              <Input
                id="legalName"
                placeholder="Iron Temple Ltd."
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Nombre comercial</Label>
              <Input
                id="displayName"
                placeholder="Iron Temple"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminName">Nombre completo del administrador</Label>
              <Input
                id="adminName"
                placeholder="Jane Doe"
                value={adminName}
                onChange={(event) => setAdminName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminEmail">Correo del administrador</Label>
              <Input
                id="adminEmail"
                type="email"
                placeholder="owner@newgym.com"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value.toLowerCase())}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminPhone">Telefono del administrador (WhatsApp)</Label>
              <Input
                id="adminPhone"
                placeholder="+573001234567"
                value={adminPhone}
                onChange={(event) => setAdminPhone(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nit">NIT</Label>
              <Input
                id="nit"
                placeholder="900123456-7"
                value={nit}
                onChange={(event) => setNit(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminPassword">Contrasena temporal del administrador</Label>
              <Input
                id="adminPassword"
                type="password"
                placeholder="Minimo 8 caracteres"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
              />
            </div>

          </div>

          <Button disabled={!isValid || isLoading} onClick={handleSubmit} className="w-full sm:w-auto">
            {isLoading ? "Creando..." : "Crear gimnasio"}
          </Button>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? <p className="text-sm text-green-600">{success}</p> : null}
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Gimnasios registrados</CardTitle>
          <CardDescription>
            Administra estado manual y archiva gimnasios para limpiar el listado principal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="mb-2 flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowArchived((current) => !current)}>
              {showArchived ? "Ocultar archivados" : "Mostrar archivados"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {showArchived
                ? "Viendo activos, suspendidos y archivados"
                : "Viendo solo activos y suspendidos"}
            </span>
          </div>
          {tenantsQuery.isLoading ? <p>Cargando gimnasios...</p> : null}
          {tenantsQuery.isError ? <p className="text-destructive">No fue posible cargar gimnasios.</p> : null}
          {tenantsQuery.data?.tenants.map((tenant) => (
            <div key={tenant.id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{tenant.displayName}</p>
                  <p className="text-xs text-muted-foreground">{tenant.slug} · {tenant.discipline}</p>
                </div>
                <span className="text-xs uppercase text-muted-foreground">{tenant.status}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{tenant.legalName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Usuarios: {tenant.usersCount} · Miembros: {tenant.membersCount}
              </p>
              {editingTenantId === tenant.id ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Slug</Label>
                    <Input
                      value={editSlug}
                      onChange={(event) => setEditSlug(event.target.value.toLowerCase().replace(/\s+/g, "-"))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Disciplina</Label>
                    <Select value={editDiscipline} onValueChange={(value) => setEditDiscipline(value as Discipline)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Disciplina" />
                      </SelectTrigger>
                      <SelectContent>
                        {disciplineOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nombre comercial</Label>
                    <Input value={editDisplayName} onChange={(event) => setEditDisplayName(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Razon social</Label>
                    <Input value={editLegalName} onChange={(event) => setEditLegalName(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Correo administrador</Label>
                    <Input value={editAdminEmail} onChange={(event) => setEditAdminEmail(event.target.value.toLowerCase())} placeholder="owner@newgym.com" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefono administrador (WhatsApp)</Label>
                    <Input value={editAdminPhone} onChange={(event) => setEditAdminPhone(event.target.value)} placeholder="+573001234567" />
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      editTenantMutation.mutate({
                        tenantId: tenant.id,
                        slug: editSlug,
                        legalName: editLegalName,
                        displayName: editDisplayName,
                        discipline: editDiscipline,
                        adminEmail: editAdminEmail?.length ? editAdminEmail : undefined,
                        adminPhone: editAdminPhone?.length ? editAdminPhone : undefined,
                      })
                    }
                    disabled={editTenantMutation.isPending}
                  >
                    {editTenantMutation.isPending ? "Guardando..." : "Guardar cambios"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditingTenantId(null)}>
                    Cancelar edicion
                  </Button>
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {tenant.status === "active" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => statusMutation.mutate({ tenantId: tenant.id, status: "suspended" })}
                    disabled={statusMutation.isPending}
                  >
                    Inhabilitar gimnasio
                  </Button>
                ) : null}
                {tenant.status === "suspended" ? (
                  <Button
                    size="sm"
                    onClick={() => statusMutation.mutate({ tenantId: tenant.id, status: "active" })}
                    disabled={statusMutation.isPending}
                  >
                    Habilitar gimnasio
                  </Button>
                ) : null}
                {tenant.status !== "archived" ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => statusMutation.mutate({ tenantId: tenant.id, status: "archived" })}
                    disabled={statusMutation.isPending}
                  >
                    Archivar gimnasio
                  </Button>
                ) : null}
                {tenant.status !== "archived" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEditTenant(tenant)}
                    disabled={editTenantMutation.isPending}
                  >
                    Editar datos
                  </Button>
                ) : null}
                {tenant.status !== "archived" ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteTenantWithVerification(tenant)}
                    disabled={deleteTenantMutation.isPending}
                  >
                    Eliminar definitivo
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {statusMutation.isError ? <p className="text-sm text-destructive">{statusMutation.error.message}</p> : null}
          {statusMutation.isSuccess ? <p className="text-sm text-muted-foreground">Estado del gimnasio actualizado.</p> : null}
          {editTenantMutation.isError ? <p className="text-sm text-destructive">{editTenantMutation.error.message}</p> : null}
          {editTenantMutation.isSuccess ? <p className="text-sm text-muted-foreground">Datos del gimnasio actualizados.</p> : null}
          {deleteTenantMutation.isError ? <p className="text-sm text-destructive">{deleteTenantMutation.error.message}</p> : null}
          {deleteTenantMutation.isSuccess ? <p className="text-sm text-muted-foreground">Gimnasio eliminado definitivamente.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
