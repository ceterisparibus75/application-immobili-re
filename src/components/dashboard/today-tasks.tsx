import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Calendar, FileWarning, CheckSquare, TrendingUp, ArrowRight } from "lucide-react";

async function getTodayTasks(societyId: string | string[]) {
  const now = new Date();
  const in30days = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  const in90days = new Date(now.getTime() + 90 * 24 * 3600 * 1000);
  const ago30days = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  const societyFilter = Array.isArray(societyId) ? { in: societyId } : societyId;

  const [expiringDiagnostics, expiringLeases, overdueInvoices, pendingRevisions] = await Promise.all([
    prisma.diagnostic.findMany({
      where: {
        building: { societyId: societyFilter },
        expiresAt: { gte: now, lte: in30days },
      },
      select: {
        id: true,
        type: true,
        expiresAt: true,
        building: { select: { id: true, name: true } },
      },
      orderBy: { expiresAt: "asc" },
      take: 5,
    }),
    prisma.lease.findMany({
      where: {
        societyId: societyFilter,
        status: "EN_COURS",
        endDate: { gte: now, lte: in90days },
      },
      select: {
        id: true,
        endDate: true,
        lot: { select: { number: true, building: { select: { name: true } } } },
        tenant: { select: { firstName: true, lastName: true, companyName: true, entityType: true } },
      },
      orderBy: { endDate: "asc" },
      take: 5,
    }),
    prisma.invoice.findMany({
      where: {
        societyId: societyFilter,
        status: { in: ["EN_RETARD", "PARTIELLEMENT_PAYE"] },
        dueDate: { lt: ago30days },
      },
      select: {
        id: true,
        invoiceNumber: true,
        totalTTC: true,
        dueDate: true,
        lease: {
          select: {
            tenant: { select: { firstName: true, lastName: true, companyName: true, entityType: true } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.rentRevision.findMany({
      where: {
        lease: { societyId: societyFilter, status: "EN_COURS" },
        isValidated: false,
        effectiveDate: { lte: in30days },
      },
      select: {
        id: true,
        effectiveDate: true,
        newRentHT: true,
        lease: {
          select: {
            id: true,
            tenant: { select: { firstName: true, lastName: true, companyName: true, entityType: true } },
          },
        },
      },
      orderBy: { effectiveDate: "asc" },
      take: 5,
    }),
  ]);

  return { expiringDiagnostics, expiringLeases, overdueInvoices, pendingRevisions };
}

function tenantName(tenant: { entityType: string; companyName: string | null; firstName: string | null; lastName: string | null } | null) {
  if (!tenant) return "\u2014";
  if (tenant.entityType === "PERSONNE_MORALE") return tenant.companyName ?? "\u2014";
  return `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "\u2014";
}

const _now = Date.now();

function daysUntil(date: Date) {
  return Math.ceil((new Date(date).getTime() - _now) / 86400000);
}

function daysOver(date: Date) {
  return Math.floor((_now - new Date(date).getTime()) / 86400000);
}

function fmt(v: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1 pt-2 pb-1 flex items-center justify-between">
      {label}
      <span className="text-[10px] font-medium normal-case">{count}</span>
    </p>
  );
}

// ─── Composant ────────────────────────────────────────────────────────────────

export async function TodayTasks({ societyId, societyIds }: { societyId?: string; societyIds?: string[] }) {
  const idParam = societyIds ?? societyId ?? "";
  if (!idParam || (Array.isArray(idParam) && idParam.length === 0)) return null;
  const { expiringDiagnostics, expiringLeases, overdueInvoices, pendingRevisions } = await getTodayTasks(idParam);

  const totalTasks = expiringDiagnostics.length + expiringLeases.length + overdueInvoices.length + pendingRevisions.length;

  if (totalTasks === 0) return null;

  return (
    <Card className="border-0 shadow-brand bg-white rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-[var(--color-brand-deep)]">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-status-caution-bg)]">
            <CheckSquare className="h-4 w-4 text-[var(--color-status-caution)]" />
          </div>
          À traiter
          <span className="ml-auto inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]">
            {totalTasks}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5">

        {/* ── Impayés > 30j ── */}
        {overdueInvoices.length > 0 && (
          <>
            <SectionLabel label="Impayés anciens" count={overdueInvoices.length} />
            {overdueInvoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/facturation/${inv.id}`}
                className="flex items-center gap-3 text-sm hover:bg-gray-50 rounded-lg p-2.5 -mx-1 transition-colors group"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-status-negative-bg)]">
                  <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-status-negative)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-[#0C2340]">{tenantName(inv.lease?.tenant ?? null)}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.invoiceNumber} · {fmt(inv.totalTTC)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]">
                    J+{daysOver(inv.dueDate)}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </>
        )}

        {/* ── Révisions à valider ── */}
        {pendingRevisions.length > 0 && (
          <>
            <SectionLabel label="Révisions à valider" count={pendingRevisions.length} />
            {pendingRevisions.map((r) => {
              const days = daysUntil(r.effectiveDate);
              const isPast = days < 0;
              return (
                <Link
                  key={r.id}
                  href={`/baux/${r.lease.id}#loyer`}
                  className="flex items-center gap-3 text-sm hover:bg-gray-50 rounded-lg p-2.5 -mx-1 transition-colors group"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-50">
                    <TrendingUp className="h-3.5 w-3.5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-[#0C2340]">{tenantName(r.lease.tenant)}</p>
                    <p className="text-xs text-muted-foreground">
                      Nouveau loyer : {fmt(r.newRentHT)} HT · {isPast ? "depuis le" : "le"} {new Date(r.effectiveDate).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${isPast ? "bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]" : "bg-purple-50 text-purple-600"}`}>
                      {isPast ? `J+${Math.abs(days)}` : `J-${days}`}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              );
            })}
          </>
        )}

        {/* ── Baux à renouveler ── */}
        {expiringLeases.length > 0 && (
          <>
            <SectionLabel label="Baux à renouveler" count={expiringLeases.length} />
            {expiringLeases.map((l) => (
              <Link
                key={l.id}
                href={`/baux/${l.id}`}
                className="flex items-center gap-3 text-sm hover:bg-gray-50 rounded-lg p-2.5 -mx-1 transition-colors group"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F0F9FF]">
                  <Calendar className="h-3.5 w-3.5 text-[#1B4F8A]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-[#0C2340]">{tenantName(l.tenant)}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.lot?.building?.name ?? ""} · Lot {l.lot?.number} · Fin {new Date(l.endDate).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${daysUntil(l.endDate) <= 30 ? "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]" : "bg-[#F0F9FF] text-[#1B4F8A]"}`}>
                    J-{daysUntil(l.endDate)}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </>
        )}

        {/* ── Diagnostics ── */}
        {expiringDiagnostics.length > 0 && (
          <>
            <SectionLabel label="Diagnostics à renouveler" count={expiringDiagnostics.length} />
            {expiringDiagnostics.map((d) => (
              <Link
                key={d.id}
                href={`/patrimoine/immeubles/${d.building.id}`}
                className="flex items-center gap-3 text-sm hover:bg-gray-50 rounded-lg p-2.5 -mx-1 transition-colors group"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-status-caution-bg)]">
                  <FileWarning className="h-3.5 w-3.5 text-[var(--color-status-caution)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-[#0C2340]">Diagnostic {d.type}</p>
                  <p className="text-xs text-muted-foreground">{d.building.name} · dans {daysUntil(d.expiresAt!)} jour{daysUntil(d.expiresAt!) > 1 ? "s" : ""}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]">
                    J-{daysUntil(d.expiresAt!)}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </>
        )}

      </CardContent>
    </Card>
  );
}
