"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Pencil, X, Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateDraftLines } from "@/actions/invoice";

const VAT_RATES = [
  { value: "0", label: "0 %" },
  { value: "2.1", label: "2,1 %" },
  { value: "5.5", label: "5,5 %" },
  { value: "8.5", label: "8,5 %" },
  { value: "10", label: "10 %" },
  { value: "20", label: "20 %" },
];

type Line = {
  label: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
};

type EditLine = {
  label: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
};

function fmt(v: number) {
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " €";
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function computeTotals(lines: EditLine[]) {
  return lines.reduce(
    (acc, l) => {
      const ht = l.quantity * l.unitPrice;
      const vat = ht * (l.vatRate / 100);
      return { ht: acc.ht + ht, vat: acc.vat + vat, ttc: acc.ttc + ht + vat };
    },
    { ht: 0, vat: 0, ttc: 0 }
  );
}

interface Props {
  invoiceId: string;
  societyId: string;
  isDraft: boolean;
  initialLines: Line[];
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
}

export function LinesEditor({
  invoiceId,
  societyId,
  isDraft,
  initialLines,
  totalHT: initHT,
  totalVAT: initVAT,
  totalTTC: initTTC,
}: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [lines, setLines] = useState<EditLine[]>(
    initialLines.map((l) => ({ label: l.label, quantity: l.quantity, unitPrice: l.unitPrice, vatRate: l.vatRate }))
  );
  const [saving, setSaving] = useState(false);

  // Totaux en mode édition (live-computed). En lecture, on utilise toujours les props (fraîches après router.refresh()).
  const [editTotals, setEditTotals] = useState({ ht: initHT, vat: initVAT, ttc: initTTC });

  function updateLine(index: number, field: keyof EditLine, value: string | number) {
    const next = lines.map((l, i) => (i === index ? { ...l, [field]: value } : l));
    setLines(next);
    const t = computeTotals(next);
    setEditTotals({ ht: round2(t.ht), vat: round2(t.vat), ttc: round2(t.ttc) });
  }

  function addLine() {
    const next = [...lines, { label: "", quantity: 1, unitPrice: 0, vatRate: 20 }];
    setLines(next);
    const t = computeTotals(next);
    setEditTotals({ ht: round2(t.ht), vat: round2(t.vat), ttc: round2(t.ttc) });
  }

  function removeLine(index: number) {
    if (lines.length === 1) return;
    const next = lines.filter((_, i) => i !== index);
    setLines(next);
    const t = computeTotals(next);
    setEditTotals({ ht: round2(t.ht), vat: round2(t.vat), ttc: round2(t.ttc) });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateDraftLines(societyId, invoiceId, lines);
      if (result.success) {
        toast.success("Lignes mises à jour");
        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors de la sauvegarde");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setLines(initialLines.map((l) => ({ label: l.label, quantity: l.quantity, unitPrice: l.unitPrice, vatRate: l.vatRate })));
    setEditTotals({ ht: initHT, vat: initVAT, ttc: initTTC });
    setIsEditing(false);
  }

  // En lecture, les props sont toujours fraîches (server re-render après router.refresh())
  const totals = isEditing ? editTotals : { ht: initHT, vat: initVAT, ttc: initTTC };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Détail de la facture</CardTitle>
          {isDraft && !isEditing && (
            <Button variant="ghost" size="sm" onClick={() => {
              setLines(initialLines.map((l) => ({ label: l.label, quantity: l.quantity, unitPrice: l.unitPrice, vatRate: l.vatRate })));
              setEditTotals({ ht: initHT, vat: initVAT, ttc: initTTC });
              setIsEditing(true);
            }} className="text-muted-foreground hover:text-foreground gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              Modifier les lignes
            </Button>
          )}
          {isDraft && isEditing && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                <X className="h-3.5 w-3.5" />
                Annuler
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || lines.some((l) => !l.label)}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Enregistrer
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!isEditing ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left pb-2">Désignation</th>
                <th className="text-right pb-2">Qté</th>
                <th className="text-right pb-2">PU HT</th>
                <th className="text-right pb-2">TVA %</th>
                <th className="text-right pb-2">Total HT</th>
                <th className="text-right pb-2">Total TTC</th>
              </tr>
            </thead>
            <tbody>
              {initialLines.map((line, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2">{line.label}</td>
                  <td className="py-2 text-right">{line.quantity}</td>
                  <td className="py-2 text-right">{fmt(line.unitPrice)}</td>
                  <td className="py-2 text-right">{line.vatRate} %</td>
                  <td className="py-2 text-right">{fmt(line.totalHT)}</td>
                  <td className="py-2 text-right font-medium">{fmt(line.totalTTC)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground pb-1">
              <div className="col-span-5">Désignation</div>
              <div className="col-span-2 text-right">Qté</div>
              <div className="col-span-2 text-right">PU HT (€)</div>
              <div className="col-span-2 text-right">TVA %</div>
              <div className="col-span-1" />
            </div>
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <Input
                    value={line.label}
                    onChange={(e) => updateLine(index, "label", e.target.value)}
                    placeholder="Désignation"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={line.quantity}
                    onChange={(e) => updateLine(index, "quantity", parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm text-right"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step={0.01}
                    value={line.unitPrice}
                    onChange={(e) => updateLine(index, "unitPrice", parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm text-right"
                  />
                </div>
                <div className="col-span-2">
                  <select
                    value={String(line.vatRate)}
                    onChange={(e) => updateLine(index, "vatRate", parseFloat(e.target.value))}
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {VAT_RATES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1 flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeLine(index)}
                    disabled={lines.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addLine} className="mt-1">
              <Plus className="h-3.5 w-3.5" />
              Ajouter une ligne
            </Button>
          </div>
        )}

        <Separator className="my-4" />

        <div className="space-y-1 text-sm max-w-xs ml-auto">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total HT</span>
            <span>{fmt(totals.ht)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">TVA</span>
            <span>{fmt(totals.vat)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold border-t pt-1 mt-1">
            <span>Total TTC</span>
            <span>{fmt(totals.ttc)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}