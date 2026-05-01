"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateDraftInvoice } from "@/actions/invoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type InvoiceLine = {
  label: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
};

const VAT_RATES = [
  { value: "0", label: "0 % (exonéré)" },
  { value: "2.1", label: "2,1 %" },
  { value: "5.5", label: "5,5 %" },
  { value: "8.5", label: "8,5 % (DOM-TOM)" },
  { value: "10", label: "10 %" },
  { value: "20", label: "20 %" },
];

function fmt(v: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);
}

interface Props {
  invoiceId: string;
  societyId: string;
  hasLease: boolean;
  invoiceNumber: string | null;
  issueDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  initialLines: InvoiceLine[];
}

export function EditDraftForm({
  invoiceId,
  societyId,
  hasLease,
  invoiceNumber,
  issueDate: initIssueDate,
  dueDate: initDueDate,
  periodStart: initPeriodStart,
  periodEnd: initPeriodEnd,
  initialLines,
}: Props) {
  const router = useRouter();
  const [issueDate, setIssueDate] = useState(initIssueDate);
  const [dueDate, setDueDate] = useState(initDueDate);
  const [periodStart, setPeriodStart] = useState(initPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(initPeriodEnd);
  const [lines, setLines] = useState<InvoiceLine[]>(
    initialLines.length > 0
      ? initialLines
      : [{ label: "", quantity: 1, unitPrice: 0, vatRate: 20 }]
  );
  const [isSaving, setIsSaving] = useState(false);

  function addLine() {
    setLines([...lines, { label: "", quantity: 1, unitPrice: 0, vatRate: 20 }]);
  }

  function removeLine(index: number) {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof InvoiceLine, value: string | number) {
    setLines(lines.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }

  const totals = lines.reduce(
    (acc, line) => {
      const ht = line.quantity * line.unitPrice;
      const vat = ht * (line.vatRate / 100);
      return { ht: acc.ht + ht, vat: acc.vat + vat, ttc: acc.ttc + ht + vat };
    },
    { ht: 0, vat: 0, ttc: 0 }
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const result = await updateDraftInvoice(societyId, invoiceId, {
        issueDate,
        dueDate,
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        lines,
      });
      if (result.success) {
        toast.success("Brouillon mis à jour");
        router.push(`/facturation/${invoiceId}`);
      } else {
        toast.error(result.error ?? "Erreur lors de la sauvegarde");
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <Link href={`/facturation/${invoiceId}`}>
          <Button variant="ghost" size="icon" type="button">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Modifier le brouillon
          </h1>
          <p className="text-muted-foreground">
            {invoiceNumber ?? "Brouillon sans numéro"} — les modifications sont appliquées à la sauvegarde
          </p>
        </div>
      </div>

      {/* Avertissement Actualiser */}
      {hasLease && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Ce brouillon est lié à un bail. Si vous cliquez sur <strong>Actualiser</strong> depuis la page détail, les paramètres du bail écraseront vos modifications.
          </span>
        </div>
      )}

      {/* Dates */}
      <Card>
        <CardHeader>
          <CardTitle>Dates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="issueDate">Date d&apos;émission *</Label>
              <Input
                id="issueDate"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Date d&apos;échéance *</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="periodStart">Début de période</Label>
              <Input
                id="periodStart"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodEnd">Fin de période</Label>
              <Input
                id="periodEnd"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lignes */}
      <Card>
        <CardHeader>
          <CardTitle>Lignes de facturation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5 space-y-1">
                  {index === 0 && <Label className="text-xs">Désignation</Label>}
                  <Input
                    value={line.label}
                    onChange={(e) => updateLine(index, "label", e.target.value)}
                    placeholder="Ex : Loyer HT — janvier 2025"
                    required
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  {index === 0 && <Label className="text-xs">Qté</Label>}
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={line.quantity}
                    onChange={(e) => updateLine(index, "quantity", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  {index === 0 && <Label className="text-xs">PU HT (€)</Label>}
                  <Input
                    type="number"
                    step={0.01}
                    value={line.unitPrice}
                    onChange={(e) => updateLine(index, "unitPrice", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  {index === 0 && <Label className="text-xs">TVA %</Label>}
                  <select
                    value={String(line.vatRate)}
                    onChange={(e) => updateLine(index, "vatRate", parseFloat(e.target.value))}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {VAT_RATES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1">
                  {index === 0 && <div className="h-4" />}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(index)}
                    disabled={lines.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-4 w-4" />
            Ajouter une ligne
          </Button>

          <div className="border-t pt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total HT</span>
              <span className="font-medium">{fmt(totals.ht)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TVA</span>
              <span className="font-medium">{fmt(totals.vat)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total TTC</span>
              <span>{fmt(totals.ttc)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Link href={`/facturation/${invoiceId}`}>
          <Button variant="outline" type="button">Annuler</Button>
        </Link>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sauvegarde…
            </>
          ) : (
            "Enregistrer les modifications"
          )}
        </Button>
      </div>
    </form>
  );
}