import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { GestionLocativeNav } from "@/components/layout/gestion-locative-nav";
import { RevisionActions } from "./_components/revision-actions";

export const metadata = { title: "Révisions / Indices" };

const INDEX_INFO: Record<string, { name: string; badge: string }> = {
  IRL: { name: "Indice de Référence des Loyers", badge: "Logements" },
  ILC: { name: "Indice des Loyers Commerciaux", badge: "Commerce" },
  ILAT: { name: "Indice des Loyers des Activités Tertiaires", badge: "Tertiaire" },
  ICC: { name: "Indice du Coût de la Construction", badge: "Construction" },
};

function getNextRevisionDate(startDate: Date, revisionFrequency: number, lastRevisionDate?: Date | null): Date {
  const base = lastRevisionDate ?? startDate;
  const next = new Date(base);
  next.setMonth(next.getMonth() + revisionFrequency);
  return next;
}

function getRevisionStatus(nextDate: Date): { label: string; variant: "destructive" | "warning" | "default" | "secondary" } {
  const now = new Date();
  const diffMs = nextDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: `En retard de ${Math.abs(diffDays)} j`, variant: "destructive" };
  if (diffDays <= 30) return { label: `Dans ${diffDays} j`, variant: "warning" };
  if (diffDays <= 90) return { label: `Dans ${diffDays} j`, variant: "secondary" };
  return { label: `Dans ${diffDays} j`, variant: "default" };
}

