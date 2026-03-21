"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createInvoice } from "@/actions/invoice";
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

const INVOICE_TYPES = [
  { value: "APPEL_LOYER", label: "Appel de loyer" },
  { value: "QUITTANCE", label: "Quittance de loyer" },
  { value: "REGULARISATION_CHARGES", label: "Régularisation de charges" },
  { value: "REFACTURATION", label: "Refacturation" },
  { value: "AVOIR", label: "Avoir" },
];

type TenantOption = {
  id: string;
  entityType: string;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
};

type InvoiceLine = {
  label: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
};

function tenantLabel(t: TenantOption) {
  return t.entityType === "PERSONNE_MORALE"
    ? (t.companyName ?? t.email)
    : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || t.email;
}

export default function NouvelleFacturePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeSociety } = useSociety();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [lines, setLines] = useState<InvoiceLine[]>([
    { label: "", quantity: 1, unitPrice: 0, vatRate: 20 },
  ]);

  const defaultTenantId = searchParams.get("tenantId") ?? "";

  useEffect(() => {
    async function fetchTenants() {
      const res = await fetch("/api/tenants/active");
      if (res.ok) {
        const json = await res.json() as { data: TenantOption[] };
        setTenants(json.data);
      }
    }
    void fetchTenants();
  }, []);

  function addLine() {
    setLines([...lines, { label: "", quantity: 1, unitPrice: 0, vatRate: 20 }]);
  }

  function removeLine(index: number) {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof InvoiceLine, value: string | number) {
    setLines(
      lines.map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      )
    );
  }

  const totals = lines.reduce(
    (acc, line) => {
      const ht = line.quantity * line.unitPrice;
      const vat = ht * (line.vatRate / 100);
      return { ht: acc.ht + ht, vat: acc.vat + vat, ttc: acc.ttc + ht + vat };
    },
    { ht: 0, vat: 0, ttc: 0 }
  );

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

    const result = await createInvoice(activeSociety.id, {
      tenantId: data.tenantId!,
      invoiceType: data.invoiceType as
        | "APPEL_LOYER"
        | "QUITTANCE"
        | "REGULARISATION_CHARGES"
        | "REFACTURATION"
        | "AVOIR",
      issueDate: data.issueDate!,
      dueDate: data.dueDate!,
      periodStart: data.periodStart || null,
      periodEnd: data.periodEnd || null,
      lines,
    });

    setIsLoading(false);

    if (result.success && result.data) {
      router.push(`/facturation/${result.data.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/facturation">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouvelle facture</h1>
          <p className="text-muted-foreground">Créer un document de facturation</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* En-tête */}
        <Card>
          <CardHeader>
            <CardTitle>Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
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
                      {tenantLabel(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoiceType">Type de facture *</Label>
                <Select
                  id="invoiceType"
                  name="invoiceType"
                  options={INVOICE_TYPES}
                  defaultValue="APPEL_LOYER"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="issueDate">Date d&apos;émission *</Label>
                <Input
                  id="issueDate"
                  name="issueDate"
                  type="date"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Date d&apos;échéance *</Label>
                <Input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="periodStart">Début de période</Label>
                <Input id="periodStart" name="periodStart" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodEnd">Fin de période</Label>
                <Input id="periodEnd" name="periodEnd" type="date" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lignes */}
        <Card>
          <CardHeader>
            <CardTitle>Lignes de facturation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {lines.map((line, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5 space-y-1">
                    {index === 0 && (
                      <Label className="text-xs">Désignation</Label>
                    )}
                    <Input
                      value={line.label}
                      onChange={(e) => updateLine(index, "label", e.target.value)}
                      placeholder="Ex: Loyer HT janvier 2025"
                      required
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && <Label className="text-xs">Qté</Label>}
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(index, "quantity", parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && (
                      <Label className="text-xs">Prix unit. HT (€)</Label>
                    )}
                    <Input
                      type="number"
                      step={0.01}
                      value={line.unitPrice}
                      onChange={(e) =>
                        updateLine(index, "unitPrice", parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && <Label className="text-xs">TVA %</Label>}
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={line.vatRate}
                      onChange={(e) =>
                        updateLine(index, "vatRate", parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="col-span-1">
                    {index === 0 && <div className="h-4" />}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(index)}
                      disabled={lines.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4" />
              Ajouter une ligne
            </Button>

            {/* Totaux */}
            <div className="border-t pt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total HT</span>
                <span className="font-medium">
                  {totals.ht.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">TVA</span>
                <span className="font-medium">
                  {totals.vat.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                </span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Total TTC</span>
                <span>
                  {totals.ttc.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/facturation">
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
              "Créer la facture"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
