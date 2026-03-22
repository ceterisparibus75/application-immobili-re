"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInvoice, generateInvoiceFromLease, getActiveLeasesForInvoicing } from "@/actions/invoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Plus, Trash2, Zap, PenLine } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────

type TenantOption = {
  id: string;
  entityType: string;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
};

type LeaseOption = Awaited<ReturnType<typeof getActiveLeasesForInvoicing>>[number];

type InvoiceLine = {
  label: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
};

// ── Constantes ────────────────────────────────────────────────────────────

const INVOICE_TYPES = [
  { value: "APPEL_LOYER", label: "Appel de loyer" },
  { value: "QUITTANCE", label: "Quittance de loyer" },
  { value: "REGULARISATION_CHARGES", label: "Régularisation de charges" },
  { value: "REFACTURATION", label: "Refacturation" },
  { value: "AVOIR", label: "Avoir" },
];

const FREQ_LABELS: Record<string, string> = {
  MENSUEL: "Mensuel",
  TRIMESTRIEL: "Trimestriel",
  SEMESTRIEL: "Semestriel",
  ANNUEL: "Annuel",
};

const TERM_LABELS: Record<string, string> = {
  A_ECHOIR: "Terme à échoir",
  ECHU: "Terme échu",
};

// ── Helpers ───────────────────────────────────────────────────────────────

function tenantLabel(t: { entityType: string; companyName?: string | null; firstName?: string | null; lastName?: string | null; email?: string }) {
  return t.entityType === "PERSONNE_MORALE"
    ? (t.companyName ?? t.email ?? "—")
    : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || (t.email ?? "—");
}

function leaseLabel(l: LeaseOption) {
  const lot = l.lot ? `${l.lot.building.name} – Lot ${l.lot.number}` : "";
  const tenant = tenantLabel(l.tenant);
  return `${tenant}${lot ? " · " + lot : ""}`;
}

function fmt(v: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}

// ── Composant ─────────────────────────────────────────────────────────────

