"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    if (newPassword !== confirmPassword) {
      setError("La confirmacion no coincide");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message ?? "Error al cambiar la contrasena");
      setSuccess(payload.message ?? "Contrasena actualizada");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="current">Contrasena actual</Label>
        <Input id="current" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new">Nueva contrasena</Label>
        <Input id="new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirmar nueva contrasena</Label>
        <Input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      </div>
      {error ? <div className="text-sm text-destructive">{error}</div> : null}
      {success ? <div className="text-sm text-success">{success}</div> : null}
      <Button onClick={handleSubmit} disabled={isLoading} className="mt-2">
        {isLoading ? "Actualizando..." : "Cambiar contrasena"}
      </Button>
    </div>
  );
}
