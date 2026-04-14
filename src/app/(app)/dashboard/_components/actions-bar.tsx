import Link from "next/link";
import { AlertCircle, CheckCircle2, Receipt, TrendingUp } from "lucide-react";

type ActionsBarProps = {
  pendingRevisionCount: number;
  invoicesToIssueCount: number;
  unpaidInvoiceCount: number;
};

type Action = {
  href: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  bg: string;
  border: string;
};

export function ActionsBar({
  pendingRevisionCount,
  invoicesToIssueCount,
  unpaidInvoiceCount,
}: ActionsBarProps) {
  const actions: Action[] = [
    ...(unpaidInvoiceCount > 0
      ? [
          {
            href: "/relances",
            icon: <AlertCircle className="h-3.5 w-3.5 shrink-0" />,
            label: `${unpaidInvoiceCount} facture${unpaidInvoiceCount > 1 ? "s" : ""} impayée${unpaidInvoiceCount > 1 ? "s" : ""}`,
            color: "var(--color-status-negative)",
            bg: "var(--color-status-negative-bg)",
            border: "color-mix(in oklab, var(--color-status-negative) 30%, transparent)",
          },
        ]
      : []),
    ...(pendingRevisionCount > 0
      ? [
          {
            href: "/indices",
            icon: <TrendingUp className="h-3.5 w-3.5 shrink-0" />,
            label: `${pendingRevisionCount} révision${pendingRevisionCount > 1 ? "s" : ""} à traiter`,
            color: "var(--color-status-caution)",
            bg: "var(--color-status-caution-bg)",
            border: "color-mix(in oklab, var(--color-status-caution) 30%, transparent)",
          },
        ]
      : []),
    ...(invoicesToIssueCount > 0
      ? [
          {
            href: "/facturation",
            icon: <Receipt className="h-3.5 w-3.5 shrink-0" />,
            label: `${invoicesToIssueCount} facture${invoicesToIssueCount > 1 ? "s" : ""} à émettre`,
            color: "var(--color-brand-blue)",
            bg: "var(--color-brand-light)",
            border: "color-mix(in oklab, var(--color-brand-blue) 25%, transparent)",
          },
        ]
      : []),
  ];

  if (actions.length === 0) {
    return (
      <div className="flex items-center gap-2 py-0.5">
        <CheckCircle2
          className="h-4 w-4 shrink-0"
          style={{ color: "var(--color-status-positive)" }}
        />
        <span
          className="text-sm font-medium"
          style={{ color: "var(--color-status-positive)" }}
        >
          Tout est à jour — aucune action requise
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.09em]">
        Actions
      </span>
      {actions.map((action, i) => (
        <Link
          key={i}
          href={action.href}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors hover:opacity-80"
          style={{
            color: action.color,
            background: action.bg,
            borderColor: action.border,
          }}
        >
          {action.icon}
          {action.label}
        </Link>
      ))}
    </div>
  );
}