export default function NouvelleFacturePage() {
  const router = useRouter();
  const { activeSociety } = useSociety();

  const [mode, setMode] = useState<"auto" | "manual">("auto");

  // ── Mode auto ──
  const [leases, setLeases] = useState<LeaseOption[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState("");
  const [periodMonth, setPeriodMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [isGenerating, startGenerating] = useTransition();

  // ── Mode manuel ──
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [lines, setLines] = useState<InvoiceLine[]>([
    { label: "", quantity: 1, unitPrice: 0, vatRate: 20 },
  ]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  // Chargement des baux actifs et locataires
  useEffect(() => {
    if (!activeSociety) return;
    void getActiveLeasesForInvoicing(activeSociety.id).then(setLeases);
    void fetch("/api/tenants/active")
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((j: { data: TenantOption[] }) => setTenants(j.data));
  }, [activeSociety]);

  const selectedLease = leases.find((l) => l.id === selectedLeaseId) ?? null;

  // Preview du montant
  const previewAmount = selectedLease
    ? (() => {
        const ht = selectedLease.currentRentHT;
        const vat = selectedLease.vatApplicable ? ht * (selectedLease.vatRate / 100) : 0;
        return { ht, vat, ttc: ht + vat };
      })()
    : null;

  // ── Handlers auto ──
  function handleGenerate() {
    if (!activeSociety || !selectedLeaseId) return;
    startGenerating(async () => {
      const result = await generateInvoiceFromLease(activeSociety.id, {
        leaseId: selectedLeaseId,
        periodMonth,
      });
      if (result.success && result.data) {
        toast.success(`Facture ${result.data.invoiceNumber} créée`);
        router.push(`/facturation/${result.data.id}`);
      } else {
        toast.error(result.error ?? "Erreur lors de la génération");
      }
    });
  }

  // ── Handlers manuel ──
  function addLine() {
    setLines([...lines, { label: "", quantity: 1, unitPrice: 0, vatRate: 20 }]);
  }

  function removeLine(index: number) {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof InvoiceLine, value: string | number) {
    setLines(lines.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }

  const totals = lines.reduce(
    (acc, line) => {
      const ht = line.quantity * line.unitPrice;
      const vat = ht * (line.vatRate / 100);
      return { ht: acc.ht + ht, vat: acc.vat + vat, ttc: acc.ttc + ht + vat };
    },
    { ht: 0, vat: 0, ttc: 0 }
  );

  async function handleManualSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) {
      setError("Aucune société sélectionnée");
      return;
    }
    setError("");
    setIsCreating(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const result = await createInvoice(activeSociety.id, {
      tenantId: data.tenantId!,
      leaseId: data.leaseId || null,
      invoiceType: data.invoiceType as "APPEL_LOYER" | "QUITTANCE" | "REGULARISATION_CHARGES" | "REFACTURATION" | "AVOIR",
      issueDate: data.issueDate!,
      dueDate: data.dueDate!,
      periodStart: data.periodStart || null,
      periodEnd: data.periodEnd || null,
      lines,
    });

    setIsCreating(false);

    if (result.success && result.data) {
      router.push(`/facturation/${result.data.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <Link href="/facturation">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouvelle facture</h1>
          <p className="text-muted-foreground">Générer depuis un bail ou saisir manuellement</p>
        </div>
      </div>

      {/* Sélecteur de mode */}
      <div className="flex gap-2">
        <Button
          variant={mode === "auto" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("auto")}
        >
          <Zap className="h-4 w-4" />
          Depuis un bail
        </Button>
        <Button
          variant={mode === "manual" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("manual")}
        >
          <PenLine className="h-4 w-4" />
          Saisie manuelle
        </Button>
      </div>

      {/* ── Mode : Génération depuis un bail ── */}
      {mode === "auto" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Appel de loyer automatique</CardTitle>
              <CardDescription>
                Sélectionnez un bail et une période. La facture sera pré-remplie avec les
                paramètres du bail (fréquence, terme, loyer, TVA, loyer progressif).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="leaseId">Bail actif *</Label>
                  <select
                    id="leaseId"
                    value={selectedLeaseId}
                    onChange={(e) => setSelectedLeaseId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Sélectionner un bail...</option>
                    {leases.map((l) => (
                      <option key={l.id} value={l.id}>
                        {leaseLabel(l)}
                      </option>
                    ))}
                  </select>
                  {leases.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Aucun bail actif trouvé pour cette société.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="periodMonth">Période *</Label>
                  <Input
                    id="periodMonth"
                    type="month"
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Mois pour lequel générer la facture
                  </p>
                </div>
              </div>

              {/* Aperçu du bail sélectionné */}
              {selectedLease && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <p className="text-sm font-medium">Aperçu du bail</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    <div>
                      <span className="text-muted-foreground">Locataire</span>
                      <p className="font-medium">{tenantLabel(selectedLease.tenant)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Local</span>
                      <p className="font-medium">
                        {selectedLease.lot
                          ? `${selectedLease.lot.building.name} – Lot ${selectedLease.lot.number}`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fréquence</span>
                      <p className="font-medium">
                        <Badge variant="outline" className="text-xs">
                          {FREQ_LABELS[selectedLease.paymentFrequency] ?? selectedLease.paymentFrequency}
                        </Badge>
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Terme</span>
                      <p className="font-medium">
                        <Badge variant="secondary" className="text-xs">
                          {TERM_LABELS[selectedLease.billingTerm] ?? selectedLease.billingTerm}
                        </Badge>
                      </p>
                    </div>
                    {selectedLease.rentFreeMonths && selectedLease.rentFreeMonths > 0 && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Franchise de loyer</span>
                        <p className="font-medium text-orange-600">
                          {selectedLease.rentFreeMonths} mois
                        </p>
                      </div>
                    )}
                  </div>

                  {previewAmount && (
                    <div className="border-t pt-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Loyer HT</span>
                        <span>{fmt(previewAmount.ht)}</span>
                      </div>
                      {selectedLease.vatApplicable && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            TVA ({selectedLease.vatRate}%)
                          </span>
                          <span>{fmt(previewAmount.vat)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold">
                        <span>Total TTC</span>
                        <span>{fmt(previewAmount.ttc)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Link href="/facturation">
              <Button variant="outline" type="button">Annuler</Button>
            </Link>
            <Button
              onClick={handleGenerate}
              disabled={!selectedLeaseId || !periodMonth || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Générer la facture
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Mode : Saisie manuelle ── */}
      {mode === "manual" && (
        <form onSubmit={handleManualSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

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
                  <Input id="issueDate" name="issueDate" type="date" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Date d&apos;échéance *</Label>
                  <Input id="dueDate" name="dueDate" type="date" required />
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
                      {index === 0 && <Label className="text-xs">Désignation</Label>}
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
                      {index === 0 && <Label className="text-xs">Prix unit. HT (€)</Label>}
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
              <Button variant="outline" type="button">Annuler</Button>
            </Link>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? (
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
      )}
    </div>
  );
}
