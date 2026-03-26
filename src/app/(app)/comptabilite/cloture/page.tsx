"use client";

import { useState, useTransition, useEffect } from "react";
import { useSociety } from "@/providers/society-provider";
import { getFiscalYears, createFiscalYear, closeFiscalYear } from "@/actions/accounting";
import type { FiscalYearRow } from "@/actions/accounting";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Lock, Plus, CheckCircle2, AlertTriangle, Archive } from "lucide-react";
import { toast } from "sonner";

export default function CloturePage() {
  const { activeSociety } = useSociety();
  const [isPending, startTransition] = useTransition();
  const [fiscalYears, setFiscalYears] = useState<FiscalYearRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newYear, setNewYear] = useState({ year: new Date().getFullYear(), startDate: "", endDate: "" });

  function reload() {
    if (!activeSociety?.id) return;
    getFiscalYears(activeSociety.id).then(r => { if (r.success && r.data) setFiscalYears(r.data); });
  }

  useEffect(() => { reload(); }, [activeSociety?.id]);

  function handleCreate() {
    if (!activeSociety?.id) return;
    startTransition(async () => {
      const res = await createFiscalYear(activeSociety.id, newYear);
      if (res.success) {
        toast.success("Exercice cr\u00e9\u00e9");
        setShowCreate(false);
        reload();
      } else {
        toast.error(res.error ?? "Erreur");
      }
    });
  }

  function handleClose(fiscalYearId: string, year: number) {
    if (!activeSociety?.id) return;
    startTransition(async () => {
      const res = await closeFiscalYear(activeSociety.id, fiscalYearId);
      if (res.success) {
        toast.success(`Exercice ${year} cl\u00f4tur\u00e9 avec succ\u00e8s`);
        reload();
      } else {
        toast.error(res.error ?? "Erreur lors de la cl\u00f4ture");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Archive className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Exercices et Cl\u00f4ture</h1>
            <p className="text-sm text-muted-foreground">Gestion des exercices comptables et cl\u00f4ture annuelle</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(s => !s)} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />Nouvel exercice
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cr\u00e9er un exercice</CardTitle>
            <CardDescription>Un exercice doit \u00eatre cr\u00e9\u00e9 avant de pouvoir saisir des \u00e9critures pour cette p\u00e9riode.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Ann\u00e9e</Label>
                <Input type="number" value={newYear.year} min={2000} max={2100}
                  onChange={e => setNewYear(s => ({ ...s, year: parseInt(e.target.value) }))} />
              </div>
              <div>
                <Label>Date de d\u00e9but</Label>
                <Input type="date" value={newYear.startDate}
                  onChange={e => setNewYear(s => ({ ...s, startDate: e.target.value }))} />
              </div>
              <div>
                <Label>Date de fin</Label>
                <Input type="date" value={newYear.endDate}
                  onChange={e => setNewYear(s => ({ ...s, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={isPending || !newYear.startDate || !newYear.endDate}>
                {isPending ? "Cr\u00e9ation..." : "Cr\u00e9er l'exercice"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Liste des exercices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ann\u00e9e</TableHead>
                <TableHead>D\u00e9but</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Cl\u00f4tur\u00e9 par</TableHead>
                <TableHead>Date cl\u00f4ture</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fiscalYears.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun exercice cr\u00e9\u00e9</TableCell>
                </TableRow>
              )}
              {fiscalYears.map(fy => (
                <TableRow key={fy.id}>
                  <TableCell className="font-bold text-base">{fy.year}</TableCell>
                  <TableCell>{formatDate(fy.startDate)}</TableCell>
                  <TableCell>{formatDate(fy.endDate)}</TableCell>
                  <TableCell>
                    {fy.isClosed
                      ? <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />Cl\u00f4tur\u00e9</Badge>
                      : <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />En cours</Badge>
                    }
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fy.closedBy ? `${fy.closedBy.firstName ?? ""} ${fy.closedBy.name ?? ""}`.trim() : "\u2014"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fy.closedAt ? formatDateTime(fy.closedAt) : "\u2014"}
                  </TableCell>
                  <TableCell className="text-right">
                    {!fy.isClosed && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" disabled={isPending}>
                            <Lock className="h-3 w-3 mr-1" />Cl\u00f4turer
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-destructive" />
                              Cl\u00f4turer l'exercice {fy.year}\u00a0?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="space-y-2">
                              <p>Cette op\u00e9ration est <strong>irr\u00e9versible</strong>. Elle va\u00a0:</p>
                              <ul className="list-disc pl-4 space-y-1">
                                <li>Verrouiller toutes les \u00e9critures de l'exercice {fy.year}</li>
                                <li>Interdire toute nouvelle \u00e9criture sur cet exercice</li>
                                <li>V\u00e9rifier l'\u00e9quilibre global (d\u00e9bit = cr\u00e9dit)</li>
                              </ul>
                              <p className="font-medium text-destructive">Toutes les \u00e9critures doivent \u00eatre valid\u00e9es avant la cl\u00f4ture.</p>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleClose(fy.id, fy.year)} className="bg-destructive hover:bg-destructive/90">
                              Confirmer la cl\u00f4ture
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Info RGPD */}
      <Card className="border-muted bg-muted/20">
        <CardContent className="py-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-muted-foreground">
            <strong>Dur\u00e9e de conservation\u00a0:</strong> Les donn\u00e9es comptables doivent \u00eatre conserv\u00e9es pendant 10 ans (obligation l\u00e9gale, article L123-22 du Code de commerce). La cl\u00f4ture d'un exercice ne supprime pas les donn\u00e9es.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
