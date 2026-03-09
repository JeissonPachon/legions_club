import Link from "next/link";
import { ArrowRight, Shield, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Sedgwick_Ave_Display } from "next/font/google";

const sedgwick = Sedgwick_Ave_Display({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-10">
      <header className="flex items-center justify-between border-b pb-5">
        <div>
          <h1 className={`${sedgwick.className} text-5xl font-bold tracking-widest text-primary drop-shadow-md`}>
            LEGIONS CLUB
          </h1>
        </div>
        <Badge variant="secondary" className="rounded-full px-4 py-1 text-xs uppercase">
          SaaS multi gimnasio
        </Badge>
      </header>

      <section className="grid flex-1 gap-8 py-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div className="space-y-6">
          <h2 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            Entrena duro. Gestiona mejor.
          </h2>
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            Plataforma full-stack para atletas, coaches y gestores con enfoque multi-centro,
            rendimiento alto y seguridad empresarial.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full px-7">
              <Link href="/dashboard">
                Entrar al panel <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full px-7">
              <Link href="/auth/login">Iniciar sesion</Link>
            </Button>
          </div>
        </div>

        <Card className="border-2 bg-card">
          <CardHeader>
            <CardTitle className="text-xl">Panel para cualquier centro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Users className="size-5" />
              <p className="text-sm text-muted-foreground">Gym, Powerlifting, CrossFit, Pilates y más.</p>
            </div>
            <div className="flex items-center gap-3">
              <Trophy className="size-5" />
              <p className="text-sm text-muted-foreground">Experiencia premium para atleta y staff.</p>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="size-5" />
              <p className="text-sm text-muted-foreground">Controles de seguridad y trazabilidad por tenant.</p>
            </div>
            <div className="rounded-md border p-3 text-xs text-muted-foreground">
              Espacio de marca: iconos, banners, ilustraciones y recursos finales.
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
