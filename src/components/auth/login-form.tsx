"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sedgwick_Ave_Display } from "next/font/google";

const sedgwick = Sedgwick_Ave_Display({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

type LoginStep = "credentials" | "verify";

type TenantOption = {
  slug: string;
  displayName: string;
};

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [expiresAtIso, setExpiresAtIso] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [selectedTenantSlug, setSelectedTenantSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);

  useEffect(() => {
    if (step !== "verify" || !expiresAtIso) {
      setRemainingSeconds(null);
      return;
    }

    const updateCountdown = () => {
      const expiresAtMs = new Date(expiresAtIso).getTime();
      if (Number.isNaN(expiresAtMs)) {
        setRemainingSeconds(null);
        return;
      }
      const diffSeconds = Math.floor((expiresAtMs - Date.now()) / 1000);
      setRemainingSeconds(Math.max(0, diffSeconds));
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [step, expiresAtIso]);

  const isCodeExpired = remainingSeconds !== null && remainingSeconds <= 0;
  const minutesLeft = remainingSeconds !== null ? Math.floor(remainingSeconds / 60) : 0;
  const secondsLeft = remainingSeconds !== null ? remainingSeconds % 60 : 0;

  const handleCredentials = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          tenantSlug: selectedTenantSlug || undefined,
        }),
      });

      const payload = await response.json();
      if (payload.requiresTenantSelection && Array.isArray(payload.tenants)) {
        setTenantOptions(payload.tenants as TenantOption[]);
        setSelectedTenantSlug((payload.tenants[0] as TenantOption | undefined)?.slug ?? "");
        return;
      }

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          throw new Error(`Demasiados intentos. Intenta de nuevo en ${retryAfter} segundos.`);
        }
      }

      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible iniciar sesion");
      }

      setTenantOptions([]);
      setSelectedTenantSlug("");
      if (payload.requiresTwoFactor) {
        setChallengeId(payload.challengeId);
        setDevCode(payload.devCode);
        setExpiresAtIso(typeof payload.expiresAt === "string" ? payload.expiresAt : null);
        setStep("verify");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fallo el inicio de sesion";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      });
      const payload = await response.json();
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          throw new Error(`Demasiados intentos de verificacion. Intenta de nuevo en ${retryAfter} segundos.`);
        }
      }

      if (!response.ok) {
        throw new Error(payload.message ?? "Codigo de verificacion invalido");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fallo la verificacion";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!challengeId) {
      setError("No hay challenge activo. Inicia sesion de nuevo.");
      return;
    }

    setError(null);
    setIsResendingCode(true);

    try {
      const response = await fetch("/api/auth/2fa/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId }),
      });

      const payload = await response.json();
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          throw new Error(`Demasiados reenvios. Intenta de nuevo en ${retryAfter} segundos.`);
        }
      }

      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible reenviar el codigo");
      }

      setExpiresAtIso(typeof payload.expiresAt === "string" ? payload.expiresAt : null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No fue posible reenviar el codigo";
      setError(message);
    } finally {
      setIsResendingCode(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      {/* Background Image full screen */}
      <div className="absolute inset-0 z-0 bg-zinc-950">
        <Image
          src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop"
          alt="Gym background"
          fill
          priority
          className="h-full w-full object-cover opacity-30 brightness-75 grayscale sepia-0 contrast-125"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/60 to-zinc-950/20 mix-blend-multiply" />
      </div>
      
      <div className="relative z-10 flex w-full max-w-md flex-col items-center space-y-8">
        {/* Centered Title */}
        <div className="flex flex-col items-center space-y-3 text-center">
          <span className={`${sedgwick.className} text-5xl sm:text-6xl tracking-widest text-[var(--brand)] drop-shadow-[0_4px_12px_rgba(50,150,255,0.4)]`}>
            LEGIONS CLUB
          </span>
          <p className="text-sm font-medium text-zinc-300 drop-shadow-md">
            El sudor es tu mejor accesorio. Entrena duro.
          </p>
        </div>
        
        {/* Form Container */}
        <div className="w-full">
          <Card className="w-full border border-[var(--brand)]/30 bg-zinc-950/80 shadow-[0_0_30px_rgba(50,150,255,0.1)] backdrop-blur-md relative overflow-hidden">
            {/* Subtle top neon accent line */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[var(--brand)] to-transparent opacity-80" />
            
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight uppercase">Iniciar sesion</CardTitle>
              <CardDescription className="opacity-90">
                Ingresa tus credenciales para continuar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
          {step === "credentials" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (tenantOptions.length > 0) {
                      setTenantOptions([]);
                      setSelectedTenantSlug("");
                    }
                  }}
                  placeholder="owner@mygym.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contrasena</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (tenantOptions.length > 0) {
                      setTenantOptions([]);
                      setSelectedTenantSlug("");
                    }
                  }}
                  placeholder="••••••••"
                />
              </div>
              {tenantOptions.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="tenant">Selecciona tu sede</Label>
                  <Select value={selectedTenantSlug} onValueChange={setSelectedTenantSlug}>
                    <SelectTrigger id="tenant">
                      <SelectValue placeholder="Selecciona gimnasio" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenantOptions.map((tenant) => (
                        <SelectItem key={tenant.slug} value={tenant.slug}>
                          {tenant.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <Button className="w-full" disabled={isLoading} onClick={handleCredentials}>
                {isLoading
                  ? "Iniciando sesion..."
                  : tenantOptions.length > 0
                    ? "Continuar con sede"
                    : "Ingresar"}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">Codigo de verificacion</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="123456"
                  maxLength={6}
                />
              </div>
              {remainingSeconds !== null ? (
                <p className="text-xs text-muted-foreground">
                  {isCodeExpired
                    ? "El codigo vencio. Reenvia uno nuevo."
                    : `Tu codigo vence en ${String(minutesLeft).padStart(2, "0")}:${String(secondsLeft).padStart(2, "0")}`}
                </p>
              ) : null}
              {devCode ? (
                <p className="rounded-md border p-2 text-xs text-muted-foreground">
                  Codigo de desarrollo: <span className="font-semibold text-foreground">{devCode}</span>
                </p>
              ) : null}
              <Button className="w-full" disabled={isLoading || isCodeExpired} onClick={handleVerify}>
                {isLoading ? "Verificando..." : "Verificar e ingresar"}
              </Button>
              <Button className="w-full" type="button" variant="outline" disabled={isResendingCode} onClick={handleResendCode}>
                {isResendingCode ? "Reenviando..." : "Reenviar codigo"}
              </Button>
            </>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
        </div>
      </div>
    </main>
  );
}