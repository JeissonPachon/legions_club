"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type HealthPayload = {
  status: "ok";
  app: string;
  timestamp: string;
};

async function fetchHealth(): Promise<HealthPayload> {
  const response = await fetch("/api/health", { method: "GET" });
  if (!response.ok) {
    throw new Error("No fue posible consultar el estado del servicio");
  }
  return response.json() as Promise<HealthPayload>;
}

export function SystemStatus() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["system-health"],
    queryFn: fetchHealth,
  });

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-base">Estado del sistema</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {isLoading ? <p>Verificando estado del servicio...</p> : null}
        {isError ? <p>La verificacion del servicio fallo.</p> : null}
        {data ? (
          <>
            <p className="font-medium text-foreground">{data.status.toUpperCase()}</p>
            <p>{data.app}</p>
            <p>Actualizado: {new Date(data.timestamp).toLocaleString()}</p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}