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
  Calendar,
  DatabaseZap,
} from "lucide-react";
import { GestionLocativeNav } from "@/components/layout/gestion-locative-nav";
import { RevisionActions } from "./_components/revision-actions";
import { SyncIndicesButton } from "./_components/sync-indices-button";

export const metadata = { title: "Révisions / Indices" };

const INDEX_INFO: Record<
  string,
  { name: string; badge: string; color: string }
> = {
  IRL: { name: "Indice de Référence des Loyers", badge: "Logements", color: "text-blue-600" },
  ILC: { name: "Indice des Loyers Commerciaux", badge: "Commerce", color: "text-emerald-600" },
  ILAT: { name: "Indice des Loyers des Activités Tertiaires", badge: "Tertiaire", color: "text-violet-600" },
  ICC: { name: "Indice du Coût de la Construction", badge: "Construction", color: "text-amber-600" },
};

// ── Dates de publication estimées par l'INSEE ──────────────────────────
// IRL : publié ~15 du mois suivant la fin du trimestre (~45 jours)
// ILC, ILAT, ICC : publié ~fin du trimestre suivant (~90 jours)
// ────────────────────────────────────────────────────────────────────────

/**
 * Calcule la date estimée de publication du prochain indice INSEE
 * en fonction du dernier trimestre disponible.
 */
function getNextPublicationInfo(
  indexType: string,
  latestYear: number | null,
  latestQuarter: number | null
): { nextQuarterLabel: string; estimatedDate: Date; isOverdue: boolean } | null {
  if (!latestYear || !latestQuarter) return null;

  // Prochain trimestre attendu
  let nextQ = latestQuarter + 1;
  let nextY = latestYear;
  if (nextQ > 4) {
    nextQ = 1;
    nextY++;
  }

  const nextQuarterLabel = `T${nextQ} ${nextY}`;
  let estimatedDate: Date;

  if (indexType === "IRL") {
    // IRL publié ~15 du mois suivant la fin du trimestre
    // Q1 (Jan-Mar) → ~15 avril, Q2 → ~15 juillet, Q3 → ~15 octobre, Q4 → ~15 janvier+1
    const pubMap: Record<number, { month: number; yearOffset: number }> = {
      1: { month: 3, yearOffset: 0 }, // avril (0-indexed)
      2: { month: 6, yearOffset: 0 }, // juillet
      3: { month: 9, yearOffset: 0 }, // octobre
      4: { month: 0, yearOffset: 1 }, // janvier +1
    };
    const pub = pubMap[nextQ];
    estimatedDate = new Date(nextY + pub.yearOffset, pub.month, 15);
  } else {
    // ILC, ILAT, ICC publiés ~fin du trimestre suivant
    // Q1 → ~30 juin, Q2 → ~30 sept, Q3 → ~31 déc, Q4 → ~31 mars+1
    const pubMap: Record<number, { month: number; day: number; yearOffset: number }> = {
      1: { month: 5, day: 30, yearOffset: 0 }, // 30 juin
      2: { month: 8, day: 30, yearOffset: 0 }, // 30 septembre
      3: { month: 11, day: 31, yearOffset: 0 }, // 31 décembre
      4: { month: 2, day: 31, yearOffset: 1 }, // 31 mars +1
    };
    const pub = pubMap[nextQ];
    estimatedDate = new Date(nextY + pub.yearOffset, pub.month, pub.day);
  }

  const isOverdue = estimatedDate.getTime() < Date.now();

  return { nextQuarterLabel, estimatedDate, isOverdue };
}

function getNextRevisionDate(
  startDate: Date,
  revisionFrequency: number,
  lastRevisionDate?: Date | null,
): Date {
  // Toujours retourner la PROCHAINE échéance (sans sauter d'années).
  // Si la date est dans le passé, elle s'affichera comme "en retard"
  // et l'utilisateur pourra rattraper année par année.
  const next = new Date(lastRevisionDate ?? startDate);
  next.setMonth(next.getMonth() + revisionFrequency);
  return next;
}

