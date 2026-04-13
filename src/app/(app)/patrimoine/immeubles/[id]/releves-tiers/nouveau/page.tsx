"use client";

import { useState, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createStatement } from "@/actions/third-party-statement";
import { useSociety } from "@/providers/society-provider";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { CreateStatementInput } from "@/validations/third-party-statement";

interface StatementLine {
  id: string;
  label: string;
  amount: number;
  lineType: string;
  nature: string;
}

function generateLineId(): string {
  return `line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const NATURE_OPTIONS = [
  { value: "RECUPERABLE", label: "Recuperable" },
  { value: "PROPRIETAIRE", label: "Non recuperable" },
  { value: "MIXTE", label: "Mixte" },
];

export default function NouveauReleveTiersPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { activeSociety } = useSociety();

  const defaultType = searchParams.get("type") === "DECOMPTE_CHARGES"
    ? "DECOMPTE_CHARGES"
    : "APPEL_FONDS";

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Champs du formulaire
  const [type, setType] = useState<"APPEL_FONDS" | "DECOMPTE_CHARGES">(defaultType);
  const [thirdPartyName, setThirdPartyName] = useState("");
  const [reference, setReference] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  // Lignes dynamiques
  const [lines, setLines] = useState<StatementLine[]>([
    { id: generateLineId(), label: "", amount: 0, lineType: "CHARGE", nature: "RECUPERABLE" },
  ]);

  const totalAmount = lines.reduce((sum, l) => sum + (l.amount || 0), 0);

  const addLine = useCallback(() => {
    setLines((prev) => [
      ...prev,
      { id: generateLineId(), label: "", amount: 0, lineType: "CHARGE", nature: "RECUPERABLE" },
    ]);
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setLines((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((l) => l.id !== lineId);
    });
  }, []);

  const updateLine = useCallback(
    (lineId: string, field: keyof StatementLine, value: string | number) => {
      setLines((prev) =>
        prev.map((l) => (l.id === lineId ? { ...l, [field]: value } : l))
      );
    },
    []
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) {
      setError("Aucune societe selectionnee");
      return;
    }
    setError("");

    // Validation basique cote client
    if (!thirdPartyName.trim()) {
      setError("Le nom du syndic est requis");
      return;
    }
    if (!periodStart || !periodEnd) {
      setError("Les dates de periode sont requises");
      return;
    }
    if (!receivedDate) {
      setError("La date de reception est requise");
      return;
    }
    if (lines.some((l) => !l.label.trim())) {
      setError("Chaque ligne doit avoir un libelle");
      return;
    }

    const input: CreateStatementInput = {
      type,
      buildingId: params.id,
      thirdPartyName: thirdPartyName.trim(),
      reference: reference.trim() || undefined,
      periodStart,
      periodEnd,
      periodLabel: periodLabel.trim() || undefined,
      receivedDate,
      dueDate: dueDate || undefined,
      totalAmount,
      notes: notes.trim() || undefined,
      lines: lines.map((l) => ({
        lineType: l.lineType as "CHARGE" | "ENCAISSEMENT" | "DEDUCTION" | "HONORAIRES",
        label: l.label.trim(),
        amount: l.amount,
        nature: l.nature as "PROPRIETAIRE" | "RECUPERABLE" | "MIXTE" | undefined,
      })),
    };

    setIsLoading(true);
    const result = await createStatement(activeSociety.id, input);
    setIsLoading(false);

    if (result.success) {
      toast.success("Releve cree avec succes");
      router.push(`/patrimoine/immeubles/${params.id}/releves-tiers`);
    } else {
      setError(result.error ?? "Erreur lors de la creation");
      toast.error(result.error ?? "Erreur lors de la creation");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/patrimoine/immeubles/${params.id}/releves-tiers`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {type === "APPEL_FONDS"
              ? "Nouvel appel de fonds"
              : "Nouveau decompte annuel"}
          </h1>
          <p className="text-muted-foreground">
            Enregistrer un releve du syndic de copropriete
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type et identification */}
        <Card>
          <CardHeader>
            <CardTitle>Informations generales</CardTitle>
            <CardDescription>Type de releve et identification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Type de releve *</Label>
              <NativeSelect
                value={type}
                onChange={(e) =>
                  setType(
                    e.target.value as "APPEL_FONDS" | "DECOMPTE_CHARGES"
                  )
                }
                options={[
                  { value: "APPEL_FONDS", label: "Appel de fonds" },
                  { value: "DECOMPTE_CHARGES", label: "Decompte annuel de charges" },
                ]}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="thirdPartyName">Nom du syndic *</Label>
                <Input
                  id="thirdPartyName"
                  value={thirdPartyName}
                  onChange={(e) => setThirdPartyName(e.target.value)}
                  placeholder="Ex: Cabinet Martin Gestion"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Reference</Label>
                <Input
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ex: AF-2026-T1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Periode et dates */}
        <Card>
          <CardHeader>
            <CardTitle>Periode et dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="periodStart">Debut de periode *</Label>
                <Input
                  id="periodStart"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodEnd">Fin de periode *</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodLabel">Libelle periode</Label>
                <Input
                  id="periodLabel"
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                  placeholder="Ex: T1 2026, Exercice 2025"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="receivedDate">Date de reception *</Label>
                <Input
                  id="receivedDate"
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  required
                />
              </div>
              {type === "APPEL_FONDS" && (
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Date d&apos;echeance</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lignes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lignes de detail</CardTitle>
                <CardDescription>
                  Detaillez chaque poste de charges du releve
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-base font-semibold tabular-nums">
                Total : {formatCurrency(totalAmount)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Libelle</TableHead>
                  <TableHead className="w-[20%] text-right">Montant</TableHead>
                  <TableHead className="w-[25%]">Nature</TableHead>
                  <TableHead className="w-[15%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <Input
                        value={line.label}
                        onChange={(e) =>
                          updateLine(line.id, "label", e.target.value)
                        }
                        placeholder="Ex: Chauffage collectif"
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.amount || ""}
                        onChange={(e) =>
                          updateLine(
                            line.id,
                            "amount",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        placeholder="0,00"
                        className="h-9 text-right tabular-nums"
                      />
                    </TableCell>
                    <TableCell>
                      <NativeSelect
                        value={line.nature}
                        onChange={(e) =>
                          updateLine(line.id, "nature", e.target.value)
                        }
                        options={NATURE_OPTIONS}
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLine}
              className="w-full"
            >
              <Plus className="h-4 w-4" />
              Ajouter une ligne
            </Button>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Observations ou commentaires..."
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href={`/patrimoine/immeubles/${params.id}/releves-tiers`}>
            <Button variant="outline" type="button">
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer le releve"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
