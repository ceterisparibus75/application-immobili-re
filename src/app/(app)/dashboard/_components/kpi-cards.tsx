import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Calendar,
  Home,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

type KpiCardProps = {
  href: string;
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  borderColor: string;
  sub: React.ReactNode;
  trend?: number;
};

function KpiCard({ href, label, value, icon, iconBg, borderColor, sub, trend }: KpiCardProps) {
  return (
    <Link href={href} className="block group">
      <div
        className="bg-white rounded-xl p-5 shadow-brand hover:shadow-brand-lg transition-shadow border-l-4"
        style={{ borderLeftColor: borderColor }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: iconBg }}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.09em]">
              {label}
            </p>
            <p className="text-[26px] font-bold tabular-nums text-[var(--color-brand-deep)] leading-tight mt-0.5">
              {value}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {trend !== undefined &&
                (trend >= 0 ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--color-status-positive)] bg-[var(--color-status-positive-bg)] px-1.5 py-0.5 rounded-full">
                    <ArrowUp className="h-3 w-3" />+{trend}%
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--color-status-negative)] bg-[var(--color-status-negative-bg)] px-1.5 py-0.5 rounded-full">
                    <ArrowDown className="h-3 w-3" />
                    {trend}%
                  </span>
                ))}
              {sub}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/25 group-hover:text-muted-foreground/60 group-hover:translate-x-0.5 transition-all mt-1 shrink-0" />
        </div>
      </div>
    </Link>
  );
}

type KpiData = {
  currentMonthRevenue: number;
  revenueChange: number;
  occupancyRate: number;
  vacantLots: number;
  occupiedLots: number;
  totalOverdueAmount: number;
  unpaidInvoiceCount: number;
  grossYield: number | null;
  availableCash: number;
  expiringLeaseCount: number;
};

export function KpiCards({ kpis }: { kpis: KpiData }) {
  const hasOverdue = kpis.totalOverdueAmount > 0;
  const occupancyOk = kpis.occupancyRate >= 80;
  const totalLots = kpis.occupiedLots + kpis.vacantLots;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Revenus du mois */}
      <KpiCard
        href="/facturation"
        label="Revenus du mois"
        value={fmt(kpis.currentMonthRevenue)}
        icon={<TrendingUp className="h-5 w-5" style={{ color: "var(--color-brand-cyan)" }} />}
        iconBg="color-mix(in oklab, var(--color-brand-cyan) 12%, transparent)"
        borderColor="var(--color-brand-cyan)"
        trend={kpis.revenueChange}
        sub={<span className="text-[10px] text-muted-foreground">vs mois dernier</span>}
      />

      {/* Occupation */}
      <KpiCard
        href="/patrimoine"
        label="Occupation"
        value={`${kpis.occupancyRate}\u00a0%`}
        icon={
          <Home
            className="h-5 w-5"
            style={{
              color: occupancyOk
                ? "var(--color-status-positive)"
                : "var(--color-status-caution)",
            }}
          />
        }
        iconBg={
          occupancyOk
            ? "var(--color-status-positive-bg)"
            : "var(--color-status-caution-bg)"
        }
        borderColor={
          occupancyOk
            ? "var(--color-status-positive)"
            : "var(--color-status-caution)"
        }
        sub={
          <span className="text-[10px] text-muted-foreground">
            {kpis.vacantLots > 0
              ? `${kpis.vacantLots} lot${kpis.vacantLots > 1 ? "s" : ""} vacant${kpis.vacantLots > 1 ? "s" : ""} / ${totalLots}`
              : `${totalLots} lot${totalLots > 1 ? "s" : ""} — complet`}
          </span>
        }
      />

      {/* Impayés */}
      <KpiCard
        href="/facturation"
        label="Impayés"
        value={fmt(kpis.totalOverdueAmount)}
        icon={
          <AlertTriangle
            className="h-5 w-5"
            style={{
              color: hasOverdue
                ? "var(--color-status-negative)"
                : "var(--color-status-positive)",
            }}
          />
        }
        iconBg={
          hasOverdue
            ? "var(--color-status-negative-bg)"
            : "var(--color-status-positive-bg)"
        }
        borderColor={
          hasOverdue
            ? "var(--color-status-negative)"
            : "var(--color-status-positive)"
        }
        sub={
          kpis.unpaidInvoiceCount > 0 ? (
            <span
              className="inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                color: "var(--color-status-negative)",
                background: "var(--color-status-negative-bg)",
              }}
            >
              {kpis.unpaidInvoiceCount} facture{kpis.unpaidInvoiceCount > 1 ? "s" : ""}
            </span>
          ) : (
            <span
              className="inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                color: "var(--color-status-positive)",
                background: "var(--color-status-positive-bg)",
              }}
            >
              Aucun impayé
            </span>
          )
        }
      />

      {/* Rendement / Trésorerie */}
      <KpiCard
        href={kpis.grossYield !== null ? "/patrimoine/evaluations" : "/banque"}
        label={kpis.grossYield !== null ? "Rendement brut" : "Trésorerie"}
        value={
          kpis.grossYield !== null
            ? `${kpis.grossYield.toFixed(1)}\u00a0%`
            : fmt(kpis.availableCash)
        }
        icon={<Wallet className="h-5 w-5" style={{ color: "var(--color-brand-blue)" }} />}
        iconBg="var(--color-brand-light)"
        borderColor={
          kpis.expiringLeaseCount > 0
            ? "var(--color-status-caution)"
            : "var(--color-brand-blue)"
        }
        sub={
          kpis.expiringLeaseCount > 0 ? (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                color: "var(--color-status-caution)",
                background: "var(--color-status-caution-bg)",
              }}
            >
              <Calendar className="h-3 w-3" />
              {kpis.expiringLeaseCount} bail
              {kpis.expiringLeaseCount > 1 ? "x" : ""} expire bientôt
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">aucun bail expirant</span>
          )
        }
      />
    </div>
  );
}