/** Nombre d'années de révision manquées (0 = à jour ou pas encore dû) */
function getMissedRevisionsCount(
  startDate: Date,
  revisionFrequency: number,
  lastRevisionDate?: Date | null,
): number {
  const now = new Date();
  const next = new Date(lastRevisionDate ?? startDate);
  next.setMonth(next.getMonth() + revisionFrequency);
  if (next > now) return 0;
  let count = 0;
  const cursor = new Date(next);
  while (cursor <= now) {
    count++;
    cursor.setMonth(cursor.getMonth() + revisionFrequency);
  }
  return count;
}

function getRevisionStatus(
  nextDate: Date
): {
  label: string;
  variant: "destructive" | "warning" | "default" | "secondary";
} {
  const now = new Date();
  const diffMs = nextDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0)
    return {
      label: `En retard de ${Math.abs(diffDays)} j`,
      variant: "destructive",
    };
  if (diffDays <= 30) return { label: `Dans ${diffDays} j`, variant: "warning" };
  if (diffDays <= 90)
    return { label: `Dans ${diffDays} j`, variant: "secondary" };
  return { label: `Dans ${diffDays} j`, variant: "default" };
}

function formatDateFr(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

  // Types d'indices utilisés par les baux actifs
  const usedIndexTypes = [
    ...new Set(leases.map((l) => l.indexType).filter(Boolean)),
  ] as string[];

  // Indices INSEE en base (tous les types utilisés, jusqu'à 20 par type)
  const allIndices =
    usedIndexTypes.length > 0
      ? await prisma.inseeIndex.findMany({
          where: {
            indexType: {
              in: usedIndexTypes as ("IRL" | "ILC" | "ILAT" | "ICC")[],
            },
          },
          orderBy: [{ year: "desc" }, { quarter: "desc" }],
        })
      : [];

  const indexByType: Record<
    string,
    { latest: (typeof allIndices)[0] | null; history: (typeof allIndices) }
  > = {};
  for (const type of usedIndexTypes) {
    const entries = allIndices.filter((i) => i.indexType === type);
    indexByType[type] = {
      latest: entries[0] ?? null,
      history: entries.slice(0, 12),
    };
  }

  // Vérifier si des indices manquent en base
  const hasNoData = usedIndexTypes.every(
    (type) => !indexByType[type]?.latest
  );
  const missingTypes = usedIndexTypes.filter(
    (type) => !indexByType[type]?.latest
  );

  // Préparer les données sérialisables pour le composant client
  const leasesData = leases
    .map((lease) => {
      const lastValidated = lease.rentRevisions.find((r) => r.isValidated);
      const pendingRevision = lease.rentRevisions.find((r) => !r.isValidated);

      const nextRevisionDate = getNextRevisionDate(
        lease.startDate,
        lease.revisionFrequency ?? 12,
        lastValidated?.effectiveDate ?? null,
      );
      const missedYears = getMissedRevisionsCount(
        lease.startDate,
        lease.revisionFrequency ?? 12,
        lastValidated?.effectiveDate ?? null,
      );
      const status = getRevisionStatus(nextRevisionDate);
      const tenantName =
        lease.tenant.entityType === "PERSONNE_MORALE"
          ? lease.tenant.companyName ?? "—"
          : [lease.tenant.firstName, lease.tenant.lastName]
              .filter(Boolean)
              .join(" ") || "—";

      // Trouver l'indice du trimestre de référence pour la prochaine révision
      let referenceIndex: { value: number; quarter: number; year: number } | null = null;
      if (lease.baseIndexQuarter) {
        const match = lease.baseIndexQuarter.match(/T(\d)\s*(\d{4})/);
        if (match) {
          const refQuarter = parseInt(match[1]);
          const targetYear = nextRevisionDate.getFullYear();
          // Chercher le même trimestre pour l'année cible, sinon année précédente
          const targetIndex = allIndices.find(
            (i) => i.indexType === lease.indexType && i.quarter === refQuarter && i.year === targetYear
          ) ?? allIndices.find(
            (i) => i.indexType === lease.indexType && i.quarter === refQuarter && i.year === targetYear - 1
          );
          if (targetIndex) {
            referenceIndex = { value: targetIndex.value, quarter: targetIndex.quarter, year: targetIndex.year };
          }
        }
      }

      // Fallback : dernier indice disponible
      const latestForType = indexByType[lease.indexType as string]?.latest;
      const displayIndex = referenceIndex ?? (latestForType ? { value: latestForType.value, quarter: latestForType.quarter, year: latestForType.year } : null);

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
        lastRevisionDate:
          lastValidated?.effectiveDate?.toISOString() ?? null,
        lastRevisionNewRent: lastValidated?.newRentHT ?? null,
        pendingRevisionId: pendingRevision?.id ?? null,
        pendingNewRent: pendingRevision?.newRentHT ?? null,
        pendingFormula: pendingRevision?.formula ?? null,
        referenceIndexValue: displayIndex?.value ?? null,
        referenceIndexQuarter: displayIndex ? `T${displayIndex.quarter}` : null,
        referenceIndexYear: displayIndex?.year ?? null,
        missedYears,
      };
    })
    .sort(
      (a, b) =>
        new Date(a.nextRevisionDate).getTime() -
        new Date(b.nextRevisionDate).getTime()
    );

  const latestIndicesData = usedIndexTypes
    .map((type) => {
      const latest = indexByType[type]?.latest;
      return latest
        ? {
            type,
            value: latest.value,
            quarter: latest.quarter,
            year: latest.year,
          }
        : null;
    })
    .filter(Boolean) as {
    type: string;
    value: number;
    quarter: number;
    year: number;
  }[];

  // Compteurs
  const overdueCount = leasesData.filter(
    (l) => l.statusVariant === "destructive"
  ).length;
  const soonCount = leasesData.filter(
    (l) => l.statusVariant === "warning"
  ).length;
  const pendingCount = leasesData.filter(
    (l) => l.pendingRevisionId
  ).length;

  return (
    <div className="space-y-6">
      <GestionLocativeNav />

      {/* En-tête + bouton Synchroniser */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Révisions / Indices
          </h1>
          <p className="text-muted-foreground">
            {leases.length} {leases.length > 1 ? "baux" : "bail"} avec
            indexation · Suivi et génération des révisions
          </p>
        </div>
        <SyncIndicesButton
          societyId={societyId}
          indexTypes={usedIndexTypes}
        />
      </div>

      {/* Bandeau si aucune donnée */}
      {hasNoData && usedIndexTypes.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-4 py-4">
            <DatabaseZap className="h-8 w-8 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Indices non synchronisés
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Cliquez sur « Synchroniser les indices » pour télécharger
                l&apos;historique des indices{" "}
                {usedIndexTypes.join(", ")} depuis l&apos;INSEE.
                Les données seront ensuite mises à jour automatiquement
                chaque mois.
              </p>
            </div>
            <SyncIndicesButton
              societyId={societyId}
              indexTypes={usedIndexTypes}
              variant="default"
              size="default"
            />
          </CardContent>
        </Card>
      )}

      {/* Bandeau si certains types manquent */}
      {!hasNoData && missingTypes.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-sm text-amber-700">
            Indices manquants pour : <strong>{missingTypes.join(", ")}</strong>.
            Lancez une synchronisation pour récupérer les données.
          </span>
        </div>
      )}

      {/* Alertes révisions */}
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
                {soonCount} révision{soonCount > 1 ? "s" : ""} dans les 30
                jours
              </span>
            </div>
          )}
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 dark:border-blue-800 dark:bg-blue-950/20">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                {pendingCount} révision{pendingCount > 1 ? "s" : ""} en
                attente de validation
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
            const prevQ = data?.history[1]; // trimestre précédent
            const prevY = data?.history[4]; // même trimestre année précédente (4 trimestres)
            const evolQ =
              latest && prevQ
                ? ((latest.value - prevQ.value) / prevQ.value) * 100
                : null;
            const evolY =
              latest && prevY
                ? ((latest.value - prevY.value) / prevY.value) * 100
                : null;
            const leaseCount = leases.filter(
              (l) => l.indexType === type
            ).length;

            const pubInfo = getNextPublicationInfo(
              type,
              latest?.year ?? null,
              latest?.quarter ?? null
            );

            return (
              <Card key={type}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp
                        className={`h-4 w-4 ${info?.color ?? "text-primary"}`}
                      />
                      {type}
                    </CardTitle>
                    <Badge variant="secondary" className="text-[10px]">
                      {leaseCount > 1
                        ? `${leaseCount} baux`
                        : "1 bail"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {info?.name ?? type}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {latest ? (
                    <>
                      <div>
                        <p className="text-2xl font-bold tabular-nums">
                          {latest.value.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          T{latest.quarter} {latest.year}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        {evolY != null && (
                          <p
                            className={`text-xs font-semibold ${evolY >= 0 ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]"}`}
                          >
                            {evolY >= 0 ? "+" : ""}
                            {evolY.toFixed(2)}% sur 12 mois glissants
                          </p>
                        )}
                        {evolQ != null && (
                          <p
                            className={`text-[11px] ${evolQ >= 0 ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]"}`}
                          >
                            {evolQ >= 0 ? "+" : ""}
                            {evolQ.toFixed(2)}% vs trimestre précédent
                          </p>
                        )}
                      </div>
                      {pubInfo && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span>
                            {pubInfo.nextQuarterLabel} :{" "}
                            {pubInfo.isOverdue ? (
                              <span className="text-amber-600 font-medium">
                                publication imminente
                              </span>
                            ) : (
                              <>
                                prévu ~
                                {formatDateFr(pubInfo.estimatedDate)}
                              </>
                            )}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <p className="text-lg font-medium text-muted-foreground">
                        Pas de données
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Synchronisez les indices
                      </p>
                    </div>
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
            <CardTitle className="text-base">
              Révisions de loyer par bail
            </CardTitle>
            <CardDescription>
              Générer, valider ou rejeter les révisions · Le loyer est mis
              à jour uniquement après validation
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
            <p className="text-sm font-medium">
              Aucun bail avec indexation
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Les baux avec un indice de révision (IRL, ILC, ILAT, ICC)
              apparaîtront ici.
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Historique {type} — {info?.name ?? type}
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal"
                >
                  {data.history.length} trimestres
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="pb-2 text-left font-medium">
                        Période
                      </th>
                      <th className="pb-2 text-right font-medium">
                        Valeur
                      </th>
                      <th className="pb-2 text-right font-medium">
                        Évol. trimestrielle
                      </th>
                      <th className="pb-2 text-right font-medium">
                        Évol. annuelle
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.history.map((entry, i) => {
                      const prevQ = data.history[i + 1];
                      const prevY = data.history[i + 4];
                      const evolQ = prevQ
                        ? ((entry.value - prevQ.value) / prevQ.value) *
                          100
                        : null;
                      const evolY = prevY
                        ? ((entry.value - prevY.value) / prevY.value) *
                          100
                        : null;

                      return (
                        <tr key={entry.id}>
                          <td className="py-2 font-medium">
                            T{entry.quarter} {entry.year}
                          </td>
                          <td className="py-2 text-right tabular-nums font-semibold">
                            {entry.value.toFixed(2)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {evolQ != null ? (
                              <span
                                className={
                                  evolQ >= 0
                                    ? "text-[var(--color-status-positive)]"
                                    : "text-[var(--color-status-negative)]"
                                }
                              >
                                {evolQ >= 0 ? "+" : ""}
                                {evolQ.toFixed(2)}%
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {evolY != null ? (
                              <span
                                className={
                                  evolY >= 0
                                    ? "text-[var(--color-status-positive)]"
                                    : "text-[var(--color-status-negative)]"
                                }
                              >
                                {evolY >= 0 ? "+" : ""}
                                {evolY.toFixed(2)}%
                              </span>
                            ) : (
                              "—"
                            )}
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
