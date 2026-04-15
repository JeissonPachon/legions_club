"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type QrShareActionsProps = {
  qrImageUrl: string;
  gymName?: string | null;
};

export function QrShareActions({ qrImageUrl, gymName }: QrShareActionsProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedGymName = (gymName ?? "").trim() || "Legions Club";

  const whatsappShareUrl = useMemo(() => {
    const shareText = [
      `Hola, comparto mi QR de acceso de ${normalizedGymName}.`,
      "Abre este enlace para ver el codigo QR:",
      qrImageUrl,
    ].join("\n");

    return `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  }, [normalizedGymName, qrImageUrl]);

  const canUseNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const handleNativeShare = async () => {
    if (!canUseNativeShare) {
      return;
    }

    setError(null);
    setIsSharing(true);

    try {
      const response = await fetch(qrImageUrl);
      if (!response.ok) {
        throw new Error("No se pudo preparar la imagen del QR para compartir.");
      }

      const blob = await response.blob();
      const imageFile = new File([blob], "legions-qr-acceso.png", {
        type: blob.type || "image/png",
      });

      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [imageFile] })) {
        await navigator.share({
          title: "QR de acceso",
          text: `QR de acceso - ${normalizedGymName}`,
          files: [imageFile],
        });
        return;
      }

      throw new Error("Este dispositivo no permite compartir archivos desde el navegador.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No fue posible compartir la imagen.";
      setError(message);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-2 sm:w-auto">
      {canUseNativeShare ? (
        <Button type="button" variant="default" className="w-full sm:w-auto" onClick={handleNativeShare} disabled={isSharing}>
          {isSharing ? "Preparando imagen..." : "Compartir imagen"}
        </Button>
      ) : null}

      <Button asChild variant="outline" className="w-full sm:w-auto">
        <a href={whatsappShareUrl} target="_blank" rel="noopener noreferrer">
          Compartir enlace por WhatsApp
        </a>
      </Button>

      {error ? <p className="text-center text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
