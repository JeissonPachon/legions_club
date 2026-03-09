"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Shield, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sedgwick_Ave_Display } from "next/font/google";

const sedgwick = Sedgwick_Ave_Display({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

type SummaryPayload = {
  activeAthletes: number;
  activeSubscriptions: number;
  todayCheckIns: number;
};

type DashboardOverviewProps = {
  titleLabel?: string;
};

async function fetchSummary(): Promise<SummaryPayload> {
  const response = await fetch("/api/dashboard/summary");
  if (!response.ok) {
    throw new Error("No fue posible cargar las metricas del panel");
  }
  return response.json() as Promise<SummaryPayload>;
}

export function DashboardOverview({ titleLabel = "LEGIONS CLUB" }: DashboardOverviewProps) {
  const [scanInput, setScanInput] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const summaryQuery = useQuery({ queryKey: ["dashboard-summary"], queryFn: fetchSummary });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function attachStreamToVideo() {
    if (!videoRef.current || !streamRef.current) {
      return;
    }

    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {
      // Some browsers block autoplay until explicit interaction.
    });
  }

  function extractMemberId(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (uuidRegex.test(trimmed)) {
      return trimmed;
    }

    if (trimmed.startsWith("http")) {
      try {
        const url = new URL(trimmed);
        const fromQuery = url.searchParams.get("memberId");
        if (fromQuery && uuidRegex.test(fromQuery)) {
          return fromQuery;
        }
      } catch {
        return null;
      }
    }

    try {
      const parsed = JSON.parse(trimmed) as { memberId?: string };
      if (parsed.memberId && uuidRegex.test(parsed.memberId)) {
        return parsed.memberId;
      }
    } catch {
      return null;
    }

    return null;
  }

  const parsedMemberId = extractMemberId(scanInput);

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: parsedMemberId, qrPayload: scanInput }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "Fallo el registro de asistencia");
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setScanInput("");
    },
  });

  function stopCamera() {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraOpen(false);
  }

  async function startCamera() {
    if (isCameraOpen) {
      return;
    }

    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("La camara no es compatible con este navegador.");
      return;
    }

    if (!window.isSecureContext) {
      setCameraError("La camara requiere un contexto seguro (https o localhost).");
      return;
    }

    setIsCameraOpen(true);

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
          audio: false,
        });
      } catch {
        // Fallback for devices/browsers that reject advanced constraints.
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      attachStreamToVideo();

      const BarcodeDetectorCtor = (globalThis as { BarcodeDetector?: new (options?: { formats?: string[] }) => { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;

      if (!BarcodeDetectorCtor) {
        setCameraError("El escaneo QR en vivo no esta disponible aqui. Pega el texto del escaner en el campo.");
        return;
      }

      const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });

      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          return;
        }

        try {
          const barcodes = await detector.detect(videoRef.current);
          const payload = barcodes[0]?.rawValue?.trim();
          if (payload) {
            setScanInput(payload);
            stopCamera();
          }
        } catch {
          // Keep scanning even if a frame fails.
        }
      }, 450);
    } catch (error) {
      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError") {
          setCameraError("Permiso de camara denegado. Habilita el acceso para este sitio e intenta de nuevo.");
        } else if (error.name === "NotFoundError") {
          setCameraError("No se encontro ninguna camara en este equipo.");
        } else if (error.name === "NotReadableError") {
          setCameraError("La camara ya esta siendo usada por otra aplicacion.");
        } else {
          setCameraError(`Error de camara: ${error.name}`);
        }
      } else {
        setCameraError("No fue posible acceder a la camara. Revisa los permisos del navegador.");
      }
      stopCamera();
    }
  }

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const cards = [
    { title: "Atletas activos", value: summaryQuery.data?.activeAthletes ?? 0, icon: Users },
    { title: "Asistencias de hoy", value: summaryQuery.data?.todayCheckIns ?? 0, icon: Activity },
    {
      title: "Suscripciones activas",
      value: summaryQuery.data?.activeSubscriptions ?? 0,
      icon: Shield,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className={`${sedgwick.className} text-xl tracking-wider text-primary opacity-80`}>
          {titleLabel}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Panel</h1>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title} className="border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-base">Registro por QR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="qr-checkin-input">Codigo QR o payload</Label>
            <Input
              id="qr-checkin-input"
              placeholder="Escanea QR (JSON/URL/memberId)"
              value={scanInput}
              onChange={(event) => setScanInput(event.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Compatible con escaneres de mano (entrada por teclado) y texto copiado desde apps de camara.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void startCamera()} disabled={isCameraOpen}>
              Abrir camara
            </Button>
            <Button type="button" variant="outline" onClick={stopCamera} disabled={!isCameraOpen}>
              Cerrar camara
            </Button>
          </div>

          {isCameraOpen ? (
            <div className="overflow-hidden rounded-md border bg-black">
              <video
                ref={(node) => {
                  videoRef.current = node;
                  attachStreamToVideo();
                }}
                className="h-[280px] w-full object-cover"
                playsInline
                muted
                autoPlay
              />
            </div>
          ) : null}

          {cameraError ? <p className="text-sm text-destructive">{cameraError}</p> : null}

          <Button
            onClick={() => checkInMutation.mutate()}
            disabled={checkInMutation.isPending || !parsedMemberId}
          >
            {checkInMutation.isPending ? "Procesando..." : "Registrar asistencia"}
          </Button>
          {!parsedMemberId && scanInput.trim().length > 0 ? (
            <p className="text-sm text-destructive">Payload QR invalido. Debe incluir un memberId valido.</p>
          ) : null}
          {checkInMutation.isError ? (
            <p className="text-sm text-destructive">{checkInMutation.error.message}</p>
          ) : null}
          {checkInMutation.isSuccess ? (
            <p className="text-sm text-foreground">Asistencia registrada correctamente.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}