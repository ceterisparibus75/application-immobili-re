"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────

type ReportType =
  | "SITUATION_LOCATIVE"
  | "COMPTE_RENDU_GESTION"
  | "RENTABILITE_LOT"
  | "ETAT_IMPAYES"
  | "RECAP_CHARGES_LOCATAIRE"
  | "SUIVI_TRAVAUX";

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
    label: "État des impayés",
    description: "Toutes les factures impayées ou en retard avec nombre de jours de retard.",
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

  const actualFormat = report.format === "both" ? format : report.format;

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
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
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: { message?: string } })?.error?.message ?? "Erreur lors de la génération");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const fnMatch = disposition.match(/filename="([^"]+)"/);
      const filename = fnMatch?.[1] ?? `rapport.${actualFormat}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const Icon = actualFormat === "xlsx" ? FileSpreadsheet : FileText;
  const iconColor = actualFormat === "xlsx" ? "text-green-600" : "text-blue-600";

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
          <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">{error}</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${actualFormat === "xlsx" ? "text-green-700 border-green-200 bg-green-50" : "text-blue-700 border-blue-200 bg-blue-50"}`}>
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
    reports: ["SITUATION_LOCATIVE", "RENTABILITE_LOT"] as ReportType[],
  },
  {
    label: "Comptabilité et finances",
    reports: ["COMPTE_RENDU_GESTION", "ETAT_IMPAYES"] as ReportType[],
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

  const byType = Object.fromEntries(REPORTS.map(r => [r.type, r]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rapports</h1>
        <p className="text-muted-foreground">Générez et téléchargez vos rapports PDF et Excel</p>
      </div>

      {/* Paramètres globaux */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Paramètres</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Exercice</Label>
            <Select
              options={YEAR_OPTIONS}
              value={year}
              onChange={e => setYear(e.target.value)}
              className="w-28"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Format (rapports au choix)</Label>
            <Select
              options={[{ value:"pdf", label:"PDF" }, { value:"xlsx", label:"Excel" }]}
              value={format}
              onChange={e => setFormat(e.target.value as "pdf" | "xlsx")}
              className="w-28"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">ID Locataire <span className="text-muted-foreground">(rapport charges)</span></Label>
            <input
              type="text"
              value={tenantId}
              onChange={e => setTenantId(e.target.value)}
              placeholder="cuid du locataire"
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm w-56 focus:outline-none focus:ring-1 focus:ring-ring"
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
