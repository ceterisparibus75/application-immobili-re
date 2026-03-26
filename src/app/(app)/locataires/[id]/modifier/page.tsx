"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { updateTenant } from "@/actions/tenant";
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

const RISK_OPTIONS = [
  { value: "VERT", label: "Vert — Aucun risque" },
  { value: "ORANGE", label: "Orange — Vigilance" },
  { value: "ROUGE", label: "Rouge — Risque élevé" },
];

type Tenant = {
  id: string;
  entityType: "PERSONNE_MORALE" | "PERSONNE_PHYSIQUE";
  email: string;
  billingEmail?: string | null;
  phone?: string | null;
  mobile?: string | null;
  riskIndicator: string;
  notes?: string | null;
  companyName?: string | null;
  companyLegalForm?: string | null;
  siret?: string | null;
  codeAPE?: string | null;
  vatNumber?: string | null;
  companyAddress?: string | null;
  shareCapital?: number | null;
  legalRepName?: string | null;
  legalRepTitle?: string | null;
  legalRepEmail?: string | null;
  legalRepPhone?: string | null;
  lastName?: string | null;
  firstName?: string | null;
  birthDate?: string | null;
  birthPlace?: string | null;
  personalAddress?: string | null;
  autoEntrepreneurSiret?: string | null;
};

export default function ModifierLocatairePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { activeSociety } = useSociety();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState("");
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    async function fetchTenant() {
      try {
        const res = await fetch(`/api/tenants/${params.id}`);
        if (res.ok) {
          const json = await res.json() as { data: Tenant };
          setTenant(json.data);
        }
      } finally {
        setIsFetching(false);
      }
    }
    void fetchTenant();
  }, [params.id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety || !tenant) return;

    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const result = await updateTenant(activeSociety.id, {
      id: params.id,
      entityType: tenant.entityType,
      email: data.email,
      billingEmail: data.billingEmail || null,
      phone: data.phone || null,
      mobile: data.mobile || null,
      riskIndicator: data.riskIndicator as "VERT" | "ORANGE" | "ROUGE",
      notes: data.notes || null,
      // Morale
      companyName: data.companyName || null,
      companyLegalForm: data.companyLegalForm || null,
      siret: data.siret || null,
      codeAPE: data.codeAPE || null,
      vatNumber: data.vatNumber || null,
      companyAddress: data.companyAddress || null,
      shareCapital: data.shareCapital ? parseFloat(data.shareCapital) : null,
      legalRepName: data.legalRepName || null,
      legalRepTitle: data.legalRepTitle || null,
      legalRepEmail: data.legalRepEmail || null,
      legalRepPhone: data.legalRepPhone || null,
      // Physique
      lastName: data.lastName || null,
      firstName: data.firstName || null,
      birthDate: data.birthDate || null,
      birthPlace: data.birthPlace || null,
      personalAddress: data.personalAddress || null,
      autoEntrepreneurSiret: data.autoEntrepreneurSiret || null,
    });

    setIsLoading(false);

    if (result.success) {
      router.push(`/locataires/${params.id}`);
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

  if (!tenant) {
    return <div className="text-center py-12 text-muted-foreground">Locataire introuvable</div>;
  }

  const isMorale = tenant.entityType === "PERSONNE_MORALE";

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href={`/locataires/${params.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Modifier le locataire</h1>
          <p className="text-muted-foreground">
            {isMorale ? tenant.companyName : `${tenant.firstName} ${tenant.lastName}`}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {isMorale ? (
          <>
            <Card>
              <CardHeader><CardTitle>Société</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="companyName">Raison sociale *</Label>
                    <Input id="companyName" name="companyName" defaultValue={tenant.companyName ?? ""} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="siret">SIRET</Label>
                    <Input id="siret" name="siret" maxLength={14} defaultValue={tenant.siret ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codeAPE">Code APE</Label>
                    <Input id="codeAPE" name="codeAPE" defaultValue={tenant.codeAPE ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shareCapital">Capital social (€)</Label>
                    <Input id="shareCapital" name="shareCapital" type="number" defaultValue={tenant.shareCapital ?? ""} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyAddress">Adresse du siège</Label>
                  <Input id="companyAddress" name="companyAddress" defaultValue={tenant.companyAddress ?? ""} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Représentant légal</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="legalRepName">Nom</Label>
                    <Input id="legalRepName" name="legalRepName" defaultValue={tenant.legalRepName ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legalRepTitle">Qualité</Label>
                    <Input id="legalRepTitle" name="legalRepTitle" defaultValue={tenant.legalRepTitle ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legalRepEmail">Email</Label>
                    <Input id="legalRepEmail" name="legalRepEmail" type="email" defaultValue={tenant.legalRepEmail ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legalRepPhone">Téléphone</Label>
                    <Input id="legalRepPhone" name="legalRepPhone" defaultValue={tenant.legalRepPhone ?? ""} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardHeader><CardTitle>Identité</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom *</Label>
                  <Input id="lastName" name="lastName" defaultValue={tenant.lastName ?? ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom *</Label>
                  <Input id="firstName" name="firstName" defaultValue={tenant.firstName ?? ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Date de naissance</Label>
                  <Input
                    id="birthDate"
                    name="birthDate"
                    type="date"
                    defaultValue={tenant.birthDate ? tenant.birthDate.slice(0, 10) : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthPlace">Lieu de naissance</Label>
                  <Input id="birthPlace" name="birthPlace" defaultValue={tenant.birthPlace ?? ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="personalAddress">Adresse personnelle</Label>
                <Input id="personalAddress" name="personalAddress" defaultValue={tenant.personalAddress ?? ""} />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email principal *</Label>
                <Input id="email" name="email" type="email" defaultValue={tenant.email} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingEmail">Email de facturation</Label>
                <Input id="billingEmail" name="billingEmail" type="email" defaultValue={tenant.billingEmail ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" name="phone" defaultValue={tenant.phone ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile</Label>
                <Input id="mobile" name="mobile" defaultValue={tenant.mobile ?? ""} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gestion du risque</CardTitle>
            <CardDescription>Indicateur interne de suivi</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="riskIndicator">Indicateur de risque</Label>
              <NativeSelect id="riskIndicator" name="riskIndicator" options={RISK_OPTIONS} defaultValue={tenant.riskIndicator} />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="notes">Notes internes</Label>
              <Textarea id="notes" name="notes" rows={3} defaultValue={tenant.notes ?? ""} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href={`/locataires/${params.id}`}>
            <Button variant="outline" type="button">Annuler</Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement...</>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
