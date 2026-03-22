"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateBatchInvoices, getActiveLeasesForInvoicing } from "@/actions/invoice";
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
import { ArrowLeft, Loader2, Zap, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";

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

export default function GenererFacturesPage() {
  const router = useRouter();
  const { activeSociety } = useSociety();

  const [leases, setLeases] = useState<LeaseOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(true);
  const [periodMonth, setPeriodMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
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
  }

  function handleSelectAll(checked: boolean) {
    setSelectAll(checked);
    if (checked) setSelectedIds(new Set(leases.map((l) => l.id)));
    else setSelectedIds(new Set());
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
                {result.skipped} bail{result.skipped !== 1 ? "s" : ""} ignoré{result.skipped !== 1 ? "s" : ""} (facture déjà existante pour cette période)
              </p>
            )}

            {result.errors.length > 0 && (
              <div className="rounded-md bg-destructive/10 p-3 space-y-1">
                <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                  <AlertCircle className="h-4 w-4" />
                  {result.errors.length} erreur{result.errors.length !== 1 ? "s" : ""}
                </div>
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive pl-6">
                    {err}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setResult(null)}>
            Nouvelle génération
          </Button>
          <Link href="/facturation">
            <Button>Voir les factures</Button>
          </Link>
        </div>
      </div>
    );
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
              onChange={(e) => setPeriodMonth(e.target.value)}
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
          {/* Tout sélectionner */}
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
              const ttc = lease.vatApplicable
                ? ht * (1 + lease.vatRate / 100)
                : ht;

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
                      <span className="text-sm font-medium">
                        {tenantLabel(lease.tenant)}
                      </span>
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
          onClick={handleGenerate}
          disabled={selectedIds.size === 0 || isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Générer {selectedIds.size} facture{selectedIds.size !== 1 ? "s" : ""}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
