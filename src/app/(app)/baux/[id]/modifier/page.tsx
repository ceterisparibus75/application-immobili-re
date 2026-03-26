"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { updateLease } from "@/actions/lease";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";

const STATUS_OPTIONS = [
  { value: "EN_COURS", label: "En cours" },
  { value: "EN_NEGOCIATION", label: "En négociation" },
  { value: "RENOUVELE", label: "Renouvelé" },
  { value: "CONTENTIEUX", label: "Contentieux" },
  { value: "RESILIE", label: "Résilié" },
];

const INDEX_TYPES = [
  { value: "ILC", label: "ILC — Indice des Loyers Commerciaux" },
  { value: "ILAT", label: "ILAT — Indice des Loyers des Activités Tertiaires" },
  { value: "ICC", label: "ICC — Indice du Coût de la Construction" },
];

const BILLING_TERMS = [
  { value: "A_ECHOIR", label: "Terme à échoir (paiement en début de période)" },
  { value: "ECHU", label: "Terme échu (paiement en fin de période)" },
];

const PAYMENT_FREQUENCIES = [
  { value: "MENSUEL", label: "Mensuel" },
  { value: "TRIMESTRIEL", label: "Trimestriel" },
  { value: "SEMESTRIEL", label: "Semestriel" },
  { value: "ANNUEL", label: "Annuel" },
];

type LeaseData = {
  id: string;
  status: string;
  currentRentHT: number;
  depositAmount: number;
  vatApplicable: boolean;
  vatRate: number;
  billingTerm: string;
  paymentFrequency: string;
  indexType?: string | null;
  baseIndexValue?: number | null;
  baseIndexQuarter?: string | null;
  revisionFrequency: number;
  tenantWorksClauses?: string | null;
  entryDate?: string | null;
  exitDate?: string | null;
  rentFreeMonths?: number | null;
};

