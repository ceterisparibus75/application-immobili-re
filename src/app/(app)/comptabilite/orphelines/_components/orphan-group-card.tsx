"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NativeSelect } from "@/components/ui/native-select";
import { Loader2, Link2, PlusCircle, ChevronDown, ChevronUp } from "lucide-react";
import {
  attachOrphansToFiscalYear,
  createCoveringFiscalYearAndAttach,
  listOpenFiscalYears,
} from "@/actions/orphan-journal-entries";
import { toast } from "sonner";

interface Props {
  societyId: string;
  societyName: string;
  count: number;
  minDate: string;
  maxDate: string;
  formattedMinDate: string;
  formattedMaxDate: string;
  entries: Array<{
    id: string;
    entryDate: string;
    journalType: string;
    piece: string | null;
    label: string;
  }>;
}

export function OrphanGroupCard({
  societyId,
  societyName,
  count,
  formattedMinDate,
  formattedMaxDate,
  entries,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [fiscalYears, setFiscalYears] = useState<
    Array<{ id: string; year: number; startDate: string; endDate: string }> | null
  >(null);
  const [loadingFys, setLoadingFys] = useState(false);
  const [selectedFyId, setSelectedFyId] = useState("");
  const [isPending, startTransition] = useTransition();

  async function loadFiscalYears() {
    if (fiscalYears !== null) return;
    setLoadingFys(true);
    const res = await listOpenFiscalYears(societyId);
    if (res.success && res.data) {
      setFiscalYears(
        res.data.map((fy) => ({
          id: fy.id,
          year: fy.year,
          startDate: new Date(fy.startDate).toLocaleDateString("fr-FR"),
          endDate: new Date(fy.endDate).toLocaleDateString("fr-FR"),
        })),
      );
    } else {
      toast.error(res.error ?? "Erreur chargement exercices");
    }
    setLoadingFys(false);
  }

  function handleAttach() {
    if (!selectedFyId) {
      toast.error("Sélectionnez un exercice");
      return;
    }
    if (
      !confirm(
        `Rattacher les ${count} orphelines de ${societyName} à l'exercice sélectionné ?`,
      )
    )
      return;
    startTransition(async () => {
      const res = await attachOrphansToFiscalYear(societyId, selectedFyId);
      if (res.success && res.data) {
        toast.success(`${res.data.updated} écriture(s) rattachée(s)`);
        router.refresh();
      } else {
        toast.error(res.error ?? "Erreur");
      }
    });
  }

  function handleCreateCovering() {
    if (
      !confirm(
        `Créer un nouvel exercice couvrant du ${formattedMinDate} au ${formattedMaxDate}, et y rattacher les ${count} orphelines ?`,
      )
    )
      return;
    startTransition(async () => {
      const res = await createCoveringFiscalYearAndAttach(societyId);
      if (res.success && res.data) {
        toast.success(
          `Exercice ${res.data.year} créé — ${res.data.attached} écriture(s) rattachée(s)`,
        );
        router.refresh();
      } else {
        toast.error(res.error ?? "Erreur");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">{societyName}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Du <strong>{formattedMinDate}</strong> au <strong>{formattedMaxDate}</strong>
            </p>
          </div>
          <Badge variant="warning" className="shrink-0">
            {count} orpheline{count > 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action 1 : créer un exercice couvrant */}
        <div className="rounded-md border border-border/60 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <PlusCircle className="h-4 w-4" />
            Créer un nouvel exercice couvrant cette plage
          </div>
          <p className="text-xs text-muted-foreground">
            Crée automatiquement un exercice {new Date(formattedMinDate.split("/").reverse().join("-")).getFullYear()} de janvier à décembre,
            puis rattache les {count} orpheline{count > 1 ? "s" : ""} à ce nouvel exercice.
            Refusé si un exercice existant chevauche déjà la plage.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCreateCovering}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            Créer et rattacher
          </Button>
        </div>

        {/* Action 2 : rattacher à un exercice existant */}
        <div className="rounded-md border border-border/60 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Link2 className="h-4 w-4" />
            Rattacher à un exercice existant
          </div>
          {fiscalYears === null ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadFiscalYears}
              disabled={loadingFys}
            >
              {loadingFys ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Charger les exercices ouverts
            </Button>
          ) : fiscalYears.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Aucun exercice ouvert disponible pour cette société.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <NativeSelect
                value={selectedFyId}
                onChange={(e) => setSelectedFyId(e.target.value)}
                options={[
                  { value: "", label: "— Choisir un exercice —" },
                  ...fiscalYears.map((fy) => ({
                    value: fy.id,
                    label: `${fy.year} (${fy.startDate} → ${fy.endDate})`,
                  })),
                ]}
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAttach}
                disabled={isPending || !selectedFyId}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Rattacher
              </Button>
            </div>
          )}
        </div>

        {/* Détail des entries */}
        <div>
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Détail des {count} écriture{count > 1 ? "s" : ""}
          </button>
          {expanded && (
            <div className="mt-2 max-h-64 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Journal</TableHead>
                    <TableHead>Pièce</TableHead>
                    <TableHead>Libellé</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs tabular-nums">
                        {new Date(e.entryDate).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px]">
                          {e.journalType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{e.piece ?? "—"}</TableCell>
                      <TableCell className="text-xs truncate max-w-xs">{e.label}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
