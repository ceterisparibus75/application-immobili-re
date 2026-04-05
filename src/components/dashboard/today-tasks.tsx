import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Calendar, FileWarning, CheckSquare } from "lucide-react";

async function getTodayTasks(societyId: string) {
  const now = new Date();
  const in30days = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  const in90days = new Date(now.getTime() + 90 * 24 * 3600 * 1000);
  const ago30days = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  const [expiringDiagnostics, expiringLeases, overdueInvoices] = await Promise.all([
    prisma.diagnostic.findMany({
      where: {
        building: { societyId },
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
        societyId,
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
            tenant: { select: { firstName: true, lastName: true, companyName: true, entityType: true } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
  ]);

  return { expiringDiagnostics, expiringLeases, overdueInvoices };
}

function tenantName(tenant: { entityType: string; companyName: string | null; firstName: string | null; lastName: string | null } | null) {
  if (!tenant) return "\u2014";
  if (tenant.entityType === "PERSONNE_MORALE") return tenant.companyName ?? "\u2014";
  return `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "\u2014";
}

function daysUntil(date: Date) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function daysOver(date: Date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

export async function TodayTasks({ societyId }: { societyId: string }) {
  const { expiringDiagnostics, expiringLeases, overdueInvoices } = await getTodayTasks(societyId);

  const totalTasks = expiringDiagnostics.length + expiringLeases.length + overdueInvoices.length;

  if (totalTasks === 0) return null;

  return (
    <Card className="border-0 shadow-brand bg-white rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-[var(--color-brand-deep)]">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
            <CheckSquare className="h-4 w-4 text-amber-600" />
          </div>
          À traiter
          <span className="ml-auto inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">{totalTasks}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Diagnostics expirant */}
        {expiringDiagnostics.map((d) => (
          <Link
            key={d.id}
            href={`/patrimoine/immeubles/${d.building.id}`}
            className="flex items-center gap-3 text-sm hover:bg-gray-50 rounded-lg p-2.5 -mx-1 transition-colors group"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50">
              <FileWarning className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate text-[#0C2340]">Diagnostic {d.type} — {d.building.name}</p>
              <p className="text-xs text-muted-foreground">Expire dans {daysUntil(d.expiresAt!)} jour{daysUntil(d.expiresAt!) > 1 ? "s" : ""}</p>
            </div>
            <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 shrink-0">J-{daysUntil(d.expiresAt!)}</span>
          </Link>
        ))}

        {/* Baux arrivant à échéance */}
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
              <p className="font-medium truncate text-[#0C2340]">Bail — {tenantName(l.tenant)}</p>
              <p className="text-xs text-muted-foreground">
                {l.lot?.building?.name ?? ""} · Fin le {new Date(l.endDate).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F0F9FF] text-[#1B4F8A] shrink-0">J-{daysUntil(l.endDate)}</span>
          </Link>
        ))}

        {/* Impayés > 30j */}
        {overdueInvoices.map((inv) => (
          <Link
            key={inv.id}
            href={`/facturation/${inv.id}`}
            className="flex items-center gap-3 text-sm hover:bg-gray-50 rounded-lg p-2.5 -mx-1 transition-colors group"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-50">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate text-[#0C2340]">Impayé — {tenantName(inv.lease?.tenant ?? null)}</p>
              <p className="text-xs text-muted-foreground">
                {inv.invoiceNumber} · {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(inv.totalTTC)}
              </p>
            </div>
            <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-500 shrink-0">J+{daysOver(inv.dueDate)}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
