"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePassword } from "@/components/mi-perfil/change-password";

type UserPanelPayload = {
  hasMember: boolean;
  message?: string;
  member?: {
    id: string;
    fullName: string;
    documentLast4: string;
  };
  gymName?: string;
  qrPayload?: string;
  subscription?: {
    planName: string;
    sessionsRemaining: number;
    sessionsAssigned: number;
    startDate: string;
    endDate: string;
  } | null;
};

async function fetchUserPanel(): Promise<UserPanelPayload> {
  const response = await fetch("/api/user/panel");
  if (!response.ok) {
    throw new Error("No fue posible cargar el panel de atleta");
  }
  return response.json() as Promise<UserPanelPayload>;
}

export function UserPanel() {
  const query = useQuery({ queryKey: ["user-panel"], queryFn: fetchUserPanel });

  const qrImageUrl = useMemo(() => {
    if (!query.data?.qrPayload) {
      return null;
    }

    return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(query.data.qrPayload)}`;
  }, [query.data?.qrPayload]);

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando tu panel de atleta...</p>;
  }

  if (query.isError) {
    return <p className="text-sm text-destructive">No fue posible cargar el panel de atleta.</p>;
  }

  if (!query.data?.hasMember) {
    return (
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Perfil de atleta pendiente</CardTitle>
          <CardDescription>{query.data?.message ?? "No se encontro un perfil vinculado"}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      {query.data?.gymName ? (
        <div className="lg:col-span-2">
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Gimnasio</CardTitle>
            </CardHeader>
            <CardContent>{query.data.gymName}</CardContent>
          </Card>
        </div>
      ) : null}
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Tu codigo QR de acceso</CardTitle>
          <CardDescription>Usa este codigo en recepcion para registrar asistencia.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {qrImageUrl ? (
            <div className="flex flex-col items-center gap-3">
              <Image
                src={qrImageUrl}
                alt="QR de asistencia del atleta"
                width={260}
                height={260}
                className="rounded-md border bg-white p-2"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">QR no disponible</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Mi suscripcion</CardTitle>
          <CardDescription>
            {query.data.member?.fullName} · Doc ****{query.data.member?.documentLast4}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {query.data.subscription ? (
            <>
              <p>
                <span className="font-semibold">Plan:</span> {query.data.subscription.planName}
              </p>
              <p>
                <span className="font-semibold">Sesiones en este ciclo:</span>{" "}
                {query.data.subscription.sessionsRemaining}/{query.data.subscription.sessionsAssigned}
              </p>
              <p>
                <span className="font-semibold">Periodo:</span>{" "}
                {new Date(query.data.subscription.startDate).toLocaleDateString()} - {" "}
                {new Date(query.data.subscription.endDate).toLocaleDateString()}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">No hay suscripcion activa para este mes.</p>
          )}
        </CardContent>
      </Card>

      <div className="lg:col-span-2">
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Seguridad</CardTitle>
            <CardDescription>Cambia tu contrasena por una mas personal</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePassword />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
