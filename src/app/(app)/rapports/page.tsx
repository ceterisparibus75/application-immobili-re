"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Download, FileSpreadsheet, FileText, Loader2, AlertCircle, CheckCircle2, CalendarClock } from "lucide-react";
import { getTenantsForSelect } from "@/actions/tenant";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────

type ReportType =
  | "SITUATION_LOCATIVE"
  | "COMPTE_RENDU_GESTION"
  | "RENTABILITE_LOT"
  | "ETAT_IMPAYES"
  | "RECAP_CHARGES_LOCATAIRE"
  | "SUIVI_TRAVAUX"
  | "BALANCE_AGEE"
  | "SUIVI_MENSUEL"
  | "VACANCE_LOCATIVE";

interface ReportDef {
  type: ReportType;
  label: string;
  description: string;
  format: "pdf" | "xlsx" | "both";
  requiresTenant?: boolean;
  requiresYear?: boolean;
}

const REPORTS: ReportDef[] = [
  {
    type: "SITUATION_LOCATIVE",
    label: "Situation locative par immeuble",
    description: "Liste tous les lots avec statut d'occupation, locataire et loyer actuel.",
    format: "pdf",
  },
  {
    type: "COMPTE_RENDU_GESTION",
    label: "Compte-rendu de gestion annuel",
    description: "Synthèse annuelle : loyers encaissés, charges, résultat net par immeuble.",
    format: "pdf",
    requiresYear: true,
  },
  {
    type: "RENTABILITE_LOT",
    label: "Tableau de rentabilité par lot",
    description: "Revenus annuels, occupation et valeur locative de marché par lot.",
    format: "xlsx",
    requiresYear: true,
  },
  {
    type: "ETAT_IMPAYES",
    label: "État des impayés (détail)",
    description: "Liste simple de toutes les factures impayées ou en retard avec nombre de jours de retard.",
    format: "both",
  },
  {
    type: "RECAP_CHARGES_LOCATAIRE",
    label: "Récapitulatif charges locataire",
    description: "Provisions sur charges, régularisations et loyers appelés par bail.",
    format: "pdf",
    requiresTenant: true,
    requiresYear: true,
  },
  {
    type: "SUIVI_TRAVAUX",
    label: "Suivi des travaux et maintenances",
    description: "Toutes les interventions de l'année avec coûts et dates, synthèse par immeuble.",
    format: "xlsx",
    requiresYear: true,
  },
  {
    type: "BALANCE_AGEE",
    label: "Balance âgée & impayés",
    description: "Analyse complète des créances : liste détaillée des impayés + classement par ancienneté (0-30j, 31-60j, 61-90j, 90j+).",
    format: "pdf",
  },
  {
    type: "SUIVI_MENSUEL",
    label: "Tableau de suivi mensuel",
    description: "Suivi mensuel par immeuble : loyers facturés/encaissés, charges et taux de recouvrement.",
    format: "pdf",
    requiresYear: true,
  },
  {
    type: "VACANCE_LOCATIVE",
    label: "Vacance locative et financière",
    description: "Taux d'occupation/vacance par immeuble avec graphiques et analyse par surface.",
    format: "pdf",
  },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => ({
  value: String(CURRENT_YEAR - i),
  label: String(CURRENT_YEAR - i),
}));

// ── Composant carte rapport ────────────────────────────────────────

interface ReportCardProps {
  report: ReportDef;
  year: string;
  tenantId: string;
  format: "pdf" | "xlsx";
}

