import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import { formatCurrency, formatDate } from "@/lib/utils";
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
  CheckCircle2,
  Clock,
  Building2,
  CalendarClock,
} from "lucide-react";
import { GestionLocativeNav } from "@/components/layout/gestion-locative-nav";

export const metadata = { title: "Révisions / Indices" };

const INDEX_INFO: Record<string, { name: string; description: string; badge: string }> = {
  IRL: {
    name: "Indice de Référence des Loyers",
    description: "Référence légale pour réviser les loyers d'habitation",
    badge: "Logements",
  },
  ILC: {
    name: "Indice des Loyers Commerciaux",
    description: "Utilisé pour réviser les loyers des locaux commerciaux",
    badge: "Commerce",
  },
  ILAT: {
    name: "Indice des Loyers des Activités Tertiaires",
    description: "Utilisé pour les bureaux et activités tertiaires",
    badge: "Tertiaire",
  },
  ICC: {
    name: "Indice du Coût de la Construction",
    description: "Ancien indice de référence, toujours utilisé dans certains baux",
    badge: "Construction",
  },
};

function getNextRevisionDate(startDate: Date, revisionFrequency: number, lastRevisionDate?: Date | null): Date {
  const base = lastRevisionDate ?? startDate;
  const next = new Date(base);
  next.setMonth(next.getMonth() + revisionFrequency);
  return next;
}

function getRevisionStatus(nextDate: Date): { label: string; variant: "destructive" | "warning" | "default" | "secondary"; icon: typeof AlertTriangle } {
  const now = new Date();
  const diffMs = nextDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: `En retard de ${Math.abs(diffDays)} jour${Math.abs(diffDays) > 1 ? "s" : ""}`, variant: "destructive", icon: AlertTriangle };
  }
  if (diffDays <= 30) {
    return { label: `Dans ${diffDays} jour${diffDays > 1 ? "s" : ""}`, variant: "warning", icon: Clock };
  }
  if (diffDays <= 90) {
    return { label: `Dans ${diffDays} jours`, variant: "secondary", icon: CalendarClock };
  }
  return { label: `Dans ${diffDays} jours`, variant: "default", icon: CheckCircle2 };
}

