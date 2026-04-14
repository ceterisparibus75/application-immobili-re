import {
  ChevronDown,
  FileText,
  Home,
  Landmark,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function Row({
  label,
  value,
  badge,
}: {
  label: string;
  value: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-gray-50/80">
      <span className="text-sm text-[var(--color-brand-deep)]">{label}</span>
      <div className="flex items-center gap-2">
        {typeof value === "string" || typeof value === "number" ? (
          <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">
            {value}
          </span>
        ) : (
          value
        )}
        {badge}
      </div>
    </div>
  );
}

function Badge({
  level,
  label,
}: {
  level: "positive" | "caution" | "negative";
  label: string;
}) {
  const styles: Record<typeof level, string> = {
    positive:
      "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]",
    caution:
      "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]",
    negative:
      "bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]",
  };
  return (
    <span
      className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${styles[level]}`}
    >
      {label}
    </span>
  );
}

function Section({
  icon,
  title,
  collapsedSummary,
  hasAlert = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  collapsedSummary: string;
  hasAlert?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open
      className="group border-t border-gray-100 first:border-t-0 pt-3 first:pt-0"
    >
      <summary className="flex items-center justify-between cursor-pointer list-none select-none rounded px-0.5 py-1 -mx-0.5 hover:bg-gray-50/60 transition-colors">
        <div className="flex items-center gap-2">
          <h4
            className="text-[11px] font-semibold uppercase tracking-[0.1em] flex items-center gap-1.5"
            style={{ color: "var(--color-brand-blue)" }}
          >
            {icon} {title}
          </h4>
          {hasAlert && (
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ background: "var(--color-status-caution)" }}
            />
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Texte résumé visible uniquement quand la section est fermée */}
          <span className="text-[10px] text-muted-foreground group-open:hidden">
            {collapsedSummary}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 group-open:rotate-180" />
        </div>
      </summary>
      <div className="mt-2 space-y-1.5">{children}</div>
    </details>
  );
}

export type TrackingKpis = {
  totalBuildings: number;
  occupiedLots: number;
  vacantLots: number;
  occupancyRate: number;
  patrimonyValue: number;
  grossYield: number | null;
  totalTenants: number;
  activeLeaseCount: number;
  expiringLeaseCount: number;
  monthlyRentHT: number;
  unpaidInvoiceCount: number;
  totalOverdueAmount: number;
  recoverableCharges: number;
  availableCash: number;
  expiringDiagnosticCount: number;
  openMaintenanceCount: number;
  activeLoanCount: number;
  totalDebt: number;
  monthlyLoanPayment: number;
  ltv: number | null;
};

export function TrackingPanel({ kpis }: { kpis: TrackingKpis }) {
  return (
    <Card className="border-0 shadow-brand bg-white rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle
          className="text-base font-semibold"
          style={{ color: "var(--color-brand-deep)" }}
        >
          Suivi
        </CardTitle>
        <CardDescription>Vue complète de votre activité</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Patrimoine */}
        <Section
          icon={<Home className="h-3 w-3" />}
          title="Patrimoine"
          collapsedSummary={`${kpis.totalBuildings} imm. · ${kpis.occupancyRate}%`}
          hasAlert={kpis.vacantLots > 2}
        >
          <Row label="Immeubles" value={kpis.totalBuildings} />
          <Row
            label="Lots (occupés / vacants)"
            value={`${kpis.occupiedLots} / ${kpis.vacantLots}`}
            badge={
              <Badge
                level={
                  kpis.vacantLots === 0
                    ? "positive"
                    : kpis.vacantLots <= 2
                      ? "caution"
                      : "negative"
                }
                label={
                  kpis.vacantLots === 0
                    ? "Complet"
                    : `${kpis.vacantLots} vacant${kpis.vacantLots > 1 ? "s" : ""}`
                }
              />
            }
          />
          <Row
            label="Taux d'occupation"
            value={`${kpis.occupancyRate}%`}
            badge={
              <Badge
                level={
                  kpis.occupancyRate >= 80
                    ? "positive"
                    : kpis.occupancyRate >= 50
                      ? "caution"
                      : "negative"
                }
                label={
                  kpis.occupancyRate >= 80
                    ? "Bon"
                    : kpis.occupancyRate >= 50
                      ? "Moyen"
                      : "Faible"
                }
              />
            }
          />
          {kpis.patrimonyValue > 0 && (
            <Row label="Valeur patrimoine" value={fmt(kpis.patrimonyValue)} />
          )}
          {kpis.grossYield !== null && (
            <Row
              label="Rendement brut"
              value={`${kpis.grossYield.toFixed(1)}%`}
              badge={
                <Badge
                  level={
                    kpis.grossYield >= 5
                      ? "positive"
                      : kpis.grossYield >= 3
                        ? "caution"
                        : "negative"
                  }
                  label={
                    kpis.grossYield >= 5
                      ? "Bon"
                      : kpis.grossYield >= 3
                        ? "Moyen"
                        : "Faible"
                  }
                />
              }
            />
          )}
        </Section>

        {/* Locataires & Baux */}
        <Section
          icon={<Users className="h-3 w-3" />}
          title="Locataires & Baux"
          collapsedSummary={`${kpis.totalTenants} locataires · ${kpis.activeLeaseCount} baux`}
          hasAlert={kpis.expiringLeaseCount > 0}
        >
          <Row label="Locataires actifs" value={kpis.totalTenants} />
          <Row label="Baux en cours" value={kpis.activeLeaseCount} />
          <Row
            label="Baux expirant sous 90j"
            value={kpis.expiringLeaseCount}
            badge={
              kpis.expiringLeaseCount > 0 ? (
                <Badge level="caution" label="Attention" />
              ) : undefined
            }
          />
        </Section>

        {/* Facturation */}
        <Section
          icon={<FileText className="h-3 w-3" />}
          title="Facturation"
          collapsedSummary={`${fmt(kpis.monthlyRentHT)}/mois`}
          hasAlert={kpis.unpaidInvoiceCount > 0}
        >
          <Row label="Loyers mensuels HT" value={fmt(kpis.monthlyRentHT)} />
          <Row
            label="Factures impayées"
            value={kpis.unpaidInvoiceCount}
            badge={
              kpis.unpaidInvoiceCount > 0 ? (
                <Badge level="negative" label={String(kpis.unpaidInvoiceCount)} />
              ) : undefined
            }
          />
          <Row
            label="Montant impayé"
            value={
              <span
                className="text-sm font-semibold tabular-nums"
                style={{
                  color:
                    kpis.totalOverdueAmount > 0
                      ? "var(--color-status-negative)"
                      : "var(--color-brand-deep)",
                }}
              >
                {fmt(kpis.totalOverdueAmount)}
              </span>
            }
          />
          <Row label="Charges récup." value={fmt(kpis.recoverableCharges)} />
        </Section>

        {/* Trésorerie */}
        <Section
          icon={<Wallet className="h-3 w-3" />}
          title="Trésorerie"
          collapsedSummary={fmt(kpis.availableCash)}
          hasAlert={kpis.availableCash < 0}
        >
          <Row
            label="Solde disponible"
            value={
              <span
                className="text-sm font-semibold tabular-nums"
                style={{
                  color:
                    kpis.availableCash >= 0
                      ? "var(--color-brand-deep)"
                      : "var(--color-status-negative)",
                }}
              >
                {fmt(kpis.availableCash)}
              </span>
            }
            badge={
              <Badge
                level={kpis.availableCash >= 0 ? "positive" : "negative"}
                label={kpis.availableCash >= 0 ? "OK" : "Négatif"}
              />
            }
          />
        </Section>

        {/* Technique — uniquement si alertes */}
        {(kpis.expiringDiagnosticCount > 0 || kpis.openMaintenanceCount > 0) && (
          <Section
            icon={<Wrench className="h-3 w-3" />}
            title="Technique"
            collapsedSummary={`${kpis.expiringDiagnosticCount + kpis.openMaintenanceCount} alerte${kpis.expiringDiagnosticCount + kpis.openMaintenanceCount > 1 ? "s" : ""}`}
            hasAlert
          >
            {kpis.expiringDiagnosticCount > 0 && (
              <Row
                label="Diagnostics expirant 90j"
                value={kpis.expiringDiagnosticCount}
                badge={<Badge level="caution" label="Attention" />}
              />
            )}
            {kpis.openMaintenanceCount > 0 && (
              <Row
                label="Maintenances en cours"
                value={kpis.openMaintenanceCount}
              />
            )}
          </Section>
        )}

        {/* Endettement */}
        {kpis.activeLoanCount > 0 && (
          <Section
            icon={<Landmark className="h-3 w-3" />}
            title="Endettement"
            collapsedSummary={`${fmt(kpis.totalDebt)} restant`}
          >
            <Row
              label="Capital restant dû"
              value={
                <span
                  className="text-sm font-semibold tabular-nums"
                  style={{ color: "var(--color-status-negative)" }}
                >
                  {fmt(kpis.totalDebt)}
                </span>
              }
            />
            <Row
              label="Mensualité totale"
              value={fmt(kpis.monthlyLoanPayment)}
            />
            <Row label="Emprunts actifs" value={kpis.activeLoanCount} />
            {kpis.ltv !== null && (
              <Row
                label="LTV"
                value={
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{
                      color:
                        kpis.ltv > 80
                          ? "var(--color-status-negative)"
                          : kpis.ltv > 60
                            ? "var(--color-status-caution)"
                            : "var(--color-status-positive)",
                    }}
                  >
                    {kpis.ltv}%
                  </span>
                }
                badge={
                  <Badge
                    level={
                      kpis.ltv > 80 ? "negative" : kpis.ltv > 60 ? "caution" : "positive"
                    }
                    label={
                      kpis.ltv > 80 ? "Élevé" : kpis.ltv > 60 ? "Moyen" : "Sain"
                    }
                  />
                }
              />
            )}
          </Section>
        )}
      </CardContent>
    </Card>
  );
}
