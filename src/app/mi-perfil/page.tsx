import { getAuthContext } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QRCodeCanvas } from "qrcode.react";
import { ChangePassword } from "@/components/mi-perfil/change-password";

type PerfilMeasurement = {
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

type PerfilPayload = {
  member: { id: string };
  anthropometrics: PerfilMeasurement[];
  subscription: {
    planName?: string;
    endDate: string;
    sessionsRemaining: number;
  } | null;
  gymName?: string | null;
};

async function getMemberData(userId: string, tenantId: string) {
  // Lógica para obtener datos del miembro, medidas y plan activo
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/mi-perfil`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, tenantId }),
    cache: "no-store"
  });
  if (!res.ok) return null;
  return (await res.json()) as PerfilPayload;
}

export default async function MiPerfilPage() {
  const auth = await getAuthContext();
  if (!auth || auth.role !== "athlete") redirect("/auth/login");

  const data = await getMemberData(auth.userId, auth.tenantId);
  if (!data) return <div>No se pudo cargar tu información.</div>;

  const { member, anthropometrics, subscription } = data;

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      {data.gymName ? (
        <Card>
          <CardHeader>
            <CardTitle>Gimnasio</CardTitle>
          </CardHeader>
          <CardContent>{data.gymName}</CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Mi QR de acceso</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-2">
          <QRCodeCanvas value={member.id} size={160} />
          <div className="text-sm text-muted-foreground">Muestra este código para ingresar al gimnasio</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mi plan actual</CardTitle>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div>
              <div><b>Plan:</b> {subscription.planName}</div>
              <div><b>Vence:</b> {new Date(subscription.endDate).toLocaleDateString()}</div>
              <div><b>Sesiones restantes:</b> {subscription.sessionsRemaining}</div>
            </div>
          ) : (
            <div>No tienes un plan activo.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mis medidas</CardTitle>
        </CardHeader>
        <CardContent>
          {anthropometrics.length === 0 ? (
            <div>No hay mediciones registradas.</div>
          ) : (
            <div className="space-y-2">
              {anthropometrics.map((m) => (
                <div key={m.id} className="border rounded p-2">
                  <div className="text-xs text-muted-foreground">{new Date(m.measuredAt).toLocaleString()}</div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {m.weightKg && <span>Peso: {m.weightKg}kg</span>}
                    {m.heightCm && <span>Altura: {m.heightCm}cm</span>}
                    {m.bodyFatPercent && <span>% Grasa: {m.bodyFatPercent}</span>}
                    {m.cinturaCm && <span>Cintura: {m.cinturaCm}cm</span>}
                    {m.caderaCm && <span>Cadera: {m.caderaCm}cm</span>}
                    {m.pechoCm && <span>Pecho: {m.pechoCm}cm</span>}
                    {m.brazoDerechoCm && <span>Brazo der: {m.brazoDerechoCm}cm</span>}
                    {m.brazoIzquierdoCm && <span>Brazo izq: {m.brazoIzquierdoCm}cm</span>}
                    {m.antebrazoDerechoCm && <span>Antebrazo der: {m.antebrazoDerechoCm}cm</span>}
                    {m.antebrazoIzquierdoCm && <span>Antebrazo izq: {m.antebrazoIzquierdoCm}cm</span>}
                    {m.piernaDerechaCm && <span>Pierna der: {m.piernaDerechaCm}cm</span>}
                    {m.piernaIzquierdaCm && <span>Pierna izq: {m.piernaIzquierdaCm}cm</span>}
                    {m.pantorrillaDerechaCm && <span>Pantorrilla der: {m.pantorrillaDerechaCm}cm</span>}
                    {m.pantorrillaIzquierdaCm && <span>Pantorrilla izq: {m.pantorrillaIzquierdaCm}cm</span>}
                  </div>
                  {m.notas && <div className="text-xs mt-1">Notas: {m.notas}</div>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seguridad</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePassword />
        </CardContent>
      </Card>
    </div>
  );
}
