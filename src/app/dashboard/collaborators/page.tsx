"use client";

import dayjs from "dayjs";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Collaborator = {
  id: string;
  fullName: string;
  email: string;
  role: "coach";
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

async function fetchCollaborators(): Promise<{ collaborators: Collaborator[] }> {
  const response = await fetch("/api/collaborators");
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message ?? "No fue posible cargar colaboradores");
  }

  return payload as { collaborators: Collaborator[] };
}

export default function CollaboratorsPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const queryClient = useQueryClient();

  const collaboratorsQuery = useQuery({
    queryKey: ["collaborators"],
    queryFn: fetchCollaborators,
  });

  const createCollaborator = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/collaborators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          password,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible crear el colaborador");
      }

      return payload;
    },
    onSuccess: () => {
      setFullName("");
      setEmail("");
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["collaborators"] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (input: { userId: string; isActive: boolean }) => {
      const response = await fetch(`/api/collaborators/${input.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: input.isActive }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible actualizar el colaborador");
      }

      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaborators"] });
    },
  });

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Agregar colaborador (solo registro de sesiones)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="collaborator-name">Nombre completo</Label>
            <Input
              id="collaborator-name"
              placeholder="Ejemplo: Laura Rojas"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="collaborator-email">Correo</Label>
            <Input
              id="collaborator-email"
              placeholder="colaborador@gym.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="collaborator-password">Contrasena temporal</Label>
            <Input
              id="collaborator-password"
              type="password"
              placeholder="Minimo 8 caracteres"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button
            className="sm:col-span-3"
            onClick={() => createCollaborator.mutate()}
            disabled={createCollaborator.isPending || fullName.trim().length < 2 || password.length < 8}
          >
            {createCollaborator.isPending ? "Guardando..." : "Crear colaborador"}
          </Button>
          {createCollaborator.isError ? (
            <p className="sm:col-span-3 text-sm text-destructive">{createCollaborator.error.message}</p>
          ) : null}
          <p className="sm:col-span-3 text-xs text-muted-foreground">
            Los colaboradores se crean como rol coach y no pueden administrar miembros, planes, suscripciones o finanzas.
          </p>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Colaboradores del gimnasio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {collaboratorsQuery.isLoading ? <p>Cargando colaboradores...</p> : null}
          {collaboratorsQuery.isError ? (
            <p className="text-destructive">{collaboratorsQuery.error.message}</p>
          ) : null}
          {collaboratorsQuery.data?.collaborators.length === 0 ? (
            <p className="text-muted-foreground">Aun no hay colaboradores creados.</p>
          ) : null}
          {collaboratorsQuery.data?.collaborators.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <p className="font-medium">{item.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.email} · {item.isActive ? "Activo" : "Inactivo"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Creado: {dayjs(item.createdAt).format("DD/MM/YYYY")} · Ultimo acceso: {item.lastLoginAt ? dayjs(item.lastLoginAt).format("DD/MM/YYYY HH:mm") : "sin ingreso"}
                </p>
              </div>
              <Button
                variant={item.isActive ? "destructive" : "default"}
                onClick={() => updateStatus.mutate({ userId: item.id, isActive: !item.isActive })}
                disabled={updateStatus.isPending}
              >
                {item.isActive ? "Desactivar" : "Reactivar"}
              </Button>
            </div>
          ))}
          {updateStatus.isError ? <p className="text-sm text-destructive">{updateStatus.error.message}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
