import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
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
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { RevisionActions } from "./_components/revision-actions";
import { SyncIndicesButton } from "./_components/sync-indices-button";

export const metadata = { title: "Indices INSEE" };

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

/**
 * Calcule la date de base de la révision en fonction du mode choisi.
 * C'est cette date anniversaire qui sert de point de départ.
 */
function getRevisionAnchorDate(
  startDate: Date,
  entryDate: Date | null,
  revisionDateBasis: string | null,
  customMonth: number | null,
  customDay: number | null,
): Date {
  switch (revisionDateBasis) {
    case "DATE_ENTREE":
      return entryDate ?? startDate;
    case "PREMIER_JANVIER": {
      // Le 1er janvier suivant le début du bail
      const year = startDate.getFullYear() + 1;
      return new Date(year, 0, 1);
    }
    case "DATE_PERSONNALISEE": {
      // Date personnalisée la même année que le startDate
      const m = (customMonth ?? 1) - 1; // 0-indexed
      const d = customDay ?? 1;
      const custom = new Date(startDate.getFullYear(), m, d);
      // Si la date personnalisée est avant le startDate, prendre l'année suivante
      if (custom <= startDate) custom.setFullYear(custom.getFullYear() + 1);
      return custom;
    }
    case "DATE_SIGNATURE":
    default:
      return startDate;
  }
}

function getNextRevisionDate(
  startDate: Date,
  revisionFrequency: number,
  lastRevisionDate?: Date | null,
  entryDate?: Date | null,
  revisionDateBasis?: string | null,
  customMonth?: number | null,
  customDay?: number | null,
): Date {
  const anchor = getRevisionAnchorDate(
    startDate,
    entryDate ?? null,
    revisionDateBasis ?? null,
    customMonth ?? null,
    customDay ?? null,
  );

  // Construire le calendrier de révision à partir de la date d'ancrage
  const cursor = new Date(anchor);

  // Pour DATE_SIGNATURE / DATE_ENTREE, la 1re révision est anchor + fréquence
  // Pour PREMIER_JANVIER / DATE_PERSONNALISEE, la 1re révision est l'anchor elle-même
  if (
    !revisionDateBasis ||
    revisionDateBasis === "DATE_SIGNATURE" ||
    revisionDateBasis === "DATE_ENTREE"
  ) {
    cursor.setMonth(cursor.getMonth() + revisionFrequency);
  }

  // Avancer dans le cycle jusqu'à dépasser la dernière révision validée
  if (lastRevisionDate) {
    while (cursor <= lastRevisionDate) {
      cursor.setMonth(cursor.getMonth() + revisionFrequency);
    }
  }

  return cursor;
}