function ReportCard({ report, year, tenantId, format }: ReportCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const actualFormat = report.format === "both" ? format : report.format;

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const body: Record<string, unknown> = {
        type: report.type,
        format: actualFormat,
      };
      if (report.requiresYear) body.year = parseInt(year);
      if (report.requiresTenant) {
        if (!tenantId.trim()) {
          setError("Veuillez saisir un identifiant de locataire.");
          setLoading(false);
          return;
        }
        body.tenantId = tenantId.trim();
      }

      const res = await fetch("/api/rapports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const errorMsg =
          (data as { error?: { message?: string } } | null)?.error?.message
          ?? `Erreur ${res.status} lors de la génération`;
        setError(errorMsg);
        return;
      }

      const blob = await res.blob();
      if (blob.size === 0) {
        setError("Le fichier généré est vide. Vérifiez vos données.");
        return;
      }

      const disposition = res.headers.get("Content-Disposition") ?? "";
      const fnMatch = disposition.match(/filename="([^"]+)"/);
      const filename = fnMatch?.[1] ?? `rapport.${actualFormat}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setSuccess(true);

      // Le message de succès disparaît après 3 secondes
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion et réessayez.");
    } finally {
      setLoading(false);
    }
  };

  const Icon = actualFormat === "xlsx" ? FileSpreadsheet : FileText;
  const iconColor = actualFormat === "xlsx" ? "text-[var(--color-status-positive)]" : "text-blue-600";

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex-shrink-0 ${iconColor}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold leading-snug">{report.label}</CardTitle>
            <CardDescription className="text-xs mt-1">{report.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 mt-auto">
        {error && (
          <div className="flex items-start gap-1.5 text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-status-positive)] bg-[var(--color-status-positive-bg)] rounded px-2 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Téléchargement terminé</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${actualFormat === "xlsx" ? "text-[var(--color-status-positive)] border-[var(--color-status-positive)]/30 bg-[var(--color-status-positive-bg)]" : "text-blue-700 border-blue-200 bg-blue-50"}`}>
            {actualFormat.toUpperCase()}
          </span>
          <Button size="sm" onClick={handleDownload} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {loading ? "Génération..." : "Télécharger"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page principale ────────────────────────────────────────────────

const CATEGORIES = [
  {
    label: "Patrimoine et occupation",
    reports: ["SITUATION_LOCATIVE", "RENTABILITE_LOT", "VACANCE_LOCATIVE"] as ReportType[],
  },
  {
    label: "Comptabilité et finances",
    reports: ["COMPTE_RENDU_GESTION", "BALANCE_AGEE", "ETAT_IMPAYES", "SUIVI_MENSUEL"] as ReportType[],
  },
  {
    label: "Par locataire",
    reports: ["RECAP_CHARGES_LOCATAIRE"] as ReportType[],
  },
  {
    label: "Travaux et maintenances",
    reports: ["SUIVI_TRAVAUX"] as ReportType[],
  },
];

export default function RapportsPage() {
  const [year, setYear]       = useState(String(CURRENT_YEAR));
  const [tenantId, setTenantId] = useState("");
  const [format, setFormat]   = useState<"pdf" | "xlsx">("pdf");
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    getTenantsForSelect().then(setTenants).catch(() => {});
  }, []);

  const byType = Object.fromEntries(REPORTS.map(r => [r.type, r]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rapports</h1>
          <p className="text-muted-foreground">Générez et téléchargez vos rapports PDF et Excel</p>
        </div>
        <Link href="/rapports/planification">
          <Button variant="outline" className="gap-2">
            <CalendarClock className="h-4 w-4" />
            Planification
          </Button>
        </Link>
      </div>

      {/* Paramètres globaux */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Paramètres</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Exercice</Label>
            <NativeSelect
              options={YEAR_OPTIONS}
              value={year}
              onChange={e => setYear(e.target.value)}
              className="w-28"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Format (rapports au choix)</Label>
            <NativeSelect
              options={[{ value:"pdf", label:"PDF" }, { value:"xlsx", label:"Excel" }]}
              value={format}
              onChange={e => setFormat(e.target.value as "pdf" | "xlsx")}
              className="w-28"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Locataire <span className="text-muted-foreground">(rapport charges)</span></Label>
            <NativeSelect
              options={[
                { value: "", label: "Sélectionner un locataire" },
                ...tenants.map(t => ({ value: t.id, label: t.name })),
              ]}
              value={tenantId}
              onChange={e => setTenantId(e.target.value)}
              className="w-56"
            />
          </div>
        </CardContent>
      </Card>

      {/* Grilles par catégorie */}
      {CATEGORIES.map(cat => (
        <section key={cat.label} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {cat.label}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cat.reports.map(type => {
              const report = byType[type];
              if (!report) return null;
              return (
                <ReportCard
                  key={type}
                  report={report}
                  year={year}
                  tenantId={tenantId}
                  format={format}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
