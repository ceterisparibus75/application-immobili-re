"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createLease } from "@/actions/lease";
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

const LEASE_TYPES = [
  { value: "COMMERCIAL_369", label: "Bail commercial 3-6-9" },
  { value: "DEROGATOIRE", label: "Bail dérogatoire" },
  { value: "PRECAIRE", label: "Convention d'occupation précaire" },
  { value: "BAIL_PROFESSIONNEL", label: "Bail professionnel" },
];

const PAYMENT_FREQUENCIES = [
  { value: "MENSUEL", label: "Mensuel" },
  { value: "TRIMESTRIEL", label: "Trimestriel" },
  { value: "SEMESTRIEL", label: "Semestriel" },
  { value: "ANNUEL", label: "Annuel" },
];

const BILLING_TERMS = [
  {
    value: "A_ECHOIR",
    label: "Terme à échoir (paiement en début de période)",
  },
  {
    value: "ECHU",
    label: "Terme échu (paiement en fin de période)",
  },
];

const INDEX_TYPES = [
  { value: "ILC", label: "ILC — Indice des Loyers Commerciaux" },
  { value: "ILAT", label: "ILAT — Indice des Loyers des Activités Tertiaires" },
  { value: "ICC", label: "ICC — Indice du Coût de la Construction" },
];

type LotOption = {
  id: string;
  number: string;
  lotType: string;
  area: number;
  building: { id: string; name: string; city: string };
};

type TenantOption = {
  id: string;
  entityType: string;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
};

export default function NouveauBailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeSociety } = useSociety();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [lots, setLots] = useState<LotOption[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [vatApplicable, setVatApplicable] = useState(true);

  const defaultLotId = searchParams.get("lotId") ?? "";
  const defaultTenantId = searchParams.get("tenantId") ?? "";

  useEffect(() => {
    async function fetchOptions() {
      const [lotsRes, tenantsRes] = await Promise.all([
        fetch("/api/lots/vacant"),
        fetch("/api/tenants/active"),
      ]);
      if (lotsRes.ok) {
        const json = await lotsRes.json() as { data: LotOption[] };
        setLots(json.data);
      }
      if (tenantsRes.ok) {
        const json = await tenantsRes.json() as { data: TenantOption[] };
        setTenants(json.data);
      }
    }
    void fetchOptions();
  }, []);

  function tenantLabel(t: TenantOption) {
    return t.entityType === "PERSONNE_MORALE"
      ? (t.companyName ?? t.email)
      : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || t.email;
  }

  function lotLabel(l: LotOption) {
    return `${l.building.name} — Lot ${l.number} (${l.area} m²) — ${l.building.city}`;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) {
      setError("Aucune société sélectionnée");
      return;
    }

    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const result = await createLease(activeSociety.id, {
      lotId: data.lotId,
      tenantId: data.tenantId,
      leaseType: data.leaseType as "COMMERCIAL_369" | "DEROGATOIRE" | "PRECAIRE" | "BAIL_PROFESSIONNEL",
      startDate: data.startDate,
      durationMonths: parseInt(data.durationMonths) || 108,
      baseRentHT: parseFloat(data.baseRentHT),
      depositAmount: parseFloat(data.depositAmount) || 0,
      paymentFrequency: data.paymentFrequency as "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL",
      billingTerm: (data.billingTerm as "ECHU" | "A_ECHOIR") || "A_ECHOIR",
      vatApplicable: data.vatApplicable === "on",
      vatRate: parseFloat(data.vatRate) || 20,
      indexType: (data.indexType as "ILC" | "ILAT" | "ICC") || null,
      baseIndexValue: data.baseIndexValue ? parseFloat(data.baseIndexValue) : null,
      baseIndexQuarter: data.baseIndexQuarter || null,
      revisionFrequency: parseInt(data.revisionFrequency) || 12,
      rentFreeMonths: parseFloat(data.rentFreeMonths) || 0,
      entryFee: parseFloat(data.entryFee) || 0,
      tenantWorksClauses: data.tenantWorksClauses || null,
    });

    setIsLoading(false);

    if (result.success && result.data) {
      router.push(`/baux/${result.data.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/baux">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouveau bail</h1>
          <p className="text-muted-foreground">Créer un bail commercial</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Parties */}
        <Card>
          <CardHeader>
            <CardTitle>Parties au bail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lotId">Lot *</Label>
              <select
                id="lotId"
                name="lotId"
                defaultValue={defaultLotId}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Sélectionner un lot vacant...</option>
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {lotLabel(l)}
                  </option>
                ))}
              </select>
              {lots.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucun lot vacant disponible.{" "}
                  <Link href="/patrimoine/immeubles" className="underline">
                    Gérer les lots
                  </Link>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenantId">Locataire *</Label>
              <select
                id="tenantId"
                name="tenantId"
                defaultValue={defaultTenantId}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Sélectionner un locataire...</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {tenantLabel(t)} — {t.email}
                  </option>
                ))}
              </select>
              {tenants.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucun locataire actif.{" "}
                  <Link href="/locataires/nouveau" className="underline">
                    Créer un locataire
                  </Link>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Type et durée */}
        <Card>
          <CardHeader>
            <CardTitle>Type et durée</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leaseType">Type de bail *</Label>
                <NativeSelect
                  id="leaseType"
                  name="leaseType"
                  options={LEASE_TYPES}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="durationMonths">Durée (mois) *</Label>
                <Input
                  id="durationMonths"
                  name="durationMonths"
                  type="number"
                  min={1}
                  defaultValue={108}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Date de début *</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentFrequency">Fréquence de paiement</Label>
                <NativeSelect
                  id="paymentFrequency"
                  name="paymentFrequency"
                  options={PAYMENT_FREQUENCIES}
                  defaultValue="MENSUEL"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="billingTerm">Terme de facturation</Label>
                <NativeSelect
                  id="billingTerm"
                  name="billingTerm"
                  options={BILLING_TERMS}
                  defaultValue="A_ECHOIR"
                />
                <p className="text-xs text-muted-foreground">
                  À échoir : le loyer est dû au début de la période couverte.
                  Échu : le loyer est dû après la période.
                </p>
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
                <Label htmlFor="baseRentHT">Loyer de base HT (€/mois) *</Label>
                <Input
                  id="baseRentHT"
                  name="baseRentHT"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
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
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="vatApplicable"
                name="vatApplicable"
                defaultChecked
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
                    defaultValue={20}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              )}
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rentFreeMonths">Franchise de loyer (mois)</Label>
                <Input
                  id="rentFreeMonths"
                  name="rentFreeMonths"
                  type="number"
                  min={0}
                  step={0.5}
                  defaultValue={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entryFee">Pas-de-porte (€)</Label>
                <Input
                  id="entryFee"
                  name="entryFee"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={0}
                />
              </div>
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
                  placeholder="Ex: 132.45"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseIndexQuarter">Trimestre de référence</Label>
                <Input
                  id="baseIndexQuarter"
                  name="baseIndexQuarter"
                  placeholder="Ex: T1 2024"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="revisionFrequency">Fréquence de révision (mois)</Label>
              <Input
                id="revisionFrequency"
                name="revisionFrequency"
                type="number"
                min={1}
                defaultValue={12}
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
                placeholder="Travaux autorisés, conditions de restitution des lieux..."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/baux">
            <Button variant="outline" type="button">
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Création...
              </>
            ) : (
              "Créer le bail"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
