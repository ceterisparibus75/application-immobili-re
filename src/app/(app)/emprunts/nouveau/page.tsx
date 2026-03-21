"use client";

import { useState, useEffect } from "react";
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
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { createLoan } from "@/actions/loan";
import { useSociety } from "@/providers/society-provider";

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

export default function NouvelEmpruntPage() {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [buildings, setBuildings] = useState<Building[]>([]);

  // Form state
  const [amount, setAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [insuranceRate, setInsuranceRate] = useState("0");
  const [durationMonths, setDurationMonths] = useState("");
  const [loanType, setLoanType] = useState("AMORTISSABLE");

  useEffect(() => {
    fetch("/api/buildings")
      .then((r) => r.json())
      .then((d) => setBuildings(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Simulation en temps réel
  const amountN = parseFloat(amount) || 0;
  const rateN = parseFloat(interestRate) || 0;
  const insN = parseFloat(insuranceRate) || 0;
  const monthsN = parseInt(durationMonths) || 0;
  const monthly = amountN > 0 && rateN >= 0 && monthsN > 0
    ? calcMonthlyPayment(amountN, rateN, monthsN)
    : 0;
  const monthlyInsurance = amountN > 0 ? (amountN * insN / 100 / 12) : 0;
  const totalMonthly = monthly + monthlyInsurance;
  const totalCost = totalMonthly * monthsN;
  const totalInterest = totalCost - amountN;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) return;
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
      buildingId: (formData.get("buildingId") as string) || null,
      purchaseValue: formData.get("purchaseValue")
        ? parseFloat(formData.get("purchaseValue") as string)
        : null,
      notes: formData.get("notes") || null,
    };

    const result = await createLoan(activeSociety.id, data);
    if ("error" in result) {
      setError(result.error ?? "Erreur lors de la création");
    } else if ("data" in result && result.data) {
      router.push(`/emprunts/${result.data.id}`);
    }
    setIsLoading(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
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

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identité */}
        <Card>
          <CardHeader><CardTitle>Informations du prêt</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="label">Libellé *</Label>
              <Input id="label" name="label" placeholder="ex: Prêt BNP — Immeuble Centre" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lender">Établissement prêteur *</Label>
                <Input id="lender" name="lender" placeholder="BNP Paribas, Crédit Agricole…" required />
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
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="buildingId">Bien immobilier lié (optionnel)</Label>
              <select
                id="buildingId"
                name="buildingId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">— Aucun bien lié —</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} — {b.city}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Paramètres financiers */}
        <Card>
          <CardHeader><CardTitle>Paramètres financiers</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Capital emprunté (€) *</Label>
                <Input
                  id="amount" name="amount" type="number" step="0.01" min="1"
                  placeholder="250000"
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchaseValue">Valeur d&apos;acquisition (€)</Label>
                <Input id="purchaseValue" name="purchaseValue" type="number" step="0.01" min="0" placeholder="300000" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="interestRate">Taux nominal annuel (%) *</Label>
                <Input
                  id="interestRate" name="interestRate" type="number" step="0.001" min="0" max="100"
                  placeholder="3.5"
                  value={interestRate} onChange={(e) => setInterestRate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="insuranceRate">Taux assurance annuel (%)</Label>
                <Input
                  id="insuranceRate" name="insuranceRate" type="number" step="0.001" min="0" max="10"
                  placeholder="0.36"
                  value={insuranceRate} onChange={(e) => setInsuranceRate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="durationMonths">Durée (mois) *</Label>
                <Input
                  id="durationMonths" name="durationMonths" type="number" step="1" min="1"
                  placeholder="240"
                  value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Date de début *</Label>
              <Input id="startDate" name="startDate" type="date" required />
            </div>

            {/* Simulation */}
            {loanType === "AMORTISSABLE" && totalMonthly > 0 && (
              <div className="rounded-md bg-muted p-4 space-y-2">
                <p className="text-sm font-semibold">Simulation</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Mensualité (hors assurance)</span>
                  <span className="font-medium">{monthly.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span>
                  {monthlyInsurance > 0 && <>
                    <span className="text-muted-foreground">Assurance mensuelle</span>
                    <span className="font-medium">{monthlyInsurance.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span>
                  </>}
                  <span className="text-muted-foreground">Mensualité totale</span>
                  <span className="font-semibold text-primary">{totalMonthly.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span>
                  <span className="text-muted-foreground">Coût total du crédit</span>
                  <span className="font-medium">{totalCost.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span>
                  <span className="text-muted-foreground">Dont intérêts</span>
                  <span className="font-medium text-destructive">{Math.max(0, totalInterest).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes" name="notes" rows={3}
                placeholder="Garanties, conditions particulières…"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/emprunts">
            <Button variant="outline" type="button">Annuler</Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement...</>
            ) : (
              "Créer l'emprunt"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
