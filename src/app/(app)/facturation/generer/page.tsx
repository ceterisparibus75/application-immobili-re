"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateBatchInvoices,
  getActiveLeasesForInvoicing,
  previewBatchInvoices,
  type InvoicePreview,
} from "@/actions/invoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Loader2,
  Zap,
  CheckCircle2,
  AlertCircle,
  Eye,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";
import { InvoicePreviewSheet } from "@/components/invoice-preview-sheet";

type LeaseOption = Awaited<ReturnType<typeof getActiveLeasesForInvoicing>>[number];

const FREQ_LABELS: Record<string, string> = {
  MENSUEL: "Mensuel",
  TRIMESTRIEL: "Trimestriel",
  SEMESTRIEL: "Semestriel",
  ANNUEL: "Annuel",
};

const TERM_LABELS: Record<string, string> = {
  A_ECHOIR: "À échoir",
  ECHU: "Échu",
};

function fmt(v: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);
}

function tenantLabel(t: LeaseOption["tenant"]) {
  return t.entityType === "PERSONNE_MORALE"
    ? (t.companyName ?? "—")
    : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || "—";
}

// ── Composant carte prévisualisation d'une facture ────────────────────────

function PreviewCard({ p, onPreview }: { p: InvoicePreview; onPreview: (p: InvoicePreview) => void }) {
  return (
    <div className={`rounded-lg border p-3 ${p.alreadyExists ? "opacity-50 bg-muted/30" : "bg-background"}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{p.tenantName}</span>
            {p.alreadyExists && (
              <Badge variant="secondary" className="text-xs">Déjà facturé</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{p.lotLabel} · {p.periodLabel}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-2">
          <span className="text-sm font-semibold tabular-nums">{fmt(p.totalTTC)}</span>
          <button
            type="button"
            onClick={() => onPreview(p)}
            className="text-xs text-primary underline underline-offset-2 hover:no-underline flex items-center gap-1"
          >
            <Eye className="h-3 w-3" />
            Aperçu
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────

export default function GenererFacturesPage() {
  const { activeSociety } = useSociety();

  const [leases, setLeases] = useState<LeaseOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(true);
  const [periodMonth, setPeriodMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [step, setStep] = useState<"form" | "preview">("form");
  const [previews, setPreviews] = useState<InvoicePreview[]>([]);
  const [sheetPreview, setSheetPreview] = useState<InvoicePreview | null>(null);
  const [isPreviewing, startPreviewing] = useTransition();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  useEffect(() => {
    if (!activeSociety) return;
    void getActiveLeasesForInvoicing(activeSociety.id).then((data) => {
      setLeases(data);
      setSelectedIds(new Set(data.map((l) => l.id)));
    });
  }, [activeSociety]);

  function toggleLease(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setStep("form");
  }

  function handleSelectAll(checked: boolean) {
    setSelectAll(checked);
    if (checked) setSelectedIds(new Set(leases.map((l) => l.id)));
    else setSelectedIds(new Set());
    setStep("form");
  }

  function handlePeriodChange(val: string) {
    setPeriodMonth(val);
    setStep("form");
  }

  function handlePreview() {
    if (!activeSociety) return;
    startPreviewing(async () => {
      const res = await previewBatchInvoices(activeSociety.id, {
        periodMonth,
        leaseIds: selectAll ? undefined : [...selectedIds],
      });
      if (res.success && res.data) {
        setPreviews(res.data);
        setStep("preview");
      }
    });
  }

  function handleGenerate() {
    if (!activeSociety) return;
    startTransition(async () => {
      const res = await generateBatchInvoices(activeSociety.id, {
        periodMonth,
        leaseIds: selectAll ? undefined : [...selectedIds],
      });
      if (res.success && res.data) {
        setResult(res.data);
      }
    });
  }

  // ── Écran résultat ──
  if (result) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <Link href="/facturation">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Résultat de la génération</h1>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              <p className="text-lg font-semibold">
                {result.created} facture{result.created !== 1 ? "s" : ""} créée{result.created !== 1 ? "s" : ""}
              </p>
            </div>
            {result.skipped > 0 && (
              <p className="text-sm text-muted-foreground">
                {result.skipped} bail{result.skipped !== 1 ? "s" : ""} ignoré{result.skipped !== 1 ? "s" : ""} (facture déjà existante)
              </p>
            )}
            {result.errors.length > 0 && (
              <div className="rounded-md bg-destructive/10 p-3 space-y-1">
                <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                  <AlertCircle className="h-4 w-4" />
                  {result.errors.length} erreur{result.errors.length !== 1 ? "s" : ""}
                </div>
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive pl-6">{err}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setResult(null); setStep("form"); }}>
            Nouvelle génération
          </Button>
          <Link href="/facturation">
            <Button>Voir les factures</Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Étape prévisualisation ──
  if (step === "preview") {
    const toCreate = previews.filter((p) => !p.alreadyExists);
    const toSkip = previews.filter((p) => p.alreadyExists);
    const totalTTC = toCreate.reduce((s, p) => s + p.totalTTC, 0);

    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setStep("form")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Prévisualisation</h1>
            <p className="text-muted-foreground">Vérifiez les factures avant de confirmer la génération</p>
          </div>
        </div>

        {/* Résumé */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">À créer</p>
              <p className="text-2xl font-bold">{toCreate.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Déjà existantes</p>
              <p className="text-2xl font-bold text-muted-foreground">{toSkip.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total TTC à générer</p>
              <p className="text-2xl font-bold">{fmt(totalTTC)}</p>
            </CardContent>
          </Card>
        </div>

        {toCreate.length === 0 && (
          <div className="flex items-center gap-3 rounded-md border border-orange-200 bg-orange-50 dark:bg-orange-950/20 p-4 text-sm text-orange-700 dark:text-orange-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Toutes les factures de cette période existent déjà. Aucune nouvelle facture ne sera créée.
          </div>
        )}

        {/* Liste des factures */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {previews.length} facture{previews.length !== 1 ? "s" : ""} — cliquez pour voir le détail des lignes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[28rem] overflow-y-auto">
            {sheetPreview && (
              <InvoicePreviewSheet
                open={!!sheetPreview}
                onOpenChange={(open) => { if (!open) setSheetPreview(null); }}
                preview={sheetPreview}
              />
            )}
            {previews.map((p) => (
              <PreviewCard key={p.leaseId} p={p} onPreview={setSheetPreview} />
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setStep("form")}>
            Modifier la sélection
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isPending || toCreate.length === 0}
          >
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Génération en cours...</>
            ) : (
              <><Zap className="h-4 w-4" />Confirmer — générer {toCreate.length} facture{toCreate.length !== 1 ? "s" : ""}</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ── Étape formulaire ──
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/facturation">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Générer les appels de loyers</h1>
          <p className="text-muted-foreground">
            Créez automatiquement les factures pour tous les baux actifs
          </p>
        </div>
      </div>

      {/* Période */}
      <Card>
        <CardHeader>
          <CardTitle>Période de facturation</CardTitle>
          <CardDescription>
            Les factures seront créées pour la période correspondant à ce mois selon la
            fréquence de chaque bail (mensuel, trimestriel, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="periodMonth">Mois de référence *</Label>
            <Input
              id="periodMonth"
              type="month"
              value={periodMonth}
              onChange={(e) => handlePeriodChange(e.target.value)}
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Sélection des baux */}
      <Card>
        <CardHeader>
          <CardTitle>Baux à facturer</CardTitle>
          <CardDescription>
            {leases.length} bail{leases.length !== 1 ? "s" : ""} actif{leases.length !== 1 ? "s" : ""} —{" "}
            {selectedIds.size} sélectionné{selectedIds.size !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectAll && selectedIds.size === leases.length}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <span className="text-sm font-medium">Tout sélectionner</span>
          </label>

          <div className="divide-y max-h-80 overflow-y-auto">
            {leases.map((lease) => {
              const ht = lease.currentRentHT;
              const ttc = lease.vatApplicable ? ht * (1 + lease.vatRate / 100) : ht;

              return (
                <label
                  key={lease.id}
                  className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-muted/40 px-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(lease.id)}
                    onChange={() => toggleLease(lease.id)}
                    className="h-4 w-4 rounded border-input shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{tenantLabel(lease.tenant)}</span>
                      <Badge variant="outline" className="text-xs">
                        {FREQ_LABELS[lease.paymentFrequency] ?? lease.paymentFrequency}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {TERM_LABELS[lease.billingTerm] ?? lease.billingTerm}
                      </Badge>
                    </div>
                    {lease.lot && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {lease.lot.building.name} – Lot {lease.lot.number}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-semibold shrink-0">{fmt(ttc)}</span>
                </label>
              );
            })}
          </div>

          {leases.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucun bail actif pour cette société.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Link href="/facturation">
          <Button variant="outline">Annuler</Button>
        </Link>
        <Button
          onClick={handlePreview}
          disabled={selectedIds.size === 0 || isPreviewing}
          variant="outline"
        >
          {isPreviewing ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Calcul...</>
          ) : (
            <><Eye className="h-4 w-4" />Prévisualiser {selectedIds.size} facture{selectedIds.size !== 1 ? "s" : ""}</>
          )}
        </Button>
      </div>
    </div>
  );
}
