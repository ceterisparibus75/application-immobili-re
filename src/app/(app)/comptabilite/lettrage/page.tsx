"use client";

import { useEffect, useState, useTransition } from "react";
import { Link2, Loader2, RefreshCw, Unlink2 } from "lucide-react";
import { toast } from "sonner";

import { getAccounts, type AccountRow } from "@/actions/accounting";
import {
  getLetteredGroups,
  getLetteringSuggestions,
  getUnletteredEntries,
  letterEntries,
  unletterEntries,
  type LetteredGroup,
  type LetteringSuggestion,
} from "@/actions/lettering";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useSociety } from "@/providers/society-provider";
import { formatCurrency, formatDate } from "@/lib/utils";

type UnletteredLine = {
  id: string;
  debit: number;
  credit: number;
  label: string | null;
  entryDate: Date;
  piece: string | null;
  entryLabel: string;
};

function selectClassName() {
  return "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";
}

export default function LetteringPage() {
  const { activeSociety } = useSociety();
  const [isPending, startTransition] = useTransition();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [accountId, setAccountId] = useState("");
  const [lines, setLines] = useState<UnletteredLine[]>([]);
  const [letteredGroups, setLetteredGroups] = useState<LetteredGroup[]>([]);
  const [suggestions, setSuggestions] = useState<LetteringSuggestion[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [requestedAccountId, setRequestedAccountId] = useState<string | null>();
  const [allowImbalance, setAllowImbalance] = useState(false);
  const [imbalanceReason, setImbalanceReason] = useState("");

  useEffect(() => {
    setRequestedAccountId(new URLSearchParams(window.location.search).get("accountId"));
  }, []);

  useEffect(() => {
    if (!activeSociety?.id || requestedAccountId === undefined) return;
    getAccounts(activeSociety.id).then((result) => {
      if (!result.success || !result.data) return;
      // Exclure les comptes de résultat (classes 6 et 7) qui ne se lettrent pas.
      // Garder les classes 1, 2, 3, 4, 5.
      const eligibleAccounts = result.data.filter(
        (account) => !account.code.startsWith("6") && !account.code.startsWith("7")
      );
      setAccounts(eligibleAccounts);
      const requestedAccount = eligibleAccounts.find((account) => account.id === requestedAccountId);
      if (requestedAccount) {
        setAccountId(requestedAccount.id);
      } else if (eligibleAccounts[0]) {
        setAccountId(eligibleAccounts[0].id);
      }
    });
  }, [activeSociety?.id, requestedAccountId]);

  function load(nextAccountId = accountId) {
    if (!activeSociety?.id || !nextAccountId) return;
    startTransition(async () => {
      const [unletteredResult, letteredResult, suggestionResult] = await Promise.all([
        getUnletteredEntries(activeSociety.id, nextAccountId),
        getLetteredGroups(activeSociety.id, nextAccountId),
        getLetteringSuggestions(activeSociety.id, nextAccountId),
      ]);

      if (unletteredResult.success && unletteredResult.data) {
        setLines(unletteredResult.data.lines);
        setSelected([]);
      } else {
        toast.error(unletteredResult.error ?? "Erreur lors du chargement des lignes");
      }

      if (letteredResult.success && letteredResult.data) {
        setLetteredGroups(letteredResult.data.groups);
      } else {
        toast.error(letteredResult.error ?? "Erreur lors du chargement des groupes lettrés");
      }

      if (suggestionResult.success && suggestionResult.data) {
        setSuggestions(suggestionResult.data.suggestions);
      } else {
        toast.error(suggestionResult.error ?? "Erreur lors du calcul des suggestions");
      }
    });
  }

  useEffect(() => {
    load(accountId);
    // Chargement uniquement quand le compte sélectionné change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  function toggleLine(lineId: string) {
    setSelected((current) =>
      current.includes(lineId)
        ? current.filter((id) => id !== lineId)
        : [...current, lineId]
    );
  }

  function toggleAll() {
    setSelected((current) =>
      current.length === lines.length ? [] : lines.map((line) => line.id)
    );
  }

  function handleLetter() {
    if (!activeSociety?.id) return;
    if (selected.length < 2) {
      toast.error("Sélectionnez au moins deux lignes à lettrer");
      return;
    }

    const hasImbalance = difference > 0.01;
    if (hasImbalance && !allowImbalance) {
      toast.error("Cochez « Accepter un écart » pour lettrer un groupe déséquilibré");
      return;
    }
    const trimmedReason = imbalanceReason.trim();
    if (hasImbalance && allowImbalance && trimmedReason.length === 0) {
      toast.error("Un motif est obligatoire pour lettrer avec un écart");
      return;
    }

    startTransition(async () => {
      const result = await letterEntries(activeSociety.id, {
        lineIds: selected,
        allowImbalance: hasImbalance && allowImbalance,
        imbalanceReason: hasImbalance && allowImbalance ? trimmedReason : undefined,
      });
      if (result.success) {
        toast.success(
          hasImbalance
            ? `Lettrage ${result.data?.letteringCode ?? ""} créé avec écart justifié`
            : `Lettrage ${result.data?.letteringCode ?? ""} créé`
        );
        setAllowImbalance(false);
        setImbalanceReason("");
        load(accountId);
      } else {
        toast.error(result.error ?? "Erreur lors du lettrage");
      }
    });
  }

  function handleLetterSuggestion(suggestion: LetteringSuggestion) {
    if (!activeSociety?.id) return;
    startTransition(async () => {
      const result = await letterEntries(activeSociety.id, { lineIds: suggestion.lineIds });
      if (result.success) {
        toast.success(`Lettrage ${result.data?.letteringCode ?? ""} créé`);
        load(accountId);
      } else {
        toast.error(result.error ?? "Erreur lors du lettrage");
      }
    });
  }

  function handleUnletter(letteringCode: string) {
    if (!activeSociety?.id) return;
    startTransition(async () => {
      const result = await unletterEntries(activeSociety.id, letteringCode);
      if (result.success) {
        toast.success(`Lettrage ${letteringCode} supprimé`);
        load(accountId);
      } else {
        toast.error(result.error ?? "Erreur lors du délettrage");
      }
    });
  }

  const selectedLines = lines.filter((line) => selected.includes(line.id));
  const totalDebit = selectedLines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = selectedLines.reduce((sum, line) => sum + line.credit, 0);
  const difference = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100;
  const signedDifference = Math.round((totalDebit - totalCredit) * 100) / 100;
  const trimmedReason = imbalanceReason.trim();
  const isBalanced = difference <= 0.01;
  const canLetter =
    selected.length >= 2 &&
    (isBalanced || (allowImbalance && trimmedReason.length > 0));
  const willLetterWithImbalance = selected.length >= 2 && !isBalanced && allowImbalance && trimmedReason.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Lettrage</h1>
            <p className="text-sm text-muted-foreground">
              Rapprochement des lignes non lettrées par compte de tiers
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => load()} disabled={isPending || !accountId}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualiser
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Compte à lettrer</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            className={selectClassName()}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.label}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Sélection</p><p className="text-2xl font-bold">{selected.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Débit</p><p className="text-2xl font-bold">{formatCurrency(totalDebit)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Crédit</p><p className="text-2xl font-bold">{formatCurrency(totalCredit)}</p></CardContent></Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Écart</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-2xl font-bold">{formatCurrency(difference)}</p>
              <Badge variant={isBalanced ? "default" : "secondary"}>
                {isBalanced ? "Équilibré" : "À équilibrer"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {selected.length >= 2 && !isBalanced && (
        <Card className="border-amber-300/70 bg-amber-50/60 dark:border-amber-800/60 dark:bg-amber-950/30">
          <CardContent className="space-y-3 pt-6">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowImbalance}
                onChange={(event) => setAllowImbalance(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-amber-600"
              />
              <span>
                <span className="font-medium">Accepter un écart de {formatCurrency(difference)}</span>
                <br />
                <span className="text-xs text-muted-foreground">
                  Une OD sera créée sur le compte {signedDifference > 0 ? "658000 (perte)" : "758000 (produit)"}{" "}
                  pour solder le groupe. Rôle réservé aux arrondis, écarts de change ou escomptes.
                </span>
              </span>
            </label>
            {allowImbalance && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground" htmlFor="imbalance-reason">
                  Motif de l&apos;écart (obligatoire, 200 car. max.)
                </label>
                <Textarea
                  id="imbalance-reason"
                  value={imbalanceReason}
                  onChange={(event) => setImbalanceReason(event.target.value.slice(0, 200))}
                  placeholder="Ex: Écart de change EUR/USD, escompte accordé, arrondi facture…"
                  className="min-h-16 text-sm"
                />
                <div className="text-right text-xs text-muted-foreground">
                  {trimmedReason.length}/200
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Suggestions de lettrage</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proposition</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="w-44">Période</TableHead>
                    <TableHead className="w-44 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions.map((suggestion) => (
                    <TableRow key={suggestion.lineIds.join("-")}>
                      <TableCell>
                        <div className="font-medium">{suggestion.reason}</div>
                        <div className="text-xs text-muted-foreground">
                          {suggestion.lines.map((line) => line.piece ?? line.entryLabel).join(" / ")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(suggestion.totalDebit)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(suggestion.lines[0].entryDate)} - {formatDate(suggestion.lines[suggestion.lines.length - 1].entryDate)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelected(suggestion.lineIds)}
                            disabled={isPending}
                          >
                            Sélectionner
                          </Button>
                          <Button size="sm" onClick={() => handleLetterSuggestion(suggestion)} disabled={isPending}>
                            <Link2 className="h-4 w-4" />
                            Lettrer
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Lignes non lettrées</CardTitle>
          <Button
            onClick={handleLetter}
            disabled={isPending || !canLetter}
            variant={willLetterWithImbalance ? "destructive" : "default"}
            title={willLetterWithImbalance ? "Lettrer en acceptant l'écart documenté" : undefined}
          >
            <Link2 className="h-4 w-4" />
            {willLetterWithImbalance ? "Lettrer avec écart" : "Lettrer"}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={lines.length > 0 && selected.length === lines.length}
                      onCheckedChange={toggleAll}
                      aria-label="Tout sélectionner"
                    />
                  </TableHead>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead className="w-28">Pièce</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Débit</TableHead>
                  <TableHead className="text-right">Crédit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Aucune ligne non lettrée pour ce compte
                    </TableCell>
                  </TableRow>
                )}
                {lines.map((line) => (
                  <TableRow key={line.id} data-state={selected.includes(line.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(line.id)}
                        onCheckedChange={() => toggleLine(line.id)}
                        aria-label="Sélectionner la ligne"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{formatDate(line.entryDate)}</TableCell>
                    <TableCell className="font-mono text-xs">{line.piece ?? "-"}</TableCell>
                    <TableCell>
                      <div className="text-sm">{line.label ?? line.entryLabel}</div>
                      {line.label && line.label !== line.entryLabel && (
                        <div className="text-xs text-muted-foreground">{line.entryLabel}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">{line.debit > 0 ? formatCurrency(line.debit) : ""}</TableCell>
                    <TableCell className="text-right font-mono">{line.credit > 0 ? formatCurrency(line.credit) : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Groupes lettrés</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Code</TableHead>
                  <TableHead className="w-24">Lignes</TableHead>
                  <TableHead>Pièces</TableHead>
                  <TableHead className="text-right">Débit</TableHead>
                  <TableHead className="text-right">Crédit</TableHead>
                  <TableHead className="w-44">Période</TableHead>
                  <TableHead className="w-28 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {letteredGroups.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Aucun groupe lettré pour ce compte
                    </TableCell>
                  </TableRow>
                )}
                {letteredGroups.map((group) => (
                  <TableRow key={group.letteringCode}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{group.letteringCode}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{group.lineCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {group.pieces.length > 0 ? group.pieces.join(", ") : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(group.totalDebit)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(group.totalCredit)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(group.firstEntryDate)} - {formatDate(group.lastEntryDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleUnletter(group.letteringCode)} disabled={isPending}>
                        <Unlink2 className="h-4 w-4" />
                        Délettrer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
