import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getHealthChecks, type HealthCategory, type HealthCheckItem, type HealthSeverity } from "@/actions/health-check";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Stethoscope,
  ArrowRight,
  ShieldAlert,
  Landmark,
  FileText,
  Database,
  Mail,
} from "lucide-react";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Diagnostic santé des données" };
export const dynamic = "force-dynamic";

const CATEGORY_META: Record<
  HealthCategory,
  { label: string; icon: typeof AlertTriangle; color: string }
> = {
  compta: { label: "Comptabilité", icon: FileText, color: "text-blue-600" },
  juridique: { label: "Juridique / Baux", icon: ShieldAlert, color: "text-violet-600" },
  banque: { label: "Banque", icon: Landmark, color: "text-emerald-600" },
  donnees: { label: "Données", icon: Database, color: "text-amber-600" },
  communication: { label: "Communication", icon: Mail, color: "text-cyan-600" },
};

const SEVERITY_META: Record<
  HealthSeverity,
  { label: string; badgeVariant: "destructive" | "warning" | "secondary"; iconColor: string }
> = {
  critical: { label: "Critique", badgeVariant: "destructive", iconColor: "text-[var(--color-status-negative)]" },
  warning: { label: "À surveiller", badgeVariant: "warning", iconColor: "text-[var(--color-status-caution)]" },
  info: { label: "Info", badgeVariant: "secondary", iconColor: "text-muted-foreground" },
};

export default async function DiagnosticPage() {
  const h = await headers();
  const societyId = h.get("x-society-id");
  if (!societyId) redirect("/societes");

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-blue)]/10">
          <Stethoscope className="h-5 w-5 text-[var(--color-brand-blue)]" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-brand-deep)]">
            Diagnostic santé des données
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Anomalies latentes détectées sur votre patrimoine, votre facturation et vos flux bancaires.
            Recalculées à chaque chargement.
          </p>
        </div>
      </div>

      <Suspense fallback={<DiagnosticSkeleton />}>
        <DiagnosticContent societyId={societyId} />
      </Suspense>
    </div>
  );
}

async function DiagnosticContent({ societyId }: { societyId: string }) {
  const result = await getHealthChecks(societyId);

  if (!result.success || !result.data) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-destructive">{result.error ?? "Erreur inconnue"}</p>
        </CardContent>
      </Card>
    );
  }

  const { checks, criticalCount, warningCount, infoCount, totalIssues, computedAt } = result.data;

  if (totalIssues === 0) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20">
        <CardContent className="py-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-3" />
          <p className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
            Aucune anomalie détectée
          </p>
          <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
            Vos données sont cohérentes. Ce diagnostic est recalculé automatiquement.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Grouper par catégorie
  const byCategory = new Map<HealthCategory, HealthCheckItem[]>();
  for (const check of checks) {
    const list = byCategory.get(check.category) ?? [];
    list.push(check);
    byCategory.set(check.category, list);
  }
  const orderedCategories: HealthCategory[] = ["compta", "juridique", "banque", "communication", "donnees"];

  return (
    <div className="space-y-6">
      {/* Synthèse */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SynthesisCard
          label="Critique"
          count={criticalCount}
          icon={AlertTriangle}
          tone="critical"
        />
        <SynthesisCard
          label="À surveiller"
          count={warningCount}
          icon={AlertTriangle}
          tone="warning"
        />
        <SynthesisCard
          label="Info"
          count={infoCount}
          icon={Info}
          tone="info"
        />
      </div>

      {/* Sections par catégorie */}
      {orderedCategories.map((cat) => {
        const items = byCategory.get(cat);
        if (!items || items.length === 0) return null;
        const meta = CATEGORY_META[cat];
        const Icon = meta.icon;
        return (
          <Card key={cat}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${meta.color}`} />
                <CardTitle className="text-base">{meta.label}</CardTitle>
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {items.length} contrôle{items.length > 1 ? "s" : ""}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="divide-y">
              {items.map((item) => (
                <HealthCheckRow key={item.key} item={item} />
              ))}
            </CardContent>
          </Card>
        );
      })}

      <p className="text-[11px] text-muted-foreground text-right">
        Calculé le {new Date(computedAt).toLocaleString("fr-FR")}
      </p>
    </div>
  );
}

function SynthesisCard({
  label,
  count,
  icon: Icon,
  tone,
}: {
  label: string;
  count: number;
  icon: typeof AlertTriangle;
  tone: "critical" | "warning" | "info";
}) {
  const styles = {
    critical: {
      border: "border-[var(--color-status-negative)]/25",
      bg: "bg-[var(--color-status-negative-bg)]/40",
      iconColor: "text-[var(--color-status-negative)]",
      count: "text-[var(--color-status-negative)]",
    },
    warning: {
      border: "border-[var(--color-status-caution)]/25",
      bg: "bg-[var(--color-status-caution-bg)]/40",
      iconColor: "text-[var(--color-status-caution)]",
      count: "text-[var(--color-status-caution)]",
    },
    info: {
      border: "border-border/70",
      bg: "bg-card",
      iconColor: "text-muted-foreground",
      count: "text-foreground",
    },
  }[tone];

  return (
    <div className={`rounded-lg border p-4 ${styles.border} ${styles.bg}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${styles.iconColor}`} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className={`text-2xl font-bold tabular-nums ${styles.count}`}>{count}</span>
      </div>
    </div>
  );
}

function HealthCheckRow({ item }: { item: HealthCheckItem }) {
  const severity = SEVERITY_META[item.severity];
  return (
    <div className="py-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{item.title}</p>
          <Badge variant={severity.badgeVariant} className="text-[10px]">
            {severity.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
        {item.preview && item.preview.length > 0 && (
          <ul className="mt-2 space-y-0.5 pl-2 border-l-2 border-muted">
            {item.preview.map((p, i) => (
              <li key={i} className="text-[11px] text-muted-foreground/90 pl-2">
                {p}
              </li>
            ))}
          </ul>
        )}
      </div>
      {item.actionHref && item.actionLabel && (
        <Link href={item.actionHref} className="shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            {item.actionLabel}
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      )}
    </div>
  );
}

function DiagnosticSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
      <Skeleton className="h-32 rounded-lg" />
      <Skeleton className="h-32 rounded-lg" />
    </div>
  );
}