export default async function IndicesPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await requireSocietyAccess(session.user.id, societyId);

  // Récupérer les baux actifs avec indexation + révisions en attente
  const leases = await prisma.lease.findMany({
    where: {
      societyId,
      status: "EN_COURS",
      indexType: { not: null },
    },
    select: {
      id: true,
      startDate: true,
      indexType: true,
      baseIndexValue: true,
      baseIndexQuarter: true,
      revisionFrequency: true,
      currentRentHT: true,
      baseRentHT: true,
      tenant: {
        select: {
          entityType: true,
          companyName: true,
          firstName: true,
          lastName: true,
        },
      },
      lot: {
        select: {
          number: true,
          building: { select: { name: true } },
        },
      },
      rentRevisions: {
        orderBy: { effectiveDate: "desc" },
        take: 1,
        select: {
          id: true,
          effectiveDate: true,
          newRentHT: true,
          newIndexValue: true,
          isValidated: true,
          formula: true,
        },
      },
    },
    orderBy: { startDate: "asc" },
  });

  // Types d'indices utilisés
  const usedIndexTypes = [...new Set(leases.map((l) => l.indexType).filter(Boolean))] as string[];

  // Derniers indices INSEE
  const allIndices = usedIndexTypes.length > 0
    ? await prisma.inseeIndex.findMany({
        where: { indexType: { in: usedIndexTypes as ("IRL" | "ILC" | "ILAT" | "ICC")[] } },
        orderBy: [{ year: "desc" }, { quarter: "desc" }],
      })
    : [];

  const indexByType: Record<string, { latest: typeof allIndices[0] | null; history: typeof allIndices }> = {};
  for (const type of usedIndexTypes) {
    const entries = allIndices.filter((i) => i.indexType === type);
    indexByType[type] = { latest: entries[0] ?? null, history: entries.slice(0, 8) };
  }

  // Préparer les données sérialisables pour le composant client
  const leasesData = leases.map((lease) => {
    const lastValidated = lease.rentRevisions.find((r) => r.isValidated);
    const pendingRevision = lease.rentRevisions.find((r) => !r.isValidated);
    const lastRevisionForDate = lease.rentRevisions[0] ?? null;

    const nextRevisionDate = getNextRevisionDate(
      lease.startDate,
      lease.revisionFrequency ?? 12,
      lastRevisionForDate?.effectiveDate
    );
    const status = getRevisionStatus(nextRevisionDate);
    const tenantName = lease.tenant.entityType === "PERSONNE_MORALE"
      ? lease.tenant.companyName ?? "—"
      : [lease.tenant.firstName, lease.tenant.lastName].filter(Boolean).join(" ") || "—";

    return {
      id: lease.id,
      tenantName,
      lotLabel: `${lease.lot.building.name} — Lot ${lease.lot.number}`,
      indexType: lease.indexType as string,
      currentRentHT: lease.currentRentHT,
      baseRentHT: lease.baseRentHT,
      baseIndexValue: lease.baseIndexValue,
      baseIndexQuarter: lease.baseIndexQuarter,
      nextRevisionDate: nextRevisionDate.toISOString(),
      statusVariant: status.variant,
      statusLabel: status.label,
      lastRevisionDate: lastValidated?.effectiveDate?.toISOString() ?? null,
      lastRevisionNewRent: lastValidated?.newRentHT ?? null,
      pendingRevisionId: pendingRevision?.id ?? null,
      pendingNewRent: pendingRevision?.newRentHT ?? null,
      pendingFormula: pendingRevision?.formula ?? null,
    };
  }).sort((a, b) => new Date(a.nextRevisionDate).getTime() - new Date(b.nextRevisionDate).getTime());

  const latestIndicesData = usedIndexTypes.map((type) => {
    const latest = indexByType[type]?.latest;
    return latest ? { type, value: latest.value, quarter: latest.quarter, year: latest.year } : null;
  }).filter(Boolean) as { type: string; value: number; quarter: number; year: number }[];

  // Compteurs
  const overdueCount = leasesData.filter((l) => l.statusVariant === "destructive").length;
  const soonCount = leasesData.filter((l) => l.statusVariant === "warning").length;
  const pendingCount = leasesData.filter((l) => l.pendingRevisionId).length;

  return (
    <div className="space-y-6">
      <GestionLocativeNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Révisions / Indices</h1>
          <p className="text-muted-foreground">
            {leases.length} bail{leases.length !== 1 ? "x" : ""} avec indexation · Suivi et génération des révisions
          </p>
        </div>
      </div>

      {/* Alertes */}
      {(overdueCount > 0 || soonCount > 0 || pendingCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-status-negative)]/30 bg-[var(--color-status-negative)]/5 px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-[var(--color-status-negative)]" />
              <span className="text-sm font-medium text-[var(--color-status-negative)]">
                {overdueCount} révision{overdueCount > 1 ? "s" : ""} en retard
              </span>
            </div>
          )}
          {soonCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-status-caution)]/30 bg-[var(--color-status-caution-bg)] px-4 py-2.5">
              <Clock className="h-4 w-4 text-[var(--color-status-caution)]" />
              <span className="text-sm font-medium text-[var(--color-status-caution)]">
                {soonCount} révision{soonCount > 1 ? "s" : ""} dans les 30 jours
              </span>
            </div>
          )}
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">
                {pendingCount} révision{pendingCount > 1 ? "s" : ""} en attente de validation
              </span>
            </div>
          )}
        </div>
      )}

      {/* KPIs indices */}
      {usedIndexTypes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {usedIndexTypes.map((type) => {
            const info = INDEX_INFO[type];
            const data = indexByType[type];
            const latest = data?.latest;
            const prev = data?.history[1];
            const evol = latest && prev ? (((latest.value - prev.value) / prev.value) * 100) : null;
            const leaseCount = leases.filter((l) => l.indexType === type).length;

            return (
              <Card key={type}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      {type}
                    </CardTitle>
                    <Badge variant="secondary" className="text-[10px]">
                      {leaseCount} bail{leaseCount > 1 ? "x" : ""}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">{info?.name ?? type}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums">{latest ? latest.value.toFixed(2) : "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {latest ? `T${latest.quarter} ${latest.year}` : "Non disponible"}
                  </p>
                  {evol != null && (
                    <p className={`text-xs mt-1 font-medium ${evol >= 0 ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]"}`}>
                      {evol >= 0 ? "+" : ""}{evol.toFixed(2)}% vs trimestre précédent
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Tableau interactif des révisions */}
      {leasesData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Révisions de loyer par bail</CardTitle>
            <CardDescription>
              Générer, valider ou rejeter les révisions · Le loyer est mis à jour uniquement après validation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RevisionActions
              societyId={societyId}
              leases={leasesData}
              latestIndices={latestIndicesData}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">Aucun bail avec indexation</p>
            <p className="text-xs text-muted-foreground mt-1">
              Les baux avec un indice de révision (IRL, ILC, ILAT, ICC) apparaîtront ici.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Historiques des indices */}
      {usedIndexTypes.map((type) => {
        const data = indexByType[type];
        if (!data?.history.length) return null;
        const info = INDEX_INFO[type];

        return (
          <Card key={`hist-${type}`}>
            <CardHeader>
              <CardTitle className="text-base">Historique {type} — {info?.name ?? type}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="pb-2 text-left font-medium">Période</th>
                      <th className="pb-2 text-right font-medium">Valeur</th>
                      <th className="pb-2 text-right font-medium">Évol. trimestrielle</th>
                      <th className="pb-2 text-right font-medium">Évol. annuelle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.history.map((entry, i) => {
                      const prevQ = data.history[i + 1];
                      const prevY = data.history[i + 4];
                      const evolQ = prevQ ? (((entry.value - prevQ.value) / prevQ.value) * 100) : null;
                      const evolY = prevY ? (((entry.value - prevY.value) / prevY.value) * 100) : null;

                      return (
                        <tr key={entry.id}>
                          <td className="py-2 font-medium">T{entry.quarter} {entry.year}</td>
                          <td className="py-2 text-right tabular-nums font-semibold">{entry.value.toFixed(2)}</td>
                          <td className="py-2 text-right tabular-nums">
                            {evolQ != null ? (
                              <span className={evolQ >= 0 ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]"}>
                                {evolQ >= 0 ? "+" : ""}{evolQ.toFixed(2)}%
                              </span>
                            ) : "—"}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {evolY != null ? (
                              <span className={evolY >= 0 ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]"}>
                                {evolY >= 0 ? "+" : ""}{evolY.toFixed(2)}%
                              </span>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
