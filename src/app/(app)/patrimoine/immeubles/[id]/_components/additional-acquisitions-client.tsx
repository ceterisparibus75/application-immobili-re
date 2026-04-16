"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { createAdditionalAcquisition, deleteAdditionalAcquisition } from "@/actions/building";
import { toast } from "sonner";

type AdditionalAcquisition = {
  id: string;
  label: string;
  acquisitionDate?: Date | string | null;
  acquisitionPrice: number;
  acquisitionFees?: number | null;
  acquisitionTaxes?: number | null;
  otherCosts?: number | null;
  description?: string | null;
};

function fmt(v: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

function parseNum(s: string): number {
  return parseFloat(s.replace(/\s/g, "").replace(",", ".")) || 0;
}

export function AdditionalAcquisitionsClient({
  societyId,
  buildingId,
  initialAcquisitions,
}: {
  societyId: string;
  buildingId: string;
  initialAcquisitions: AdditionalAcquisition[];
}) {
  const [acquisitions, setAcquisitions] = useState(initialAcquisitions);
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("");
  const [taxes, setTaxes] = useState("");
  const [other, setOther] = useState("");
  const [description, setDescription] = useState("");

  function resetForm() {
    setLabel(""); setDate(""); setPrice(""); setFees(""); setTaxes(""); setOther(""); setDescription("");
    setShowForm(false);
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !date || !price) return;
    startTransition(async () => {
      const result = await createAdditionalAcquisition(societyId, buildingId, {
        label: label.trim(),
        acquisitionDate: date,
        acquisitionPrice: parseNum(price),
        acquisitionFees: fees ? parseNum(fees) : null,
        acquisitionTaxes: taxes ? parseNum(taxes) : null,
        otherCosts: other ? parseNum(other) : null,
        description: description.trim() || null,
      });
      if (result.success && result.data) {
        setAcquisitions((prev) => [
          ...prev,
          {
            id: result.data!.id,
            label: label.trim(),
            acquisitionDate: date,
            acquisitionPrice: parseNum(price),
            acquisitionFees: fees ? parseNum(fees) : null,
            acquisitionTaxes: taxes ? parseNum(taxes) : null,
            otherCosts: other ? parseNum(other) : null,
            description: description.trim() || null,
          },
        ]);
        toast.success("Acquisition complémentaire ajoutée");
        resetForm();
      } else {
        toast.error(result.error ?? "Erreur lors de l'ajout");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteAdditionalAcquisition(societyId, id);
      if (result.success) {
        setAcquisitions((prev) => prev.filter((a) => a.id !== id));
        toast.success("Acquisition supprimée");
      } else {
        toast.error(result.error ?? "Erreur lors de la suppression");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Separator />
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Acquisitions complémentaires ({acquisitions.length})
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setShowForm((v) => !v)}
          disabled={isPending}
        >
          {showForm ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
          {showForm ? "Annuler" : "Ajouter"}
        </Button>
      </div>

      {/* Liste */}
      {acquisitions.length > 0 && (
        <div className="space-y-2">
          {acquisitions.map((a) => {
            const total = a.acquisitionPrice + (a.acquisitionFees ?? 0) + (a.acquisitionTaxes ?? 0) + (a.otherCosts ?? 0);
            return (
              <div key={a.id} className="flex items-start justify-between gap-2 p-2 rounded-md bg-muted/40 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{a.label}</p>
                  {a.acquisitionDate && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.acquisitionDate).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Prix : {fmt(a.acquisitionPrice)}
                    {(a.acquisitionFees ?? 0) > 0 && ` · Frais : ${fmt(a.acquisitionFees!)}`}
                    {(a.acquisitionTaxes ?? 0) > 0 && ` · Taxes : ${fmt(a.acquisitionTaxes!)}`}
                    {(a.otherCosts ?? 0) > 0 && ` · Autres : ${fmt(a.otherCosts!)}`}
                  </p>
                  <p className="text-xs font-semibold">Total : {fmt(total)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(a.id)}
                  disabled={isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <form onSubmit={handleAdd} className="space-y-3 p-3 border rounded-lg bg-muted/20">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Libellé *</Label>
              <Input
                className="h-8 text-sm"
                placeholder="ex: Acquisition lot annexe"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date d&apos;acte *</Label>
              <Input
                type="date"
                className="h-8 text-sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prix d&apos;acquisition (€) *</Label>
              <Input
                className="h-8 text-sm"
                placeholder="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Frais de notaire (€)</Label>
              <Input className="h-8 text-sm" placeholder="0" value={fees} onChange={(e) => setFees(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Droits de mutation (€)</Label>
              <Input className="h-8 text-sm" placeholder="0" value={taxes} onChange={(e) => setTaxes(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Autres coûts (€)</Label>
              <Input className="h-8 text-sm" placeholder="0" value={other} onChange={(e) => setOther(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Note</Label>
              <Input className="h-8 text-sm" placeholder="Optionnel" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <Button type="submit" size="sm" className="w-full h-8" disabled={isPending}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Ajouter l&apos;acquisition
          </Button>
        </form>
      )}
    </div>
  );
}
