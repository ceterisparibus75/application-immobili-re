"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { deleteOverpaymentAdjustments } from "@/actions/overpayment-cleanup";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface Adjustment {
  id: string;
  tenantId: string;
  tenantName: string;
  amount: number;
  dueDate: string;
  formattedDueDate: string;
  notes: string | null;
  reference: string | null;
}

interface Props {
  societyId: string;
  societyName: string;
  count: number;
  totalCredited: number;
  adjustments: Adjustment[];
}

export function CleanupGroupCard({
  societyId,
  societyName,
  count,
  totalCredited,
  adjustments,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selected.size === adjustments.length) setSelected(new Set());
    else setSelected(new Set(adjustments.map((a) => a.id)));
  }

  function handleDeleteSelected() {
    if (selected.size === 0) return;
    const n = selected.size;
    if (!confirm(`Supprimer ${n} ajustement${n > 1 ? "s" : ""} pour « ${societyName} » ? Cette action est irréversible.`)) {
      return;
    }
    startTransition(async () => {
      const r = await deleteOverpaymentAdjustments(societyId, Array.from(selected));
      if (r.success) {
        toast.success(`${r.data?.deleted ?? 0} ajustement(s) supprimé(s)`);
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(r.error ?? "Erreur");
      }
    });
  }

  function handleDeleteAll() {
    if (!confirm(`Supprimer les ${count} ajustements fantômes de « ${societyName} » ? Cette action est irréversible.`)) {
      return;
    }
    startTransition(async () => {
      const r = await deleteOverpaymentAdjustments(societyId);
      if (r.success) {
        toast.success(`${r.data?.deleted ?? 0} ajustement(s) supprimé(s)`);
        router.refresh();
      } else {
        toast.error(r.error ?? "Erreur");
      }
    });
  }

  const allSelected = selected.size === adjustments.length && adjustments.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <div className="flex items-center gap-2">
            <span>{societyName}</span>
            <Badge variant="outline">{count} à nettoyer</Badge>
            <span className="text-sm text-muted-foreground">
              — crédit cumulé : {formatCurrency(totalCredited)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {open ? "Masquer" : "Détail"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteAll}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Tout supprimer
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              <span>Tout sélectionner ({selected.size} / {adjustments.length})</span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={isPending || selected.size === 0}
            >
              Supprimer la sélection
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Locataire</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead className="text-right">Crédit</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(a.id)}
                      onCheckedChange={() => toggle(a.id)}
                    />
                  </TableCell>
                  <TableCell className="text-sm">{a.formattedDueDate}</TableCell>
                  <TableCell className="text-sm">{a.tenantName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.reference ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {formatCurrency(Math.abs(a.amount))}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-sm truncate">
                    {a.notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}
