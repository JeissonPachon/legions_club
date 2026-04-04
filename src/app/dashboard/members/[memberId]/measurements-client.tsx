"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

type Measurement = {
  id: string;
  measuredAt: string;
  weightKg?: number;
  heightCm?: number;
  bodyFatPercent?: number;
  cinturaCm?: number;
  caderaCm?: number;
  pechoCm?: number;
  brazoDerechoCm?: number;
  brazoIzquierdoCm?: number;
  antebrazoDerechoCm?: number;
  antebrazoIzquierdoCm?: number;
  piernaDerechaCm?: number;
  piernaIzquierdaCm?: number;
  pantorrillaDerechaCm?: number;
  pantorrillaIzquierdaCm?: number;
  notas?: string;
};

async function fetchMeasurements(memberId: string) {
  const res = await fetch(`/api/members/${memberId}/anthropometrics`);
  if (!res.ok) throw new Error("No fue posible cargar las mediciones");
  return res.json() as Promise<{ measurements: Measurement[] }>;
}

export default function MeasurementsClient({ memberId, memberName }: { memberId: string; memberName: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [cinturaCm, setCinturaCm] = useState("");
  const [caderaCm, setCaderaCm] = useState("");
  const [pechoCm, setPechoCm] = useState("");
  const [brazoDerechoCm, setBrazoDerechoCm] = useState("");
  const [brazoIzquierdoCm, setBrazoIzquierdoCm] = useState("");
  const [antebrazoDerechoCm, setAntebrazoDerechoCm] = useState("");
  const [antebrazoIzquierdoCm, setAntebrazoIzquierdoCm] = useState("");
  const [piernaDerechaCm, setPiernaDerechaCm] = useState("");
  const [piernaIzquierdaCm, setPiernaIzquierdaCm] = useState("");
  const [pantorrillaDerechaCm, setPantorrillaDerechaCm] = useState("");
  const [pantorrillaIzquierdaCm, setPantorrillaIzquierdaCm] = useState("");
  const [notas, setNotas] = useState("");

  const measurementsQuery = useQuery({ queryKey: ["measurements", memberId], queryFn: () => fetchMeasurements(memberId) });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        weightKg: weightKg ? parseFloat(weightKg) : undefined,
        heightCm: heightCm ? parseFloat(heightCm) : undefined,
        bodyFatPercent: bodyFat ? parseFloat(bodyFat) : undefined,
        cinturaCm: cinturaCm ? parseFloat(cinturaCm) : undefined,
        caderaCm: caderaCm ? parseFloat(caderaCm) : undefined,
        pechoCm: pechoCm ? parseFloat(pechoCm) : undefined,
        brazoDerechoCm: brazoDerechoCm ? parseFloat(brazoDerechoCm) : undefined,
        brazoIzquierdoCm: brazoIzquierdoCm ? parseFloat(brazoIzquierdoCm) : undefined,
        antebrazoDerechoCm: antebrazoDerechoCm ? parseFloat(antebrazoDerechoCm) : undefined,
        antebrazoIzquierdoCm: antebrazoIzquierdoCm ? parseFloat(antebrazoIzquierdoCm) : undefined,
        piernaDerechaCm: piernaDerechaCm ? parseFloat(piernaDerechaCm) : undefined,
        piernaIzquierdaCm: piernaIzquierdaCm ? parseFloat(piernaIzquierdaCm) : undefined,
        pantorrillaDerechaCm: pantorrillaDerechaCm ? parseFloat(pantorrillaDerechaCm) : undefined,
        pantorrillaIzquierdaCm: pantorrillaIzquierdaCm ? parseFloat(pantorrillaIzquierdaCm) : undefined,
        notas: notas || undefined,
      };

      const res = await fetch(`/api/members/${memberId}/anthropometrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "No fue posible guardar la medición");
      return data;
    },
    onSuccess: () => {
      setWeightKg("");
      setHeightCm("");
      setBodyFat("");
      setCinturaCm("");
      setCaderaCm("");
      setPechoCm("");
      setBrazoDerechoCm("");
      setBrazoIzquierdoCm("");
      setAntebrazoDerechoCm("");
      setAntebrazoIzquierdoCm("");
      setPiernaDerechaCm("");
      setPiernaIzquierdaCm("");
      setPantorrillaDerechaCm("");
      setPantorrillaIzquierdaCm("");
      setNotas("");
      queryClient.invalidateQueries({ queryKey: ["measurements", memberId] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Medidas — {memberName}</h2>
        <div>
          <Button variant="ghost" onClick={() => router.back()}>Volver</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agregar medición</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Peso (kg)</Label>
            <Input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Altura (cm)</Label>
            <Input value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>% Grasa corporal</Label>
            <Input value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Cintura (cm)</Label>
            <Input value={cinturaCm} onChange={(e) => setCinturaCm(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Cadera (cm)</Label>
            <Input value={caderaCm} onChange={(e) => setCaderaCm(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Pecho (cm)</Label>
            <Input value={pechoCm} onChange={(e) => setPechoCm(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Brazo derecho (cm)</Label>
            <Input value={brazoDerechoCm} onChange={(e) => setBrazoDerechoCm(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Brazo izquierdo (cm)</Label>
            <Input value={brazoIzquierdoCm} onChange={(e) => setBrazoIzquierdoCm(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Antebrazo derecho (cm)</Label>
            <Input value={antebrazoDerechoCm} onChange={(e) => setAntebrazoDerechoCm(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Antebrazo izquierdo (cm)</Label>
            <Input value={antebrazoIzquierdoCm} onChange={(e) => setAntebrazoIzquierdoCm(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Pierna derecha (cm)</Label>
            <Input value={piernaDerechaCm} onChange={(e) => setPiernaDerechaCm(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Pierna izquierda (cm)</Label>
            <Input value={piernaIzquierdaCm} onChange={(e) => setPiernaIzquierdaCm(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Pantorrilla derecha (cm)</Label>
            <Input value={pantorrillaDerechaCm} onChange={(e) => setPantorrillaDerechaCm(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Pantorrilla izquierda (cm)</Label>
            <Input value={pantorrillaIzquierdaCm} onChange={(e) => setPantorrillaIzquierdaCm(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-3">
            <Label>Notas</Label>
            <Input value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>

          <Button className="sm:col-span-3" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Guardando..." : "Agregar medición"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent>
          {measurementsQuery.isLoading ? (
            <p>Cargando historial...</p>
          ) : measurementsQuery.isError ? (
            <p className="text-destructive">No fue posible cargar el historial.</p>
          ) : (
            <div className="space-y-2">
              {measurementsQuery.data?.measurements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay mediciones registradas.</p>
              ) : (
                measurementsQuery.data?.measurements.map((m) => (
                  <div key={m.id} className="rounded-md border p-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{new Date(m.measuredAt).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">{m.notas}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-muted-foreground">
                          {m.weightKg ? `${m.weightKg} kg` : ""} {m.heightCm ? `· ${m.heightCm} cm` : ""}
                        </div>
                        <Button variant="outline" size="sm" onClick={async () => {
                          if (!confirm('Eliminar medición?')) return;
                          await fetch(`/api/anthropometrics/${m.id}`, { method: 'DELETE' });
                          queryClient.invalidateQueries({ queryKey: ['measurements', memberId] });
                        }}>
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
