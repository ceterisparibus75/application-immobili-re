"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, FileUp, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { createLoan, createLoanFromPdf } from "@/actions/loan";
import { useSociety } from "@/providers/society-provider";
import type { ParsedLoan } from "@/app/api/emprunts/parse-pdf/route";

type Building = { id: string; name: string; city: string };

const LOAN_TYPES = [
  { value: "AMORTISSABLE", label: "Amortissable (annuité constante)" },
  { value: "IN_FINE", label: "In fine (intérêts + capital en fin)" },
  { value: "BULLET", label: "Bullet (tout à l'échéance)" },
];

function calcMonthlyPayment(amount: number, annualRate: number, months: number): number {
  const r = annualRate / 100 / 12;
  if (r === 0) return amount / months;
  return (amount * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

// ============================================================
// Onglet Manuel
// ============================================================

function ManualForm({
  buildings,
  activeSocietyId,
}: {
  buildings: Building[];
  activeSocietyId: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [insuranceRate, setInsuranceRate] = useState("0");
  const [durationMonths, setDurationMonths] = useState("");
  const [loanType, setLoanType] = useState("AMORTISSABLE");

  const amountN = parseFloat(amount) || 0;
  const rateN = parseFloat(interestRate) || 0;
  const insN = parseFloat(insuranceRate) || 0;
  const monthsN = parseInt(durationMonths) || 0;
  const monthly =
    amountN > 0 && rateN >= 0 && monthsN > 0
      ? calcMonthlyPayment(amountN, rateN, monthsN)
      : 0;
  const monthlyInsurance = amountN > 0 ? (amountN * insN) / 100 / 12 : 0;
  const totalMonthly = monthly + monthlyInsurance;
  const totalCost = totalMonthly * monthsN;
  const totalInterest = totalCost - amountN;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      label: formData.get("label") as string,
      lender: formData.get("lender") as string,
      loanType: formData.get("loanType") as string,
      amount: parseFloat(formData.get("amount") as string),
      interestRate: parseFloat(formData.get("interestRate") as string),
      insuranceRate: parseFloat(formData.get("insuranceRate") as string) || 0,
      durationMonths: parseInt(formData.get("durationMonths") as string),
      startDate: formData.get("startDate") as string,
      buildingId: formData.get("buildingId") as string,
      purchaseValue: formData.get("purchaseValue")
        ? parseFloat(formData.get("purchaseValue") as string)
        : null,
      notes: (formData.get("notes") as string) || null,
    };

    const result = await createLoan(activeSocietyId, data);
    if ("error" in result) {
      setError(result.error ?? "Erreur lors de la création");
    } else if ("data" in result && result.data) {
      router.push(`/emprunts/${result.data.id}`);
    }
    setIsLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Informations du prêt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">Libellé *</Label>
            <Input
              id="label"
              name="label"
              placeholder="ex: Prêt BNP — Immeuble Centre"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lender">Établissement prêteur *</Label>
              <Input
                id="lender"
                name="lender"
                placeholder="BNP Paribas, Crédit Agricole…"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loanType">Type de prêt</Label>
              <select
                id="loanType"
                name="loanType"
                value={loanType}
                onChange={(e) => setLoanType(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {LOAN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="buildingId">Bien immobilier lié *</Label>
            <select
              id="buildingId"
              name="buildingId"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">— Sélectionner un immeuble —</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {b.city}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Paramètres financiers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Capital emprunté (€) *</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="1"
                placeholder="250000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseValue">Valeur d&apos;acquisition (€)</Label>
              <Input
                id="purchaseValue"
                name="purchaseValue"
                type="number"
                step="0.01"
                min="0"
                placeholder="300000"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="interestRate">Taux nominal annuel (%) *</Label>
              <Input
                id="interestRate"
                name="interestRate"
                type="number"
                step="0.001"
                min="0"
                max="100"
                placeholder="3.5"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insuranceRate">Taux assurance annuel (%)</Label>
              <Input
                id="insuranceRate"
                name="insuranceRate"
                type="number"
                step="0.001"
                min="0"
                max="10"
                placeholder="0.36"
                value={insuranceRate}
                onChange={(e) => setInsuranceRate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationMonths">Durée (mois) *</Label>
              <Input
                id="durationMonths"
                name="durationMonths"
                type="number"
                step="1"
                min="1"
                placeholder="240"
                value={durationMonths}
                onChange={(e) => setDurationMonths(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Date de début *</Label>
            <Input id="startDate" name="startDate" type="date" required />
          </div>

          {loanType === "AMORTISSABLE" && totalMonthly > 0 && (
            <div className="rounded-md bg-muted p-4 space-y-2">
              <p className="text-sm font-semibold">Simulation</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-muted-foreground">
                  Mensualité (hors assurance)
                </span>
                <span className="font-medium">{fmt(monthly)}</span>
                {monthlyInsurance > 0 && (
                  <>
                    <span className="text-muted-foreground">
                      Assurance mensuelle
                    </span>
                    <span className="font-medium">{fmt(monthlyInsurance)}</span>
                  </>
                )}
                <span className="text-muted-foreground">Mensualité totale</span>
                <span className="font-semibold text-primary">
                  {fmt(totalMonthly)}
                </span>
                <span className="text-muted-foreground">
                  Coût total du crédit
                </span>
                <span className="font-medium">{fmt(totalCost)}</span>
                <span className="text-muted-foreground">Dont intérêts</span>
                <span className="font-medium text-destructive">
                  {fmt(Math.max(0, totalInterest))}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Garanties, conditions particulières…"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Link href="/emprunts">
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
            "Créer l'emprunt"
          )}
        </Button>
      </div>
    </form>
  );
}

// ============================================================
// Onglet Import PDF
// ============================================================

function PdfImportForm({
  buildings,
  activeSocietyId,
}: {
  buildings: Building[];
  activeSocietyId: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "saving">("upload");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState<ParsedLoan | null>(null);

  // Champs éditables après extraction
  const [label, setLabel] = useState("");
  const [lender, setLender] = useState("");
  const [loanType, setLoanType] = useState("AMORTISSABLE");
  const [amount, setAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [insuranceRate, setInsuranceRate] = useState("0");
  const [durationMonths, setDurationMonths] = useState("");
  const [startDate, setStartDate] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [purchaseValue, setPurchaseValue] = useState("");
  const [notes, setNotes] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setIsAnalyzing(true);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/emprunts/parse-pdf", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? "Erreur lors de l'analyse du PDF");
        setIsAnalyzing(false);
        return;
      }
      const data: ParsedLoan = json.data;
      setParsed(data);
      // Pré-remplir les champs
      setLabel(data.label ?? "");
      setLender(data.lender ?? "");
      setLoanType(data.loanType ?? "AMORTISSABLE");
      setAmount(String(data.amount ?? ""));
      setInterestRate(String(data.interestRate ?? ""));
      setInsuranceRate(String(data.insuranceRate ?? "0"));
      setDurationMonths(String(data.durationMonths ?? ""));
      setStartDate(data.startDate ?? "");
      setStep("preview");
    } catch {
      setError("Impossible de contacter le serveur d'analyse");
    }
    setIsAnalyzing(false);
  }

  async function handleConfirm() {
    if (!parsed) return;
    if (!buildingId) {
      setError("Veuillez sélectionner un immeuble");
      return;
    }
    setError("");
    setStep("saving");

    const data = {
      label,
      lender,
      loanType,
      amount: parseFloat(amount),
      interestRate: parseFloat(interestRate),
      insuranceRate: parseFloat(insuranceRate) || 0,
      durationMonths: parseInt(durationMonths),
      startDate,
      buildingId,
      purchaseValue: purchaseValue ? parseFloat(purchaseValue) : null,
      notes: notes || null,
      schedule: parsed.schedule,
    };

    const result = await createLoanFromPdf(activeSocietyId, data);
    if ("error" in result) {
      setError(result.error ?? "Erreur lors de la création");
      setStep("preview");
    } else if ("data" in result && result.data) {
      router.push(`/emprunts/${result.data.id}`);
    }
  }

  if (step === "upload" || isAnalyzing) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <Card>
          <CardContent className="pt-6">
            <div
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {isAnalyzing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
                  <p className="text-sm font-medium">
                    Analyse du tableau d&apos;amortissement en cours…
                  </p>
                  <p className="text-xs text-muted-foreground">
                    L&apos;intelligence artificielle extrait les données du PDF
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <FileUp className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Cliquer pour sélectionner le PDF du tableau d&apos;amortissement
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Fichier PDF uniquement — max 20 Mo
                  </p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
              disabled={isAnalyzing}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Étape preview : données extraites + formulaire de correction
  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-sm text-green-800 dark:text-green-300 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {parsed?.schedule.length ?? 0} lignes extraites depuis le PDF. Vérifiez et corrigez si nécessaire.
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Données extraites — à vérifier</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Libellé *</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Établissement prêteur *</Label>
              <Input
                value={lender}
                onChange={(e) => setLender(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Type de prêt</Label>
              <select
                value={loanType}
                onChange={(e) => setLoanType(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {LOAN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Capital emprunté (€) *</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Valeur d&apos;acquisition (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={purchaseValue}
                onChange={(e) => setPurchaseValue(e.target.value)}
                placeholder="Optionnel"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Taux nominal annuel (%)</Label>
              <Input
                type="number"
                step="0.001"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Taux assurance (%)</Label>
              <Input
                type="number"
                step="0.001"
                value={insuranceRate}
                onChange={(e) => setInsuranceRate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Durée (mois)</Label>
              <Input
                type="number"
                value={durationMonths}
                onChange={(e) => setDurationMonths(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Date de début</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Bien immobilier lié *</Label>
            <select
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">— Sélectionner un immeuble —</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {b.city}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Aperçu des premières lignes du tableau */}
      {parsed && parsed.schedule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Tableau d&apos;amortissement ({parsed.schedule.length} lignes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">N°</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead className="text-right">Capital</TableHead>
                    <TableHead className="text-right">Intérêts</TableHead>
                    <TableHead className="text-right">Assurance</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Solde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.schedule.slice(0, 6).map((line) => (
                    <TableRow key={line.period}>
                      <TableCell>{line.period}</TableCell>
                      <TableCell>
                        {new Date(line.dueDate).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.principal.toLocaleString("fr-FR", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.interest.toLocaleString("fr-FR", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.insurance.toLocaleString("fr-FR", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {line.total.toLocaleString("fr-FR", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.balance.toLocaleString("fr-FR", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                  {parsed.schedule.length > 6 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-xs text-muted-foreground"
                      >
                        … {parsed.schedule.length - 6} lignes supplémentaires
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => {
            setStep("upload");
            setParsed(null);
            setError("");
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        >
          ← Recommencer
        </Button>
        <div className="flex gap-3">
          <Link href="/emprunts">
            <Button variant="ghost" type="button">
              Annuler
            </Button>
          </Link>
          <Button onClick={handleConfirm} disabled={step === "saving"}>
            {step === "saving" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer l'emprunt"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Page principale
// ============================================================

export default function NouvelEmpruntPage() {
  const { activeSociety } = useSociety();
  const [buildings, setBuildings] = useState<Building[]>([]);

  useEffect(() => {
    fetch("/api/buildings")
      .then((r) => r.json())
      .then((d) => setBuildings(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/emprunts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouvel emprunt</h1>
          <p className="text-muted-foreground">Enregistrer un prêt immobilier</p>
        </div>
      </div>

      {!activeSociety ? (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Aucune société active sélectionnée.
        </div>
      ) : (
        <Tabs defaultValue="manuel">
          <TabsList className="mb-4">
            <TabsTrigger value="manuel">Saisie manuelle</TabsTrigger>
            <TabsTrigger value="pdf">Import PDF</TabsTrigger>
          </TabsList>

          <TabsContent value="manuel">
            <ManualForm
              buildings={buildings}
              activeSocietyId={activeSociety.id}
            />
          </TabsContent>

          <TabsContent value="pdf">
            <PdfImportForm
              buildings={buildings}
              activeSocietyId={activeSociety.id}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
