import { redirect } from "next/navigation";
import { GymFinancePanel } from "@/components/dashboard/gym-finance-panel";
import { getAuthContext } from "@/lib/auth/server";
import { canManageGym } from "@/modules/auth/roles";

export default async function GymFinancePage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect("/auth/login");
  }

  if (auth.isSuperAdmin || auth.role === "athlete" || !canManageGym(auth.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Finanzas del gimnasio</h1>
      <p className="text-sm text-muted-foreground">
        Registra ingresos y gastos. Los ingresos por membresias se registran automaticamente al crear suscripciones.
      </p>
      <GymFinancePanel />
    </div>
  );
}