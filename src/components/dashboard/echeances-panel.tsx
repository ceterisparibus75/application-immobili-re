import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarRange } from "lucide-react";

// ─── Données ──────────────────────────────────────────────────────────────────

type EcheanceItem = {
  id: string;
  href: string;
  label: string;
  sublabel: string;
  daysRemaining: number;
  category: "bail" | "revision" | "diagnostic";
};

async function getEcheances(societyId: string | string[]): Promise<EcheanceItem[]> {
  const now = new Date();
  const in90days = new Date(now.getTime() + 90 * 24 * 3600 * 1000);
  const societyFilter = Array.isArray(societyId) ? { in: societyId } : societyId;

  const [leases, diagnostics, revisions] = await Promise.all([
    // Baux expirant dans 90 jours
    prisma.lease.findMany({
      where: {
        societyId: societyFilter,
        status: "EN_COURS",
        endDate: { gte: now, lte: in90days },
      },
      select: {
        id: true,
        endDate: true,
        tenant: { select: { firstName: true, lastName: true, companyName: true, entityType: true } },
        lot: { select: { number: true, building: { select: { name: true } } } },
      },
      orderBy: { endDate: "asc" },
      take: 8,
    }),

    // Diagnostics expirant dans 90 jours
    prisma.diagnostic.findMany({
      where: {
        building: { societyId: societyFilter },
        expiresAt: { gte: now, lte: in90days },
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

    // Révisions de loyer en attente de validation
    prisma.rentRevision.findMany({
      where: {
        lease: { societyId: societyFilter, status: "EN_COURS" },
        isValidated: false,
        effectiveDate: { lte: in90days },
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

  const items: EcheanceItem[] = [];
  const msPerDay = 86400000;

  // Baux
  for (const l of leases) {
    const end = l.endDate ? new Date(l.endDate) : null;
    if (!end) continue;
    const days = Math.ceil((end.getTime() - now.getTime()) / msPerDay);
    const tenant =
      l.tenant.entityType === "PERSONNE_MORALE"
        ? (l.tenant.companyName ?? "—")
        : `${l.tenant.firstName ?? ""} ${l.tenant.lastName ?? ""}`.trim() || "—";
    items.push({
      id: `bail-${l.id}`,
      href: `/baux/${l.id}`,
      label: `Bail — ${tenant}`,
      sublabel: `${l.lot.building.name} · Lot ${l.lot.number} · fin le ${end.toLocaleDateString("fr-FR")}`,
      daysRemaining: days,
      category: "bail",
    });
  }

  // Diagnostics
  for (const d of diagnostics) {
    const exp = d.expiresAt ? new Date(d.expiresAt) : null;
    if (!exp) continue;
    const days = Math.ceil((exp.getTime() - now.getTime()) / msPerDay);
    items.push({
      id: `diag-${d.id}`,
      href: `/patrimoine/immeubles/${d.building.id}`,
      label: `Diagnostic ${d.type} — ${d.building.name}`,
      sublabel: `Expire le ${exp.toLocaleDateString("fr-FR")}`,
      daysRemaining: days,
      category: "diagnostic",
    });
  }

  // Révisions
  for (const r of revisions) {
    const eff = new Date(r.effectiveDate);
    const days = Math.ceil((eff.getTime() - now.getTime()) / msPerDay);
    const tenant =
      r.lease.tenant.entityType === "PERSONNE_MORALE"
        ? (r.lease.tenant.companyName ?? "—")
        : `${r.lease.tenant.firstName ?? ""} ${r.lease.tenant.lastName ?? ""}`.trim() || "—";
    items.push({
      id: `rev-${r.id}`,
      href: `/baux/${r.lease.id}#loyer`,
      label: `Révision à valider — ${tenant}`,
      sublabel: `Nouveau loyer : ${r.newRentHT.toLocaleString("fr-FR")} € HT · Effet le ${eff.toLocaleDateString("fr-FR")}`,
      daysRemaining: days,
      category: "revision",
    });
  }

  return items.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// ─── Helpers visuels ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG = {
  bail: { bg: "#F0F9FF", color: "#1B4F8A", dot: "#1B4F8A" },
  revision: { bg: "var(--color-status-caution-bg)", color: "var(--color-status-caution)", dot: "var(--color-status-caution)" },
  diagnostic: { bg: "#FFF7ED", color: "#C2410C", dot: "#C2410C" },
};

function urgencyLabel(days: number): string {
  if (days < 0) return "Expiré";
  if (days === 0) return "Aujourd'hui";
  if (days <= 7) return `${days}j`;
  if (days <= 30) return `${days}j`;
  return `${days}j`;
}

function urgencyColor(days: number): string {
  if (days <= 7) return "var(--color-status-negative)";
  if (days <= 30) return "var(--color-status-caution)";
  return "#1B4F8A";
}

function urgencyBg(days: number): string {
  if (days <= 7) return "var(--color-status-negative-bg)";
  if (days <= 30) return "var(--color-status-caution-bg)";
  return "#F0F9FF";
}

// ─── Composant ────────────────────────────────────────────────────────────────

export async function EcheancesPanel({
  societyId,
  societyIds,
}: {
  societyId?: string;
  societyIds?: string[];
}) {
  const idParam = societyIds ?? societyId ?? "";
  if (!idParam || (Array.isArray(idParam) && idParam.length === 0)) return null;

  const items = await getEcheances(idParam);
  if (items.length === 0) return null;

  const urgent = items.filter((i) => i.daysRemaining <= 30);
  const upcoming = items.filter((i) => i.daysRemaining > 30);

  return (
    <Card className="border-0 shadow-brand bg-white rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-[var(--color-brand-deep)]">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F0F9FF]">
            <CalendarRange className="h-4 w-4 text-[#1B4F8A]" />
          </div>
          Échéances
          <span className="ml-auto inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F0F9FF] text-[#1B4F8A]">
            90 jours
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {urgent.length > 0 && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1 mb-2 mt-1">
              Urgent · &lt;30 jours
            </p>
            {urgent.map((item) => (
              <EcheanceRow key={item.id} item={item} />
            ))}
          </>
        )}
        {upcoming.length > 0 && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1 mb-2 mt-3">
              À venir · 30–90 jours
            </p>
            {upcoming.map((item) => (
              <EcheanceRow key={item.id} item={item} />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EcheanceRow({ item }: { item: EcheanceItem }) {
  const cat = CATEGORY_CONFIG[item.category];
  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 text-sm hover:bg-gray-50 rounded-lg p-2.5 -mx-1 transition-colors"
    >
      {/* Dot catégorie */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ background: cat.bg }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: cat.dot }}
        />
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-[#0C2340]">{item.label}</p>
        <p className="text-xs text-muted-foreground truncate">{item.sublabel}</p>
      </div>

      {/* Badge jours */}
      <span
        className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
        style={{
          color: urgencyColor(item.daysRemaining),
          background: urgencyBg(item.daysRemaining),
        }}
      >
        J-{urgencyLabel(item.daysRemaining)}
      </span>
    </Link>
  );
}