export default function ModifierBailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { activeSociety } = useSociety();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState("");
  const [lease, setLease] = useState<LeaseData | null>(null);
  const [vatApplicable, setVatApplicable] = useState(true);

  useEffect(() => {
    async function fetchLease() {
      try {
        const res = await fetch(`/api/leases/${params.id}`);
        if (res.ok) {
          const json = await res.json() as { data: LeaseData };
          setLease(json.data);
          setVatApplicable(json.data.vatApplicable);
        }
      } finally {
        setIsFetching(false);
      }
    }
    void fetchLease();
  }, [params.id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety || !lease) return;

    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const result = await updateLease(activeSociety.id, {
      id: params.id,
      status: data.status as "EN_COURS" | "RESILIE" | "RENOUVELE" | "EN_NEGOCIATION" | "CONTENTIEUX",
      currentRentHT: parseFloat(data.currentRentHT),
      depositAmount: parseFloat(data.depositAmount) || 0,
      vatApplicable: data.vatApplicable === "on",
      vatRate: parseFloat(data.vatRate) || 20,
      indexType: (data.indexType as "ILC" | "ILAT" | "ICC") || null,
      baseIndexValue: data.baseIndexValue ? parseFloat(data.baseIndexValue) : null,
      baseIndexQuarter: data.baseIndexQuarter || null,
      revisionFrequency: parseInt(data.revisionFrequency) || 12,
      billingTerm: (data.billingTerm as "ECHU" | "A_ECHOIR") || undefined,
      paymentFrequency: (data.paymentFrequency as "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL") || undefined,
      tenantWorksClauses: data.tenantWorksClauses || null,
      entryDate: data.entryDate || null,
      exitDate: data.exitDate || null,
      rentFreeMonths: data.rentFreeMonths !== undefined ? parseFloat(data.rentFreeMonths) || 0 : undefined,
    });

    setIsLoading(false);

    if (result.success) {
      router.push(`/baux/${params.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lease) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Bail introuvable
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href={`/baux/${params.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Modifier le bail</h1>
          <p className="text-muted-foreground">Mise à jour des conditions</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Statut */}
        <Card>
          <CardHeader>
            <CardTitle>Statut du bail</CardTitle>
            <CardDescription>
              La résiliation libère automatiquement le lot.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="status">Statut *</Label>
                <NativeSelect
                  id="status"
                  name="status"
                  options={STATUS_OPTIONS}
                  defaultValue={lease.status}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="entryDate">Date d&apos;entrée effective</Label>
                <Input
                  id="entryDate"
                  name="entryDate"
                  type="date"
                  defaultValue={
                    lease.entryDate
                      ? new Date(lease.entryDate).toISOString().slice(0, 10)
                      : ""
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exitDate">Date de sortie</Label>
                <Input
                  id="exitDate"
                  name="exitDate"
                  type="date"
                  defaultValue={
                    lease.exitDate
                      ? new Date(lease.exitDate).toISOString().slice(0, 10)
                      : ""
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loyer */}
        <Card>
          <CardHeader>
            <CardTitle>Loyer et dépôt de garantie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currentRentHT">Loyer actuel HT (€/mois) *</Label>
                <Input
                  id="currentRentHT"
                  name="currentRentHT"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={lease.currentRentHT}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="depositAmount">Dépôt de garantie (€)</Label>
                <Input
                  id="depositAmount"
                  name="depositAmount"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={lease.depositAmount}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rentFreeMonths">Franchise de loyer (mois)</Label>
                <Input
                  id="rentFreeMonths"
                  name="rentFreeMonths"
                  type="number"
                  min={0}
                  step={0.5}
                  defaultValue={lease.rentFreeMonths ?? 0}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="paymentFrequency">Fréquence de paiement *</Label>
                <NativeSelect
                  id="paymentFrequency"
                  name="paymentFrequency"
                  options={PAYMENT_FREQUENCIES}
                  defaultValue={lease.paymentFrequency}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingTerm">Terme des loyers *</Label>
                <NativeSelect
                  id="billingTerm"
                  name="billingTerm"
                  options={BILLING_TERMS}
                  defaultValue={lease.billingTerm}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="vatApplicable"
                name="vatApplicable"
                defaultChecked={lease.vatApplicable}
                className="h-4 w-4 rounded border-input"
                onChange={(e) => setVatApplicable(e.target.checked)}
              />
              <Label htmlFor="vatApplicable">TVA applicable</Label>
              {vatApplicable && (
                <div className="flex items-center gap-2 ml-4">
                  <Label htmlFor="vatRate">Taux</Label>
                  <Input
                    id="vatRate"
                    name="vatRate"
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    defaultValue={lease.vatRate}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Indexation */}
        <Card>
          <CardHeader>
            <CardTitle>Indexation</CardTitle>
            <CardDescription>
              Indice de révision du loyer (ILC, ILAT ou ICC)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="indexType">Indice de référence</Label>
                <NativeSelect
                  id="indexType"
                  name="indexType"
                  options={INDEX_TYPES}
                  defaultValue={lease.indexType ?? ""}
                  placeholder="Sans indexation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseIndexValue">Valeur de référence</Label>
                <Input
                  id="baseIndexValue"
                  name="baseIndexValue"
                  type="number"
                  step={0.01}
                  defaultValue={lease.baseIndexValue ?? ""}
                  placeholder="Ex: 132.45"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseIndexQuarter">Trimestre de référence</Label>
                <Input
                  id="baseIndexQuarter"
                  name="baseIndexQuarter"
                  defaultValue={lease.baseIndexQuarter ?? ""}
                  placeholder="Ex: T1 2024"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="revisionFrequency">
                Fréquence de révision (mois)
              </Label>
              <Input
                id="revisionFrequency"
                name="revisionFrequency"
                type="number"
                min={1}
                defaultValue={lease.revisionFrequency}
                className="w-32"
              />
            </div>
          </CardContent>
        </Card>

        {/* Clauses */}
        <Card>
          <CardHeader>
            <CardTitle>Clauses particulières</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="tenantWorksClauses">
                Travaux et aménagements autorisés
              </Label>
              <Textarea
                id="tenantWorksClauses"
                name="tenantWorksClauses"
                rows={3}
                defaultValue={lease.tenantWorksClauses ?? ""}
                placeholder="Travaux autorisés, conditions de restitution des lieux..."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href={`/baux/${params.id}`}>
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
              "Enregistrer"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
