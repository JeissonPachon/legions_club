"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FinanceEntry = {
  id: string;
  entryType: "income" | "expense";
  amountCents: number;
  category: string;
  note: string | null;
  occurredAt: string;
};

type FinancePayload = {
  entries: FinanceEntry[];
  summary: {
    monthIncomeCents: number;
    monthExpenseCents: number;
    monthNetCents: number;
    entriesCount: number;
  };
};

function formatCOP(amountCents: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

async function fetchFinance(): Promise<FinancePayload> {
  const response = await fetch("/api/finance/entries");
  if (!response.ok) {
    throw new Error("No fue posible cargar finanzas del gimnasio");
  }
  return response.json() as Promise<FinancePayload>;
}

export function GymFinancePanel() {
  const [entryType, setEntryType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("0");
  const [category, setCategory] = useState("membership");
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEntryType, setEditEntryType] = useState<"income" | "expense">("income");
  const [editAmount, setEditAmount] = useState("0");
  const [editCategory, setEditCategory] = useState("membership");
  const [editNote, setEditNote] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<FinanceEntry | null>(null);

  const financeQuery = useQuery({ queryKey: ["gym-finance"], queryFn: fetchFinance });

  const createEntry = useMutation({
    mutationFn: async () => {
      const amountCents = Math.round(Number(amount) * 100);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        throw new Error("El monto debe ser mayor que cero");
      }

      const response = await fetch("/api/finance/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryType,
          amountCents,
          category,
          note: note.trim() || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible registrar el movimiento");
      }

      return payload;
    },
    onSuccess: async () => {
      setAmount("0");
      setNote("");
      setLocalError(null);
      await financeQuery.refetch();
    },
    onError: (error) => {
      setLocalError(error instanceof Error ? error.message : "No fue posible guardar el movimiento");
    },
  });

  const updateEntry = useMutation({
    mutationFn: async () => {
      if (!editingId) {
        throw new Error("No se selecciono movimiento para editar");
      }

      const amountCents = Math.round(Number(editAmount) * 100);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        throw new Error("El monto debe ser mayor que cero");
      }

      const response = await fetch(`/api/finance/entries/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryType: editEntryType,
          amountCents,
          category: editCategory,
          note: editNote.trim() || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible actualizar el movimiento");
      }

      return payload;
    },
    onSuccess: async () => {
      setEditingId(null);
      setLocalError(null);
      await financeQuery.refetch();
    },
    onError: (error) => {
      setLocalError(error instanceof Error ? error.message : "No fue posible actualizar el movimiento");
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const response = await fetch(`/api/finance/entries/${entryId}`, {
        method: "DELETE",
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible eliminar el movimiento");
      }

      return payload;
    },
    onSuccess: async () => {
      setEditingId(null);
      setDeleteTarget(null);
      setLocalError(null);
      await financeQuery.refetch();
    },
    onError: (error) => {
      setLocalError(error instanceof Error ? error.message : "No fue posible eliminar el movimiento");
    },
  });

  function openEdit(entry: FinanceEntry) {
    setEditingId(entry.id);
    setEditEntryType(entry.entryType);
    setEditAmount(String(entry.amountCents / 100));
    setEditCategory(entry.category);
    setEditNote(entry.note ?? "");
    setLocalError(null);
  }

  const summary = financeQuery.data?.summary;

  return (
    <div className="space-y-4">
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => (!open ? setDeleteTarget(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminacion</DialogTitle>
            <DialogDescription>
              Este movimiento se eliminara de forma permanente y no se puede recuperar.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget ? (
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{deleteTarget.category}</p>
              <p>
                {deleteTarget.entryType === "income" ? "Ingreso" : "Gasto"} · {formatCOP(deleteTarget.amountCents)}
              </p>
              <p>{deleteTarget.note ?? "Sin nota"}</p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => (deleteTarget ? deleteEntry.mutate(deleteTarget.id) : null)}
              disabled={deleteEntry.isPending}
            >
              {deleteEntry.isPending ? "Eliminando..." : "Eliminar definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-sm">Ingresos del mes</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-black">{formatCOP(summary?.monthIncomeCents ?? 0)}</CardContent>
        </Card>
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-sm">Gastos del mes</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-black">{formatCOP(summary?.monthExpenseCents ?? 0)}</CardContent>
        </Card>
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-sm">Neto del mes</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-black">{formatCOP(summary?.monthNetCents ?? 0)}</CardContent>
        </Card>
      </section>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Registrar ingreso o gasto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="entryType">Tipo</Label>
            <Select value={entryType} onValueChange={(value) => setEntryType(value as "income" | "expense")}>
              <SelectTrigger id="entryType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Ingreso</SelectItem>
                <SelectItem value="expense">Gasto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Monto (COP)</Label>
            <Input id="amount" type="number" min="0" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Input id="category" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="membresias, nomina, arriendo..." />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Nota</Label>
            <Input id="note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Opcional" />
          </div>

          <Button className="sm:col-span-4" onClick={() => createEntry.mutate()} disabled={createEntry.isPending || category.trim().length < 2}>
            {createEntry.isPending ? "Guardando..." : "Guardar movimiento"}
          </Button>

          {localError ? <p className="sm:col-span-4 text-sm text-destructive">{localError}</p> : null}
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Movimientos recientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {financeQuery.isLoading ? <p>Cargando datos financieros...</p> : null}
          {financeQuery.isError ? <p className="text-destructive">No fue posible cargar movimientos.</p> : null}
          {financeQuery.data?.entries.slice(0, 20).map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">{entry.category}</p>
                <p className="text-xs text-muted-foreground">{entry.note ?? "Sin nota"}</p>
                <p className="text-xs text-muted-foreground">{new Date(entry.occurredAt).toLocaleString()}</p>
                {editingId === entry.id ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select value={editEntryType} onValueChange={(value) => setEditEntryType(value as "income" | "expense")}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Ingreso</SelectItem>
                          <SelectItem value="expense">Gasto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Monto (COP)</Label>
                      <Input type="number" min="0" step="1" value={editAmount} onChange={(event) => setEditAmount(event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Categoria</Label>
                      <Input value={editCategory} onChange={(event) => setEditCategory(event.target.value)} placeholder="Categoria" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Nota</Label>
                      <Input value={editNote} onChange={(event) => setEditNote(event.target.value)} placeholder="Nota" />
                    </div>
                    <Button variant="outline" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                    <Button onClick={() => updateEntry.mutate()} disabled={updateEntry.isPending || editCategory.trim().length < 2}>
                      {updateEntry.isPending ? "Guardando..." : "Guardar cambios"}
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={entry.entryType === "income" ? "text-green-600" : "text-red-600"}>
                  {entry.entryType === "income" ? "+" : "-"}{formatCOP(entry.amountCents)}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(entry)}>
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteTarget(entry)}
                    disabled={deleteEntry.isPending}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
