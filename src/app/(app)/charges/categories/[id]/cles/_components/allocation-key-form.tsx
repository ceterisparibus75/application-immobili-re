"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setAllocationKey } from "@/actions/allocation-key";
import type { AllocationKeyData } from "@/actions/allocation-key";
import { Loader2, Save, RotateCcw, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface AllocationKeyFormProps {
  societyId: string;
  categoryId: string;
  categoryName: string;
  initialData: AllocationKeyData;
}

export function AllocationKeyForm({
  societyId,
  categoryId,
  categoryName,
  initialData,
}: AllocationKeyFormProps) {
  const [entries, setEntries] = useState(
    initialData.entries.map((e) => ({ ...e, percentageStr: String(e.percentage) }))
  );
  const [loading, setLoading] = useState(false);

  const total = entries.reduce((s, e) => s + (parseFloat(e.percentageStr) || 0), 0);
  const isValid = Math.abs(total - 100) < 0.5;

  function setPercentage(lotId: string, value: string) {
    setEntries((prev) =>
      prev.map((e) => (e.lotId === lotId ? { ...e, percentageStr: value } : e))
    );
  }

  function distributeEqually() {
    const pct = Math.round((100 / entries.length) * 100) / 100;
    const remainder = 100 - pct * (entries.length - 1);
    setEntries((prev) =>
      prev.map((e, i) => ({
        ...e,
        percentageStr: String(i === prev.length - 1 ? Math.round(remainder * 100) / 100 : pct),
      }))
    );
  }

  async function handleSave() {
    setLoading(true);
    try {
      const result = await setAllocationKey(societyId, {
        categoryId,
        entries: entries.map((e) => ({
          lotId: e.lotId,
          percentage: parseFloat(e.percentageStr) || 0,
        })),
      });
      if (result.success) {
        toast.success("Cle de repartition enregistree");
      } else {
        toast.error(result.error ?? "Erreur lors de l'enregistrement");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Categorie : <strong>{categoryName}</strong>
        </p>
        <Button variant="ghost" size="sm" onClick={distributeEqually} type="button">
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          Repartition egale
        </Button>
      </div>

      <div className="rounded-lg border divide-y">
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>Lot</span>
          <span className="w-20 text-right">Surface (m2)</span>
          <span className="w-24 text-right">Part (%)</span>
        </div>
        {entries.map((entry) => (
          <div
            key={entry.lotId}
            className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 items-center"
          >
            <span className="text-sm font-medium">Lot {entry.lotNumber}</span>
            <span className="w-20 text-right text-sm text-muted-foreground">
              {entry.lotArea} m2
            </span>
            <div className="w-24">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={entry.percentageStr}
                onChange={(e) => setPercentage(entry.lotId, e.target.value)}
                className="h-8 text-right text-sm"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isValid && (
            <div className="flex items-center gap-1.5 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              Total : {total.toFixed(1)} % (doit etre 100 %)
            </div>
          )}
          {isValid && (
            <span className="text-sm text-[var(--color-status-positive)]">
              Total : {total.toFixed(1)} %
            </span>
          )}
        </div>
        <Button onClick={handleSave} disabled={loading || !isValid}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}