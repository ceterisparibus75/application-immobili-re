import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getOwnerAnalytics, getClaimableSocieties, getOwnerProfile } from "@/actions/owner";
import { getProprietaires, migrateOwnerToProprietaire } from "@/actions/proprietaire";
import { getSocieties } from "@/actions/society";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2, Layers, AlertTriangle, Landmark, Banknote,
  TrendingUp, Calendar, Wallet, Plus,
} from "lucide-react";
import Link from "next/link";
import { ROLE_LABELS } from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma/client";
import { ClaimSocietyDialog } from "./_components/claim-society-dialog";
import { OwnerProfileForm } from "./_components/owner-profile-form";
import { ProprietaireTabs } from "./_components/proprietaire-tabs";
import { ProprietaireSelector } from "./_components/proprietaire-selector";

export const metadata = { title: "Vue proprietaire" };

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function pct(occupied: number, total: number) {
  if (total === 0) return 0;
  return Math.round((occupied / total) * 100);
}

export default async function ProprietaireDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ pid?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Migration automatique : si l'utilisateur n'a pas de proprietaire, en créer un
  const propList = await getProprietaires();
  if (propList.success && (!propList.data || propList.data.length === 0)) {
    await migrateOwnerToProprietaire();
  }

  const params = await searchParams;
  const selectedPid = params.pid;

  const [propResult, claimableResult, profileResult, societies] = await Promise.all([
    getProprietaires(),
    getClaimableSocieties(),
    getOwnerProfile(),
    getSocieties(),
  ]);

  const proprietaires = propResult.success ? (propResult.data ?? []) : [];
  const activePid = selectedPid && proprietaires.find((p) => p.id === selectedPid)
    ? selectedPid
    : proprietaires[0]?.id ?? null;

  // Charger les analytics pour le proprietaire sélectionné
  const result = await getOwnerAnalytics(activePid ?? undefined);
  if (!result.success || !result.data) redirect("/login");

  const data = result.data;
  const claimable = claimableResult.success ? (claimableResult.data ?? []) : [];
  const profile = profileResult.success ? profileResult.data : null;

  if (data.totalSocieties === 0 && claimable.length === 0 && proprietaires.length === 0) {
    redirect("/proprietaire/setup");
  }

  const dashboardContent = (
    <>
      {/* KPI principaux */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-xl border bg-border/50 overflow-hidden">
        <div className="bg-card p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Revenus mensuels</p>
          <p className="text-xl font-bold tabular-nums">{fmt(data.totalMonthRevenue)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Loyers HT : {fmt(data.totalMonthlyRentHT)}</p>
        </div>
        <div className="bg-card p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Trésorerie</p>
          <p className={"text-xl font-bold tabular-nums " + (data.totalCash < 0 ? "text-destructive" : "")}>{fmt(data.totalCash)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{data.totalSocieties} société{data.totalSocieties > 1 ? "s" : ""}</p>
        </div>
        <div className="bg-card p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Impayés</p>
          <p className={"text-xl font-bold tabular-nums " + (data.totalOverdue > 0 ? "text-destructive" : "")}>{fmt(data.totalOverdue)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">en attente de règlement</p>
        </div>
        <div className="bg-card p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
            {data.grossYield !== null ? "Rendement brut" : "Occupation"}
          </p>
          <p className="text-xl font-bold tabular-nums">
            {data.grossYield !== null ? `${data.grossYield}%` : `${data.occupancyRate}%`}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {data.totalBuildings} immeuble{data.totalBuildings > 1 ? "s" : ""} · {data.totalLots} lots · {data.totalActiveLeases} baux
          </p>
        </div>
      </div>

      {/* Contenu principal : 2/3 + 1/3 */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Colonne gauche */}
        <div className="lg:col-span-2 space-y-5">

          {/* Situation de la dette consolidee */}
          {data.totalDebt > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Endettement consolidé</CardTitle>
                </div>
                <CardDescription>Capital restant dû et mensualités</CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-0">
                <div className="grid grid-cols-3 gap-px bg-border/50">
                  <div className="bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-1">Capital restant dû</p>
                    <p className="text-lg font-bold tabular-nums text-destructive">{fmt(data.totalDebt)}</p>
                  </div>
                  <div className="bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-1">Mensualité totale</p>
                    <p className="text-lg font-bold tabular-nums">{fmt(data.totalMonthlyLoanPayment)}</p>
                  </div>
                  <div className="bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-1">LTV consolidé</p>
                    <p className={"text-lg font-bold tabular-nums " + (data.consolidatedLTV !== null && data.consolidatedLTV > 80 ? "text-destructive" : data.consolidatedLTV !== null && data.consolidatedLTV > 60 ? "text-amber-600" : "text-emerald-600")}>
                      {data.consolidatedLTV !== null ? `${data.consolidatedLTV}%` : "—"}
                    </p>
                  </div>
                </div>

                {data.lenderSummaries.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y bg-muted/30">
                        <th className="text-left py-2 px-4 font-medium text-muted-foreground">Établissement</th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">Emprunts</th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">Restant dû</th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">Mensualité</th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">Remboursé</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lenderSummaries.map((ls) => (
                        <tr key={ls.lender} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-2.5 px-4 font-medium">{ls.lender}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums">{ls.loanCount}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-destructive font-semibold">{fmt(ls.remainingBalance)}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums">{fmt(ls.monthlyPayment)}</td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-14 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-primary" style={{ width: ls.pctRepaid + "%" }} />
                              </div>
                              <span className="tabular-nums text-xs text-muted-foreground w-8 text-right">{ls.pctRepaid}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {data.societies.filter((s) => s.totalDebt > 0).length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y bg-muted/30">
                        <th className="text-left py-2 px-4 font-medium text-muted-foreground">Société</th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">Restant dû</th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">Mensualité</th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">LTV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.societies.filter((s) => s.totalDebt > 0).map((s) => (
                        <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                                {s.name.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="font-medium">{s.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums font-semibold">{fmt(s.totalDebt)}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">{fmt(s.monthlyLoanPayment)}/mois</td>
                          <td className="py-2.5 px-4 text-right">
                            <Badge variant={s.ltv !== null && s.ltv > 80 ? "destructive" : s.ltv !== null && s.ltv > 60 ? "warning" : "secondary"} className="text-[10px] min-w-[50px] justify-center">
                              {s.ltv !== null ? `${s.ltv}%` : "—"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tresorerie par societe */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Trésorerie par société</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Société</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">Solde</th>
                    <th className="py-2 px-4 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.societies.map((s) => {
                    const total = Math.abs(data.totalCash) || 1;
                    const pctBar = Math.max(0, Math.min(100, (Math.abs(s.cashBalance) / total) * 100));
                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                              {s.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-medium truncate">{s.name}</span>
                          </div>
                        </td>
                        <td className={"py-2.5 px-4 text-right tabular-nums font-semibold " + (s.cashBalance < 0 ? "text-destructive" : "")}>
                          {fmt(s.cashBalance)}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div className={"h-full rounded-full " + (s.cashBalance >= 0 ? "bg-emerald-500" : "bg-red-500")} style={{ width: pctBar + "%" }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 font-semibold">
                    <td className="py-2.5 px-4 text-muted-foreground">Total</td>
                    <td className={"py-2.5 px-4 text-right tabular-nums " + (data.totalCash < 0 ? "text-destructive" : "")}>{fmt(data.totalCash)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>

        </div>

        {/* Colonne droite : panneaux de suivi */}
        <div className="space-y-5">
          {/* Occupation consolidee */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Occupation</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center">
                <p className="text-3xl font-bold tabular-nums">{data.occupancyRate}%</p>
                <p className="text-xs text-muted-foreground">{data.totalOccupied} / {data.totalLots} lots occupes</p>
                <div className="mt-2 h-2 rounded-full bg-secondary">
                  <div className="h-2 rounded-full bg-emerald-500" style={{ width: data.occupancyRate + "%" }} />
                </div>
              </div>
              <div className="space-y-1.5 pt-2 border-t">
                {data.societies.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/30">
                    <span className="truncate">{s.name}</span>
                    <span className="font-semibold tabular-nums shrink-0 ml-2">{pct(s.occupiedLots, s.lots)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Impayes par anciennete */}
          {data.totalOverdue > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Impayes par anciennete</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.overdueByAge.map((bucket) => (
                  <div key={bucket.label} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40 text-sm">
                    <span>{bucket.label}</span>
                    <span className={"font-semibold tabular-nums " + (bucket.amount > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                      {fmt(bucket.amount)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-destructive/10 text-sm font-bold border-t">
                  <span>Total</span>
                  <span className="tabular-nums text-destructive">{fmt(data.totalOverdue)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Baux expirant */}
          {data.expiringLeases.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Baux expirant sous 90j</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.expiringLeases.map((l) => (
                  <div key={l.id} className="rounded-md bg-muted/30 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{l.tenantName}</p>
                      <Badge variant={l.daysLeft <= 30 ? "destructive" : "warning"} className="text-[10px] shrink-0 ml-2">
                        {l.daysLeft}j
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{l.lotLabel} · {l.societyName}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Synthese financiere */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Synthese financiere</CardTitle>
              <CardDescription>Consolide toutes societes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40 text-sm">
                <span>Loyers mensuels HT</span>
                <span className="font-semibold tabular-nums">{fmt(data.totalMonthlyRentHT)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40 text-sm">
                <span>Charges recuperables</span>
                <span className="font-semibold tabular-nums">{fmt(data.totalRecoverableCharges)}</span>
              </div>
              {data.totalDebt > 0 && (
                <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40 text-sm">
                  <span>Mensualites emprunts</span>
                  <span className="font-semibold tabular-nums text-amber-600">{fmt(data.totalMonthlyLoanPayment)}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40 text-sm border-t">
                <span>Tresorerie nette</span>
                <span className={"font-bold tabular-nums " + (data.totalCash >= 0 ? "text-emerald-600" : "text-destructive")}>{fmt(data.totalCash)}</span>
              </div>
              {data.grossYield !== null && (
                <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40 text-sm">
                  <span>Rendement brut</span>
                  <span className="font-semibold tabular-nums">{data.grossYield}%</span>
                </div>
              )}
              {data.consolidatedLTV !== null && (
                <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40 text-sm">
                  <span>LTV consolide</span>
                  <span className={"font-semibold tabular-nums " + (data.consolidatedLTV > 80 ? "text-destructive" : data.consolidatedLTV > 60 ? "text-amber-600" : "text-emerald-600")}>
                    {data.consolidatedLTV}%
                  </span>
                </div>
              )}
              {data.totalPatrimonyValue > 0 && (
                <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40 text-sm">
                  <span>Valeur patrimoine</span>
                  <span className="font-semibold tabular-nums">{fmt(data.totalPatrimonyValue)}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40 text-sm">
                <span>Taux occupation</span>
                <span className="font-semibold tabular-nums">{data.occupancyRate}%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );

  const societiesContent = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {societies.length} société{societies.length > 1 ? "s" : ""}
        </p>
        <Link href={`/societes/nouvelle${activePid ? `?proprietaireId=${activePid}` : ""}`}>
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Nouvelle société
          </Button>
        </Link>
      </div>

      {societies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune société</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Créez votre première société propriétaire pour commencer à gérer votre patrimoine immobilier.
            </p>
            <Link href={`/societes/nouvelle${activePid ? `?proprietaireId=${activePid}` : ""}`}>
              <Button>
                <Plus className="h-4 w-4" />
                Créer une société
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {societies.map((society) => (
            <Link key={society.id} href={`/societes/${society.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{society.name}</CardTitle>
                    <Badge variant={society.isActive ? "success" : "secondary"}>
                      {society.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription>
                    {society.legalForm} &bull; {society.siret}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{society.city}</span>
                    <Badge variant="outline">
                      {ROLE_LABELS[society.role as UserRole]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Propriétaire</h1>
            <p className="text-sm text-muted-foreground">
              {data.totalSocieties} société{data.totalSocieties > 1 ? "s" : ""} · {data.totalBuildings} immeuble{data.totalBuildings > 1 ? "s" : ""} · {data.totalLots} lots
            </p>
          </div>
          <ProprietaireSelector
            proprietaires={proprietaires.map((p) => ({
              id: p.id,
              label: p.label,
              societyCount: p.societyCount,
            }))}
            activeId={activePid}
          />
        </div>
        <div className="flex items-center gap-2">
          {claimable.length > 0 && <ClaimSocietyDialog societies={claimable} />}
        </div>
      </div>

      <ProprietaireTabs
        dashboardContent={dashboardContent}
        profileContent={profile ? <OwnerProfileForm profile={profile} /> : null}
        societiesContent={societiesContent}
      />
    </div>
  );
}
