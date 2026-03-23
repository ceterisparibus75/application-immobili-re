"use client";

import { useState, useTransition } from "react";
import {
  createChargeProvision,
  updateChargeProvision,
  deleteChargeProvision,
} from "@/actions/chargeProvision";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Link2, Info } from "lucide-react";
import Link from "next/link";
import { PROVISION_LABELS } from "@/validations/chargeProvision";
import { formatCurrency } from "@/lib/utils";

const VAT_RATES = [
  { value: "0", label: "0 % (exonéré)" },
  { value: "2.1", label: "2,1 %" },
  { value: "5.5", label: "5,5 %" },
  { value: "8.5", label: "8,5 % (DOM-TOM)" },
  { value: "10", label: "10 %" },
  { value: "20", label: "20 %" },
];

type Provision = {
  id: string;
  label: string;
  monthlyAmount: number;
  vatRate: number;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
};

type Props = {
  leaseId: string;
  lotId: string;
  societyId: string;
  provisions: Provision[];
  isActive: boolean;
  leaseVatRate: number;
  leaseVatApplicable: boolean;
};

type FormState = {
  label: string;
  monthlyAmount: string;
  vatRate: string;
  startDate: string;
  endDate: string;
};

const EMPTY_FORM: FormState = {
  label: "Provision sur charges",
  monthlyAmount: "",
  vatRate: "20",
  startDate: new Date().toISOString().split("T")[0]!,
  endDate: "",
};

function toDateString(d: Date) {
  return new Date(d).toISOString().split("T")[0]!;
}

export function ChargeProvisions({ leaseId, lotId, societyId, provisions, isActive, leaseVatRate, leaseVatApplicable }: Props) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const activeProvisions = provisions.filter((p) => p.isActive);
  const monthlyTotal = activeProvisions.reduce((s, p) => s + p.monthlyAmount, 0);

  function defaultVatRateForLabel(label: string): string {
    if (label === "Taxe foncière") return "0";
    if (leaseVatApplicable) return String(leaseVatRate);
    return "0";
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, vatRate: defaultVatRateForLabel(EMPTY_FORM.label) });
    setError("");
    setOpen(true);
  }

  function handleLabelChange(newLabel: string) {
    setForm((f) => ({
      ...f,
      label: newLabel,
      // Auto-suggest TVA only when creating (not editing)
      ...(editingId === null && { vatRate: defaultVatRateForLabel(newLabel) }),
    }));
  }

  function openEdit(p: Provision) {
    setEditingId(p.id);
    setForm({
      label: p.label,
      monthlyAmount: String(p.monthlyAmount),
      vatRate: String(p.vatRate),
      startDate: toDateString(p.startDate),
      endDate: p.endDate ? toDateString(p.endDate) : "",
    });
    setError("");
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      let result;
      if (editingId) {
        result = await updateChargeProvision(societyId, {
          id: editingId,
          label: form.label,
          monthlyAmount: parseFloat(form.monthlyAmount),
          vatRate: parseFloat(form.vatRate),
          startDate: form.startDate,
          endDate: form.endDate || null,
        });
      } else {
        result = await createChargeProvision(societyId, {
          leaseId,
          lotId,
          label: form.label,
          monthlyAmount: parseFloat(form.monthlyAmount),
          vatRate: parseFloat(form.vatRate),
          startDate: form.startDate,
          endDate: form.endDate || null,
        });
      }

      if (result.success) {
        setOpen(false);
      } else {
        setError(result.error ?? "Erreur inconnue");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteChargeProvision(societyId, id);
    });
  }

  return (
    <div className="space-y-3">
      {/* Récapitulatif + lien facturation */}
      {activeProvisions.length > 0 && (
        <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Total provisions actives / mois
          </span>
          <span className="font-semibold">{formatCurrency(monthlyTotal)}</span>
        </div>
      )}

      {/* Note lien facturation */}
      <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-400">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Les provisions actives sont <strong>automatiquement incluses</strong> dans les appels de loyer générés depuis ce bail.{" "}
          <Link href={`/facturation/nouvelle?leaseId=${leaseId}`} className="underline font-medium">
            Générer un appel de loyer →
          </Link>
        </span>
      </div>

      {/* Liste des provisions */}
      {provisions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Aucune provision configurée
        </p>
      ) : (
        <div className="divide-y">
          {provisions.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{p.label}</span>
                  {!p.isActive && (
                    <Badge variant="secondary" className="text-xs">Inactif</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Depuis le {new Date(p.startDate).toLocaleDateString("fr-FR")}
                  {p.endDate ? ` · Jusqu'au ${new Date(p.endDate).toLocaleDateString("fr-FR")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <div className="text-right">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(p.monthlyAmount)}<span className="text-xs text-muted-foreground font-normal"> / mois</span>
                  </span>
                  <p className="text-xs text-muted-foreground">TVA {p.vatRate} %</p>
                </div>
                {isActive && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(p.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isActive && (
        <Button variant="outline" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Ajouter une provision
        </Button>
      )}

      {/* Dialog ajout / édition */}
      <Dialog open={open} onOpenChange={(v) => { if (!isPending) setOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              {editingId ? "Modifier la provision" : "Nouvelle provision sur charges"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="label">Type de provision *</Label>
              <select
                id="label"
                value={form.label}
                onChange={(e) => handleLabelChange(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                {PROVISION_LABELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
                {!PROVISION_LABELS.includes(form.label as typeof PROVISION_LABELS[number]) && (
                  <option value={form.label}>{form.label}</option>
                )}
              </select>
              {/* Champ libre si "Autre" */}
              {form.label === "Autre" && (
                <Input
                  placeholder="Préciser le libellé..."
                  value={form.label === "Autre" ? "" : form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value || "Autre" }))}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyAmount">Montant mensuel HT (€) *</Label>
                <Input
                  id="monthlyAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.monthlyAmount}
                  onChange={(e) => setForm((f) => ({ ...f, monthlyAmount: e.target.value }))}
                  placeholder="Ex: 150.00"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Pour une taxe annuelle, divisez par 12.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vatRate">Taux de TVA *</Label>
                <select
                  id="vatRate"
                  value={form.vatRate}
                  onChange={(e) => setForm((f) => ({ ...f, vatRate: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {VAT_RATES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                {form.label === "Taxe foncière" && (
                  <p className="text-xs text-muted-foreground">
                    La taxe foncière n&apos;est pas soumise à TVA.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Date de début *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Date de fin</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement...</>
                ) : editingId ? (
                  "Enregistrer"
                ) : (
                  "Ajouter"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
