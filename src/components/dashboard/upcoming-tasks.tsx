import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  FileWarning,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";

type UpcomingTasksData = {
  expiringLeases: Array<{
    id: string;
    endDate: Date;
    tenant: { entityType: string; companyName: string | null; firstName: string | null; lastName: string | null };
    lot: { number: string; building: { name: string } };
  }>;
  pendingRevisions: Array<{
    id: string;
    effectiveDate: Date;
    previousRentHT: number;
    newRentHT: number;
    lease: {
      id: string;
      tenant: { entityType: string; companyName: string | null; firstName: string | null; lastName: string | null };
    };
  }>;
  expiringDiagnostics: Array<{
    id: string;
    type: string;
    expiresAt: Date | null;
    building: { id: string; name: string };
  }>;
  missingInsurance: Array<{
    id: string;
    entityType: string;
    companyName: string | null;
    firstName: string | null;
    lastName: string | null;
    insuranceExpiresAt: Date | null;
  }>;
  overdueInvoices: Array<{
    id: string;
    invoiceNumber: string;
    totalTTC: number;
    dueDate: Date;
    lease: {
      tenant: { entityType: string; companyName: string | null; firstName: string | null; lastName: string | null };
    } | null;
  }>;
};

async function getUpcomingTasks(societyId: string): Promise<UpcomingTasksData> {
  const now = new Date();
  const in90days = new Date(now.getTime() + 90 * 24 * 3600 * 1000);
  const ago30days = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  const [expiringLeases, pendingRevisions, expiringDiagnostics, missingInsurance, overdueInvoices] =
    await Promise.all([
      prisma.lease.findMany({
        where: {
          societyId,
          status: "EN_COURS",
          endDate: { gte: now, lte: in90days },
        },
        select: {
          id: true,
          endDate: true,
          tenant: { select: { entityType: true, companyName: true, firstName: true, lastName: true } },
          lot: { select: { number: true, building: { select: { name: true } } } },
        },
        orderBy: { endDate: "asc" },
        take: 5,
      }),
      prisma.rentRevision.findMany({
        where: {
          isValidated: false,
          lease: { societyId, status: "EN_COURS" },
        },
        select: {
          id: true,
          effectiveDate: true,
          previousRentHT: true,
          newRentHT: true,
          lease: {
            select: {
              id: true,
              tenant: { select: { entityType: true, companyName: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { effectiveDate: "asc" },
        take: 5,
      }),
      prisma.diagnostic.findMany({
        where: {
          building: { societyId },
          expiresAt: { not: null, gte: now, lte: in90days },
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
      prisma.tenant.findMany({
        where: {
          societyId,
          isActive: true,
          OR: [
            { insuranceExpiresAt: null },
            { insuranceExpiresAt: { lt: now } },
          ],
        },
        select: {
          id: true,
          entityType: true,
          companyName: true,
          firstName: true,
          lastName: true,
          insuranceExpiresAt: true,
        },
        take: 5,
      }),
      prisma.invoice.findMany({
        where: {
          societyId,
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
              tenant: { select: { entityType: true, companyName: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
      }),
    ]);

  return { expiringLeases, pendingRevisions, expiringDiagnostics, missingInsurance, overdueInvoices };
}

function tenantName(tenant: {
  entityType: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
} | null): string {
  if (!tenant) return "\u2014";
  if (tenant.entityType === "PERSONNE_MORALE") return tenant.companyName ?? "\u2014";
  return `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "\u2014";
}

function daysUntil(date: Date): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function daysOver(date: Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

function fmtDate(date: Date): string {
  return new Date(date).toLocaleDateString("fr-FR");
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

type CategoryProps = {
  icon: React.ReactNode;
  label: string;
  count: number;
  children: React.ReactNode;
};

function TaskCategory({ icon, label, count, children }: CategoryProps) {
  if (count === 0) return null;

  return (
    <details className="group">
      <summary className="flex items-center gap-3 cursor-pointer select-none list-none py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors [&::-webkit-details-marker]:hidden">
        {icon}
        <span className="flex-1 text-sm font-medium text-[var(--color-brand-deep)]">{label}</span>
        <Badge variant="secondary" className="text-[10px] font-semibold tabular-nums">
          {count}
        </Badge>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="pl-3 space-y-1 pb-2">{children}</div>
    </details>
  );
}

export async function UpcomingTasks({ societyId }: { societyId: string }) {
  const data = await getUpcomingTasks(societyId);

  const totalCount =
    data.expiringLeases.length +
    data.pendingRevisions.length +
    data.expiringDiagnostics.length +
    data.missingInsurance.length +
    data.overdueInvoices.length;

  if (totalCount === 0) return null;

  return (
    <Card className="border-0 shadow-brand bg-white rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-[var(--color-brand-deep)]">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F0F9FF]">
            <Calendar className="h-4 w-4 text-[#1B4F8A]" />
          </div>
          T&acirc;ches &agrave; venir
          <span className="ml-auto inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F0F9FF] text-[#1B4F8A]">
            {totalCount}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {/* Echeances de bail */}
        <TaskCategory
          icon={
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F0F9FF]">
              <Calendar className="h-3.5 w-3.5 text-[#1B4F8A]" />
            </div>
          }
          label="Ech&eacute;ances de bail"
          count={data.expiringLeases.length}
        >
          {data.expiringLeases.map((l) => (
            <Link
              key={l.id}
              href={`/baux/${l.id}`}
              className="flex items-center gap-3 text-sm hover:bg-gray-50 rounded-lg p-2 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-[#0C2340]">{tenantName(l.tenant)}</p>
                <p className="text-xs text-muted-foreground">
                  {l.lot?.building?.name} Lot {l.lot?.number} &middot; Fin le {fmtDate(l.endDate)}
                </p>
              </div>
              <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F0F9FF] text-[#1B4F8A] shrink-0">
                J-{daysUntil(l.endDate)}
              </span>
            </Link>
          ))}
        </TaskCategory>

        {/* Revisions en attente */}
        <TaskCategory
          icon={
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-status-caution-bg)]">
              <RefreshCw className="h-3.5 w-3.5 text-[var(--color-status-caution)]" />
            </div>
          }
          label="R&eacute;visions en attente"
          count={data.pendingRevisions.length}
        >
          {data.pendingRevisions.map((r) => (
            <Link
              key={r.id}
              href={`/baux/${r.lease.id}`}
              className="flex items-center gap-3 text-sm hover:bg-gray-50 rounded-lg p-2 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-[#0C2340]">{tenantName(r.lease.tenant)}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtCurrency(r.previousRentHT)} &rarr; {fmtCurrency(r.newRentHT)} &middot; Effet le{" "}
                  {fmtDate(r.effectiveDate)}
                </p>
              </div>
            </Link>
          ))}
        </TaskCategory>

        {/* Diagnostics expirant */}
        <TaskCategory
          icon={
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-status-caution-bg)]">
              <FileWarning className="h-3.5 w-3.5 text-[var(--color-status-caution)]" />
            </div>
          }
          label="Diagnostics expirant"
          count={data.expiringDiagnostics.length}
        >
          {data.expiringDiagnostics.map((d) => (
            <Link
              key={d.id}
              href={`/patrimoine/immeubles/${d.building.id}/diagnostics`}
              className="flex items-center gap-3 text-sm hover:bg-gray-50 rounded-lg p-2 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-[#0C2340]">
                  {d.type} &mdash; {d.building.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Expire le {fmtDate(d.expiresAt!)}
                </p>
              </div>
              <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)] shrink-0">
                J-{daysUntil(d.expiresAt!)}
              </span>
            </Link>
          ))}
        </TaskCategory>

        {/* Assurances manquantes */}
        <TaskCategory
          icon={
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-status-negative-bg)]">
              <ShieldAlert className="h-3.5 w-3.5 text-[var(--color-status-negative)]" />
            </div>
          }
          label="Assurances manquantes"
          count={data.missingInsurance.length}
        >
          {data.missingInsurance.map((t) => (
            <Link
              key={t.id}
              href={`/locataires/${t.id}`}
              className="flex items-center gap-3 text-sm hover:bg-gray-50 rounded-lg p-2 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-[#0C2340]">{tenantName(t)}</p>
                <p className="text-xs text-muted-foreground">
                  {t.insuranceExpiresAt
                    ? `Expir\u00e9e le ${fmtDate(t.insuranceExpiresAt)}`
                    : "Aucune assurance renseign\u00e9e"}
                </p>
              </div>
            </Link>
          ))}
        </TaskCategory>

        {/* Factures en retard > 30j */}
        <TaskCategory
          icon={
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-status-negative-bg)]">
              <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-status-negative)]" />
            </div>
          }
          label="Factures en retard (+30j)"
          count={data.overdueInvoices.length}
        >
          {data.overdueInvoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/facturation/${inv.id}`}
              className="flex items-center gap-3 text-sm hover:bg-gray-50 rounded-lg p-2 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-[#0C2340]">
                  {inv.invoiceNumber} &mdash; {tenantName(inv.lease?.tenant ?? null)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmtCurrency(inv.totalTTC)} &middot; Due le {fmtDate(inv.dueDate)}
                </p>
              </div>
              <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)] shrink-0">
                J+{daysOver(inv.dueDate)}
              </span>
            </Link>
          ))}
        </TaskCategory>
      </CardContent>
    </Card>
  );
}