export default async function IndicesPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await requireSocietyAccess(session.user.id, societyId);

  // Récupérer les baux actifs avec indexation
  const leases = await prisma.lease.findMany({
    where: {
      societyId,
      status: "EN_COURS",
      indexType: { not: null },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
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
        select: { effectiveDate: true, newRentHT: true, newIndexValue: true },
      },
    },
    orderBy: { startDate: "asc" },
  });

  // Types d'indices utilisés par les baux
  const usedIndexTypes = [...new Set(leases.map((l) => l.indexType).filter(Boolean))] as string[];

  // Récupérer les derniers indices INSEE pour les types utilisés
  const latestIndices = usedIndexTypes.length > 0
    ? await prisma.inseeIndex.findMany({
        where: { indexType: { in: usedIndexTypes as ("IRL" | "ILC" | "ILAT" | "ICC")[] } },
        orderBy: [{ year: "desc" }, { quarter: "desc" }],
      })
    : [];

  // Grouper par type : dernière valeur + historique
  const indexByType: Record<string, { latest: typeof latestIndices[0] | null; history: typeof latestIndices }> = {};
  for (const type of usedIndexTypes) {
    const entries = latestIndices.filter((i) => i.indexType === type);
    indexByType[type] = { latest: entries[0] ?? null, history: entries.slice(0, 8) };
  }

  // Préparer les données par bail avec date de prochaine révision
  const leasesWithRevision = leases.map((lease) => {
    const lastRevision = lease.rentRevisions[0] ?? null;
    const nextRevisionDate = getNextRevisionDate(
      lease.startDate,
      lease.revisionFrequency ?? 12,
      lastRevision?.effectiveDate
    );
    const status = getRevisionStatus(nextRevisionDate);
    const tenantName = lease.tenant.entityType === "PERSONNE_MORALE"
      ? lease.tenant.companyName ?? "—"
      : [lease.tenant.firstName, lease.tenant.lastName].filter(Boolean).join(" ") || "—";
    const lotLabel = `${lease.lot.building.name} — Lot ${lease.lot.number}`;

    return { ...lease, lastRevision, nextRevisionDate, status, tenantName, lotLabel };
  }).sort((a, b) => a.nextRevisionDate.getTime() - b.nextRevisionDate.getTime());

  // Compteurs d'alertes
  const overdueCount = leasesWithRevision.filter((l) => l.status.variant === "destructive").length;
  const soonCount = leasesWithRevision.filter((l) => l.status.variant === "warning").length;

  return (
    <div className="space-y-6">
      <GestionLocativeNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Révisions / Indices</h1>
          <p className="text-muted-foreground">
            {leases.length} bail{leases.length !== 1 ? "x" : ""} avec indexation · Suivi des révisions de loyer
          </p>
        </div>
      </div>

      {/* Alertes */}
      {(overdueCount > 0 || soonCount > 0) && (
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
        </div>
      )}

      {/* KPIs : indices utilisés */}
      {usedIndexTypes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {usedIndexTypes.map((type) => {
            const info = INDEX_INFO[type];
            const data = indexByType[type];
            const latest = data?.latest;
            const prev = data?.history[1];
            const evol = latest && prev
              ? (((latest.value - prev.value) / prev.value) * 100)
              : null;
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
                  <p className="text-2xl font-bold tabular-nums">
                    {latest ? latest.value.toFixed(2) : "—"}
                  </p>
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

      {/* Tableau des baux avec prochaine révision */}
      {leasesWithRevision.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Prochaines révisions par bail
            </CardTitle>
            <CardDescription>
              Classées par date de prochaine révision (les plus urgentes en premier)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Locataire</th>
                    <th className="pb-2 text-left font-medium">Lot</th>
                    <th className="pb-2 text-center font-medium">Indice</th>
                    <th className="pb-2 text-right font-medium">Loyer actuel HT</th>
                    <th className="pb-2 text-center font-medium">Base indice</th>
                    <th className="pb-2 text-center font-medium">Dernière révision</th>
                    <th className="pb-2 text-center font-medium">Prochaine révision</th>
                    <th className="pb-2 text-center font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {leasesWithRevision.map((lease) => {
                    const StatusIcon = lease.status.icon;
                    return (
                      <tr key={lease.id} className={lease.status.variant === "destructive" ? "bg-[var(--color-status-negative)]/5" : lease.status.variant === "warning" ? "bg-[var(--color-status-caution-bg)]/50" : ""}>
                        <td className="py-2.5 font-medium">{lease.tenantName}</td>
                        <td className="py-2.5 text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate max-w-[200px]">{lease.lotLabel}</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-center">
                          <Badge variant="outline" className="text-[10px]">{lease.indexType}</Badge>
                        </td>
                        <td className="py-2.5 text-right tabular-nums font-medium">
                          {formatCurrency(lease.currentRentHT)}
                        </td>
                        <td className="py-2.5 text-center tabular-nums text-muted-foreground">
                          {lease.baseIndexValue?.toFixed(2) ?? "—"}
                          {lease.baseIndexQuarter && (
                            <span className="text-[10px] ml-1">({lease.baseIndexQuarter})</span>
                          )}
                        </td>
                        <td className="py-2.5 text-center text-muted-foreground">
                          {lease.lastRevision
                            ? formatDate(lease.lastRevision.effectiveDate)
                            : <span className="text-xs italic">Aucune</span>
                          }
                        </td>
                        <td className="py-2.5 text-center font-medium">
                          {formatDate(lease.nextRevisionDate)}
                        </td>
                        <td className="py-2.5 text-center">
                          <Badge
                            variant={lease.status.variant === "warning" ? "secondary" : lease.status.variant}
                            className={`text-[10px] gap-1 ${lease.status.variant === "warning" ? "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)] border-[var(--color-status-caution)]/30" : ""}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {lease.status.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">Aucun bail avec indexation</p>
            <p className="text-xs text-muted-foreground mt-1">
              Les baux avec un indice de révision (IRL, ILC, ILAT, ICC) apparaîtront ici
              avec leurs dates de prochaine révision.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Historique des indices utilisés */}
      {usedIndexTypes.map((type) => {
        const data = indexByType[type];
        if (!data?.history.length) return null;
        const info = INDEX_INFO[type];

        return (
          <Card key={`hist-${type}`}>
            <CardHeader>
              <CardTitle className="text-base">
                Historique {type} — {info?.name ?? type}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="pb-2 text-left font-medium">Période</th>
                      <th className="pb-2 text-right font-medium">Valeur</th>
                      <th className="pb-2 text-right font-medium">Évolution trimestrielle</th>
                      <th className="pb-2 text-right font-medium">Évolution annuelle</th>
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