/** Nombre d'années de révision manquées (0 = à jour ou pas encore dû) */
function getMissedRevisionsCount(
  startDate: Date,
  revisionFrequency: number,
  lastRevisionDate?: Date | null,
  entryDate?: Date | null,
  revisionDateBasis?: string | null,
  customMonth?: number | null,
  customDay?: number | null,
): number {
  const now = new Date();
  const nextDate = getNextRevisionDate(startDate, revisionFrequency, lastRevisionDate, entryDate, revisionDateBasis, customMonth, customDay);
  if (nextDate > now) return 0;
  let count = 0;
  const cursor = new Date(nextDate);
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

type IndexRow = { indexType: string; quarter: number; year: number; value: number };

/**
 * Calcule le loyer théorique d'un bail si toutes les révisions prévues au
 * contrat avaient été appliquées jusqu'à `now`.
 * - INSEE : baseRentHT × (dernierIndice du trimestre de référence / baseIndexValue)
 * - POURCENTAGE_FIXE : baseRentHT × (1 + taux)^(années écoulées depuis l'entrée)
 */
function computeTheoreticalRent(params: {
  indexType: string | null;
  baseIndexValue: number | null;
  baseIndexQuarter: string | null;
  baseRentHT: number;
  fixedAnnualIndexationRate: number | null;
  entryDate: Date | null;
  startDate: Date;
  allIndices: IndexRow[];
  latestForType: IndexRow | null;
  now: Date;
}): { theoreticalRentHT: number | null; gapIndexLabel: string | null } {
  const {
    indexType,
    baseIndexValue,
    baseIndexQuarter,
    baseRentHT,
    fixedAnnualIndexationRate,
    entryDate,
    startDate,
    allIndices,
    latestForType,
    now,
  } = params;

  if (indexType === "POURCENTAGE_FIXE") {
    const rate = fixedAnnualIndexationRate ?? 0;
    const anchor = entryDate ?? startDate;
    const yearsElapsed = Math.max(
      0,
      Math.floor(
        (now.getTime() - anchor.getTime()) / (365.25 * 24 * 3600 * 1000),
      ),
    );
    if (rate > 0 && baseRentHT) {
      const theoretical =
        Math.round(
          baseRentHT * Math.pow(1 + rate / 100, yearsElapsed) * 100,
        ) / 100;
      return {
        theoreticalRentHT: theoretical,
        gapIndexLabel: `+${rate}%/an × ${yearsElapsed} an${yearsElapsed > 1 ? "s" : ""}`,
      };
    }
    return { theoreticalRentHT: null, gapIndexLabel: null };
  }

  if (!baseIndexValue || !baseIndexQuarter || !indexType || !baseRentHT) {
    return { theoreticalRentHT: null, gapIndexLabel: null };
  }
  const match = baseIndexQuarter.match(/T(\d)/);
  const refQuarter = match ? parseInt(match[1]) : null;
  let latestSameQ: IndexRow | undefined;
  if (refQuarter) {
    latestSameQ = allIndices.find(
      (i) => i.indexType === indexType && i.quarter === refQuarter,
    );
  }
  const refLatest = latestSameQ ?? latestForType;
  if (!refLatest) return { theoreticalRentHT: null, gapIndexLabel: null };
  const theoretical =
    Math.round(baseRentHT * (refLatest.value / baseIndexValue) * 100) / 100;
  return {
    theoreticalRentHT: theoretical,
    gapIndexLabel: `T${refLatest.quarter} ${refLatest.year} (${refLatest.value.toFixed(2)}) / ${baseIndexQuarter} (${baseIndexValue.toFixed(2)})`,
  };
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
      entryDate: true,
      indexType: true,
      baseIndexValue: true,
      baseIndexQuarter: true,
      revisionFrequency: true,
      revisionDateBasis: true,
      revisionCustomMonth: true,
      revisionCustomDay: true,
      currentRentHT: true,
      baseRentHT: true,
      fixedAnnualIndexationRate: true,
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
  const now = new Date();
  const leasesData = leases
    .map((lease) => {
      const lastValidated = lease.rentRevisions.find((r) => r.isValidated);
      const pendingRevision = lease.rentRevisions.find((r) => !r.isValidated);

      const nextRevisionDate = getNextRevisionDate(
        lease.startDate,
        lease.revisionFrequency ?? 12,
        lastValidated?.effectiveDate ?? null,
        lease.entryDate,
        lease.revisionDateBasis,
        lease.revisionCustomMonth,
        lease.revisionCustomDay,
      );
      const missedYears = getMissedRevisionsCount(
        lease.startDate,
        lease.revisionFrequency ?? 12,
        lastValidated?.effectiveDate ?? null,
        lease.entryDate,
        lease.revisionDateBasis,
        lease.revisionCustomMonth,
        lease.revisionCustomDay,
      );
      const status = getRevisionStatus(nextRevisionDate);
      const tenantName =
        lease.tenant.entityType === "PERSONNE_MORALE"
          ? lease.tenant.companyName ?? "—"
          : [lease.tenant.firstName, lease.tenant.lastName]
              .filter(Boolean)
              .join(" ") || "—";

      // Trouver l'indice du trimestre de référence pour la prochaine révision.
      // Règle : le nouvel indice doit être POSTÉRIEUR à l'année de la base
      // (baseIndexQuarter), sinon la révision serait vide (base = nouveau).
      // On prend donc le T{refQuarter} le plus récent avec year > baseYear.
      let referenceIndex: { value: number; quarter: number; year: number } | null = null;
      if (lease.baseIndexQuarter) {
        const match = lease.baseIndexQuarter.match(/T(\d)\s*(\d{4})/);
        if (match) {
          const refQuarter = parseInt(match[1]);
          const baseYear = parseInt(match[2]);
          const targetIndex = allIndices
            .filter(
              (i) => i.indexType === lease.indexType && i.quarter === refQuarter && i.year > baseYear
            )
            .sort((a, b) => b.year - a.year)[0];
          if (targetIndex) {
            referenceIndex = { value: targetIndex.value, quarter: targetIndex.quarter, year: targetIndex.year };
          }
        }
      }

      // Fallback : dernier indice disponible — uniquement si aucun trimestre
      // de référence n'est configuré sur le bail. Si baseIndexQuarter existe,
      // on ne veut pas comparer avec un autre trimestre (ILC T4 vs T2 = calcul faux).
      const latestForType = indexByType[lease.indexType as string]?.latest;
      const displayIndex = referenceIndex ?? (!lease.baseIndexQuarter && latestForType
        ? { value: latestForType.value, quarter: latestForType.quarter, year: latestForType.year }
        : null);

      // Si baseIndexQuarter est configuré mais qu'aucun T{q} > baseYear n'est
      // encore publié, la révision est structurellement impossible : le bail
      // est déjà à jour en attente de parution INSEE. On surcharge donc le
      // statut "En retard" par un statut "En attente publication INSEE".
      const awaitingInseePublication = Boolean(
        lease.baseIndexQuarter && !referenceIndex
      );
      const effectiveStatusVariant = awaitingInseePublication
        ? "secondary"
        : status.variant;
      const effectiveStatusLabel = awaitingInseePublication
        ? "En attente parution INSEE"
        : status.label;

      // Analyse d'écart : loyer théorique vs réel
      const { theoreticalRentHT, gapIndexLabel } = computeTheoreticalRent({
        indexType: lease.indexType,
        baseIndexValue: lease.baseIndexValue,
        baseIndexQuarter: lease.baseIndexQuarter,
        baseRentHT: lease.baseRentHT,
        fixedAnnualIndexationRate: lease.fixedAnnualIndexationRate,
        entryDate: lease.entryDate,
        startDate: lease.startDate,
        allIndices,
        latestForType: latestForType ?? null,
        now,
      });

      const gapMonthlyHT = theoreticalRentHT != null
        ? Math.round((theoreticalRentHT - lease.currentRentHT) * 100) / 100
        : null;
      const gapAnnualHT = gapMonthlyHT != null
        ? Math.round(gapMonthlyHT * 12 * 100) / 100
        : null;
      const gapPercentage = gapMonthlyHT != null && lease.currentRentHT > 0
        ? Math.round((gapMonthlyHT / lease.currentRentHT) * 10000) / 100
        : null;

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
        statusVariant: effectiveStatusVariant,
        statusLabel: effectiveStatusLabel,
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
        theoreticalRentHT,
        gapMonthlyHT,
        gapAnnualHT,
        gapPercentage,
        gapIndexLabel,
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

  // ── Synthèse globale des écarts d'indexation ────────────────────────
  // On ne considère que les baux ayant un loyer théorique calculable et
  // un écart positif (loyer sous-indexé = manque à gagner).
  const leasesWithGap = leasesData.filter(
    (l) => l.gapMonthlyHT != null && l.gapMonthlyHT > 0.5
  );
  const totalMonthlyGap = leasesWithGap.reduce(
    (sum, l) => sum + (l.gapMonthlyHT ?? 0),
    0
  );
  const totalAnnualGap = totalMonthlyGap * 12;
  const leasesUnderRented = [...leasesWithGap].sort(
    (a, b) => (b.gapAnnualHT ?? 0) - (a.gapAnnualHT ?? 0)
  );

  return (
    <div className="space-y-6">
      {/* En-tête + boutons */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Indices INSEE
          </h1>
          <p className="text-muted-foreground">
            {leases.length} {leases.length > 1 ? "baux" : "bail"} avec
            indexation · Référentiel des indices et suivi des révisions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Link href="/baux/revisions">
              <Button variant="outline" size="sm" className="gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                {pendingCount} révision{pendingCount > 1 ? "s" : ""} en attente
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
          <SyncIndicesButton
            societyId={societyId}
            indexTypes={usedIndexTypes}
          />
        </div>
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

      {/* Analyse des écarts d'indexation : loyer théorique vs loyer perçu */}
      {leasesData.some((l) => l.theoreticalRentHT != null) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Analyse des écarts d&apos;indexation
                </CardTitle>
                <CardDescription>
                  Loyer actuellement perçu vs loyer théorique si toutes les
                  révisions prévues avaient été appliquées
                </CardDescription>
              </div>
              {leasesWithGap.length > 0 && (
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">
                    Manque à gagner annuel
                  </p>
                  <p className="text-xl font-bold text-[var(--color-status-negative)] tabular-nums">
                    {totalAnnualGap.toLocaleString("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0,
                    })}
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    soit{" "}
                    {totalMonthlyGap.toLocaleString("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0,
                    })}
                    /mois sur {leasesWithGap.length} bail
                    {leasesWithGap.length > 1 ? "s" : ""}
                  </p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {leasesWithGap.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    Tous les baux sont indexés à jour
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    Le loyer perçu correspond au loyer théorique calculé à
                    partir du dernier indice publié.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="pb-2 text-left font-medium">
                        Locataire / Lot
                      </th>
                      <th className="pb-2 text-right font-medium">
                        Perçu HT
                      </th>
                      <th className="pb-2 text-right font-medium">
                        Théorique HT
                      </th>
                      <th className="pb-2 text-right font-medium">
                        Écart mensuel
                      </th>
                      <th className="pb-2 text-right font-medium">
                        Écart annuel
                      </th>
                      <th className="pb-2 text-center font-medium hidden md:table-cell">
                        Référence
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leasesUnderRented.map((l) => (
                      <tr key={`gap-${l.id}`}>
                        <td className="py-2.5">
                          <p className="font-medium leading-tight">
                            {l.tenantName}
                          </p>
                          <p className="text-xs text-muted-foreground leading-tight">
                            {l.lotLabel}
                          </p>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {l.currentRentHT.toLocaleString("fr-FR", {
                            style: "currency",
                            currency: "EUR",
                          })}
                        </td>
                        <td className="py-2.5 text-right tabular-nums font-medium">
                          {(l.theoreticalRentHT ?? 0).toLocaleString("fr-FR", {
                            style: "currency",
                            currency: "EUR",
                          })}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-[var(--color-status-negative)]">
                          +
                          {(l.gapMonthlyHT ?? 0).toLocaleString("fr-FR", {
                            style: "currency",
                            currency: "EUR",
                          })}
                          {l.gapPercentage != null && (
                            <span className="text-[11px] text-muted-foreground ml-1">
                              ({l.gapPercentage.toFixed(1)}%)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right tabular-nums font-semibold text-[var(--color-status-negative)]">
                          +
                          {(l.gapAnnualHT ?? 0).toLocaleString("fr-FR", {
                            style: "currency",
                            currency: "EUR",
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="py-2.5 text-center text-[11px] text-muted-foreground hidden md:table-cell">
                          {l.gapIndexLabel ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                  Le loyer théorique est calculé à partir du loyer de base à
                  l&apos;entrée et de l&apos;évolution de l&apos;indice de
                  référence ou du taux contractuel. L&apos;écart représente le
                  manque à gagner si toutes les révisions prévues étaient
                  appliquées au plus tard à ce jour (rappel : les révisions de
                  loyers d&apos;habitation sont prescrites au-delà d&apos;un
                  an).
                </p>
              </div>
            )}
          </CardContent>
        </Card>
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
