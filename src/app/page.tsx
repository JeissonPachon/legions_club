import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Trophy, Users, Zap, LayoutDashboard, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Sedgwick_Ave_Display } from "next/font/google";
import { getSaasMonthlyFeeSnapshot } from "@/lib/billing/monthly-fee";

const sedgwick = Sedgwick_Ave_Display({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export default async function Home() {
  const feeSnapshot = await getSaasMonthlyFeeSnapshot();
  const currentFeeFormatted = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
  }).format(feeSnapshot.currentFeeCents / 100);

  let nextFeeNote: string | null = null;
  if (feeSnapshot.nextFeeCents && feeSnapshot.nextEffectiveFrom) {
    const nextDate = new Date(feeSnapshot.nextEffectiveFrom);
    const nextFeeFormatted = new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
    }).format(feeSnapshot.nextFeeCents / 100);
    nextFeeNote = `A partir de ${nextDate.toLocaleDateString("es-CO", { year: "numeric", month: "short" })} será ${nextFeeFormatted}/mes`;
  }
  return (
    <main className="relative flex min-h-screen w-full flex-col overflow-hidden">
      {/* Dynamic Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="https://images.unsplash.com/photo-1540497077202-7c8a3999166f?q=80&w=2670&auto=format&fit=crop"
          alt="Gym intensity background"
          fill
          priority
          className="object-cover opacity-40 mix-blend-luminosity scale-105"
        />
        {/* Multicolored Neon Light Leaks for "Variety of Gyms" vibe */}
        <div className="absolute left-[-10%] top-[-10%] h-[50vh] w-[50vw] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute right-[-10%] bottom-[-10%] h-[50vh] w-[50vw] rounded-full bg-purple-600/20 blur-[120px]" />
        <div className="absolute left-[20%] bottom-[20%] h-[30vh] w-[30vw] rounded-full bg-emerald-500/10 blur-[100px]" />
        
        {/* Dark overlay gradient to ensure text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 via-zinc-950/90 to-zinc-950/95" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8 sm:px-10">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <h1 className={`${sedgwick.className} text-4xl sm:text-5xl tracking-widest text-[var(--brand)] drop-shadow-[0_4px_12px_rgba(50,150,255,0.5)]`}>
              LEGIONS CLUB
            </h1>
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex rounded-full border-[var(--brand)]/50 bg-[var(--brand)]/10 px-4 py-1.5 text-xs font-semibold uppercase text-white shadow-[0_0_10px_rgba(50,150,255,0.2)]">
            SaaS Multi-Gym
          </Badge>
        </header>

        <section className="flex flex-1 flex-col justify-center gap-12 py-12 lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-zinc-300 backdrop-blur-md">
              <Zap className="mr-2 size-4 text-[var(--brand)]" />
              Potencia tu negocio fitness
            </div>
            
            <h2 className="text-5xl font-black leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Entrena duro. <br />
              <span className="bg-gradient-to-r from-[var(--brand)] to-purple-500 bg-clip-text text-transparent">Gestiona mejor.</span>
            </h2>
            
            <p className="max-w-xl text-lg text-zinc-400 sm:text-xl">
              Plataforma all-in-one para atletas, coaches y dueños. Desde CrossFit hasta Yoga, centraliza tus pagos, asistencias y rutinas en un solo lugar.
            </p>
            
            <div className="flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg" className="h-14 rounded-full px-8 text-base shadow-[0_0_20px_rgba(50,150,255,0.3)] transition-transform hover:scale-105">
                <Link href="/dashboard">
                  Entrar al panel <ArrowRight className="ml-2 size-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-14 rounded-full border-white/20 bg-black/50 px-8 text-base backdrop-blur-md hover:bg-white/10 text-white">
                <Link href="/auth/login">Iniciar sesion</Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:mr-0">
            {/* Glow behind card */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-[var(--brand)] to-purple-600 opacity-20 blur-xl"></div>
            
            <Card className="relative border border-white/10 bg-zinc-950/80 backdrop-blur-xl">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl text-white">
                  <LayoutDashboard className="size-5 text-[var(--brand)]" />
                  Ecosistema Completo
                </CardTitle>
                <div className="mt-2 text-sm text-zinc-300">
                  Precio SaaS: <span className="font-semibold text-white">{currentFeeFormatted}/mes</span>
                  {nextFeeNote ? <div className="text-xs text-zinc-400 mt-1">{nextFeeNote}</div> : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="flex gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/20">
                    <Users className="size-5 text-[var(--brand)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-200">Para cualquier disciplina</h3>
                    <p className="text-sm text-zinc-400">Gimnasios tradicionales, CrossFit boxes, academias de artes marciales o centros de Pilates.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-purple-500/20">
                    <Trophy className="size-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-200">Experiencia Premium</h3>
                    <p className="text-sm text-zinc-400">Control de suscripciones, reservas de clases y métricas de progreso para tus atletas.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                    <Database className="size-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-200">Datos Aislados & Seguros</h3>
                    <p className="text-sm text-zinc-400">Arquitectura multi-tenant. Tu información y la de tus clientes nunca se cruza con otros gimnasios.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
