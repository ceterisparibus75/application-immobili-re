import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Calendar, FileWarning, CheckSquare } from "lucide-react";

async function getTodayTasks(societyId: string) {
  const now = new Date();
  const in30days = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  const in90days = new Date(now.getTime() + 90 * 24 * 3600 * 1000);
  const ago30days = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  const [expiringDiagnostics, expiringLeases, overdueInvoices] = await Promise.all([
    // Diagnostics expirant dans les 30 jours
    prisma.diagnostic.findMany({
      where: {
        societyId,
        expiresAt: { gte: now, lte: in30days },
      },
      select: {
        id: true,
        type: true,
        expiresAt: true,
        building: { select: { id: true, name: true } },
        lot: { select: { id: true, number: true } },
      },
      orderBy: { expiresAt: "asc" },
      take: 5,
    }),
    // Baux se terminant dans les 90 jours
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
    // Factures impayées depuis plus de 30 jours
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
  if (!tenant) return "—";
  if (tenant.entityType === "PERSONNE_MORALE") return tenant.companyName ?? "—";
  return `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "—";
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
    <Card className="border-orange-200 bg-orange-50/30 dark:border-orange-900/40 dark:bg-orange-900/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckSquare className="h-4 w-4 text-orange-600" />
          À traiter
          <Badge className="ml-auto bg-orange-100 text-orange-700 border-orange-200 text-xs">{totalTasks}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Diagnostics expirant */}
        {expiringDiagnostics.map((d) => (
          <Link
            key={d.id}
            href={d.building ? `/patrimoine/immeubles/${d.building.id}` : "/patrimoine/immeubles"}
            className="flex items-center gap-3 text-sm hover:bg-orange-100/60 rounded-md p-2 -mx-2 transition-colors group"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
              <FileWarning className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">Diagnostic {d.type} — {d.building?.name ?? d.lot?.number ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Expire dans {daysUntil(d.expiresAt!)} jour{daysUntil(d.expiresAt!) > 1 ? "s" : ""}</p>
            </div>
            <Badge variant="outline" className="text-orange-600 border-orange-300 text-[10px] shrink-0">J-{daysUntil(d.expiresAt!)}</Badge>
          </Link>
        ))}

        {/* Baux arrivant à échéance */}
        {expiringLeases.map((l) => (
          <Link
            key={l.id}
            href={`/baux/${l.id}`}
            className="flex items-center gap-3 text-sm hover:bg-orange-100/60 rounded-md p-2 -mx-2 transition-colors group"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <Calendar className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">Bail — {tenantName(l.tenant)}</p>
              <p className="text-xs text-muted-foreground">
                {l.lot?.building?.name ?? ""} · Fin le {new Date(l.endDate).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <Badge variant="outline" className="text-blue-600 border-blue-300 text-[10px] shrink-0">J-{daysUntil(l.endDate)}</Badge>
          </Link>
        ))}

        {/* Impayés > 30j */}
        {overdueInvoices.map((inv) => (
          <Link
            key={inv.id}
            href={`/facturation/${inv.id}`}
            className="flex items-center gap-3 text-sm hover:bg-orange-100/60 rounded-md p-2 -mx-2 transition-colors group"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">Impayé — {tenantName(inv.lease?.tenant ?? null)}</p>
              <p className="text-xs text-muted-foreground">
                {inv.invoiceNumber} · {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(inv.totalTTC)}
              </p>
            </div>
            <Badge variant="destructive" className="text-[10px] shrink-0">J+{daysOver(inv.dueDate)}</Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
