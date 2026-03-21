"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";

const JOURNAL_OPTIONS = [
  { value: "VENTES", label: "Ventes" },
  { value: "BANQUE", label: "Banque" },
  { value: "OPERATIONS_DIVERSES", label: "Opérations diverses" },
];

type Account = { id: string; code: string; label: string };

type Line = {
  accountId: string;
  label: string;
  debit: string;
  credit: string;
};

export default function NouvelleEcriturePage() {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lines, setLines] = useState<Line[]>([
    { accountId: "", label: "", debit: "", credit: "" },
    { accountId: "", label: "", debit: "", credit: "" },
  ]);

  useEffect(() => {
    fetch("/api/comptabilite/accounts")
      .then((r) => r.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  function addLine() {
    setLines([...lines, { accountId: "", label: "", debit: "", credit: "" }]);
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof Line, value: string) {
    setLines(lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  const totalDebit = lines.reduce(
    (s, l) => s + (parseFloat(l.debit) || 0),
    0
  );
  const totalCredit = lines.reduce(
    (s, l) => s + (parseFloat(l.credit) || 0),
    0
  );
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) return;
    if (!isBalanced) {
      setError("L'écriture n'est pas équilibrée (débit ≠ crédit)");
      return;
    }

    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const body = {
      journalType: formData.get("journalType"),
      entryDate: formData.get("entryDate"),
      label: formData.get("label"),
      piece: formData.get("piece") || null,
      reference: formData.get("reference") || null,
      lines: lines
        .filter((l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
        .map((l) => ({
          accountId: l.accountId,
          label: l.label || null,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
        })),
    };

    const res = await fetch("/api/comptabilite/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      router.push("/comptabilite");
    } else {
      const data = await res.json();
      setError(data.error ?? "Erreur lors de la création");
    }
    setIsLoading(false);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/comptabilite">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouvelle écriture</h1>
          <p className="text-muted-foreground">Écriture comptable manuelle</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>En-tête</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="journalType">Journal *</Label>
                <Select
                  id="journalType"
                  name="journalType"
                  options={JOURNAL_OPTIONS}
                  defaultValue="OPERATIONS_DIVERSES"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entryDate">Date *</Label>
                <Input
                  id="entryDate"
                  name="entryDate"
                  type="date"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Libellé *</Label>
              <Input
                id="label"
                name="label"
                placeholder="Description de l'opération"
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="piece">N° de pièce</Label>
                <Input id="piece" name="piece" placeholder="FAC-2025-001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Référence</Label>
                <Input id="reference" name="reference" placeholder="Bail, contrat..." />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lignes d&apos;écriture</CardTitle>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  Débit : <span className="font-medium">{totalDebit.toFixed(2)} €</span>
                </span>
                <span className="text-muted-foreground">
                  Crédit : <span className="font-medium">{totalCredit.toFixed(2)} €</span>
                </span>
                {totalDebit > 0 && (
                  <span className={isBalanced ? "text-green-600 font-medium" : "text-destructive font-medium"}>
                    {isBalanced ? "Équilibrée" : "Non équilibrée"}
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Aucun compte — <Link href="/comptabilite/plan-comptable" className="underline">créez des comptes</Link> d&apos;abord.
              </p>
            )}
            {lines.map((line, i) => (
              <div key={i} className="grid gap-2 grid-cols-12 items-center">
                <div className="col-span-4">
                  <select
                    value={line.accountId}
                    onChange={(e) => updateLine(i, "accountId", e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Compte...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <Input
                    value={line.label}
                    onChange={(e) => updateLine(i, "label", e.target.value)}
                    placeholder="Libellé ligne"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.debit}
                    onChange={(e) => updateLine(i, "debit", e.target.value)}
                    placeholder="Débit"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.credit}
                    onChange={(e) => updateLine(i, "credit", e.target.value)}
                    placeholder="Crédit"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="col-span-1 flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeLine(i)}
                    disabled={lines.length <= 2}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4" />
              Ajouter une ligne
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/comptabilite">
            <Button variant="outline" type="button">
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading || !isBalanced}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer l'écriture"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
