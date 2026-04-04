import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getOwnerAnalytics, getClaimableSocieties, getOwnerProfile } from "@/actions/owner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Layers, Euro, AlertTriangle, Landmark, Banknote,
  TrendingUp, Calendar, Wallet,
} from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { ClaimSocietyDialog } from "./_components/claim-society-dialog";
import { OwnerProfileForm } from "./_components/owner-profile-form";
import { ProprietaireTabs } from "./_components/proprietaire-tabs";
import { SocietyCardLink } from "./_components/society-card-link";

export const metadata = { title: "Vue proprietaire" };

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function pct(occupied: number, total: number) {
  if (total === 0) return 0;
  return Math.round((occupied / total) * 100);
}

const LEGAL_FORM_LABELS: Record<string, string> = {
  SCI: "SCI", SARL: "SARL", SAS: "SAS", SA: "SA", SNC: "SNC",
  EURL: "EURL", EI: "EI", SASU: "SASU", GIE: "GIE", AUTRE: "Autre",
};

export default async function ProprietaireDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [result, claimableResult, profileResult] = await Promise.all([
    getOwnerAnalytics(),
    getClaimableSocieties(),
    getOwnerProfile(),
  ]);
  if (!result.success || !result.data) redirect("/login");

  const data = result.data;
  const claimable = claimableResult.success ? (claimableResult.data ?? []) : [];
  const profile = profileResult.success ? profileResult.data : null;

  if (data.totalSocieties === 0 && claimable.length === 0) {
    redirect("/proprietaire/setup");
  }

  const cookieStore = await cookies();
  const activeSocietyId = cookieStore.get("active-society-id")?.value;

  const dashboardContent = (
    <>
      {/* ── KPI principaux ── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-gradient-to-br from-blue-50/80 to-card dark:from-blue-950/20 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Revenus mensuels</span>
            <Euro className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-xl font-bold tabular-nums">{fmt(data.totalMonthRevenue)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Loyers HT : {fmt(data.totalMonthlyRentHT)}</p>
        </div>

        <div className="rounded-xl border bg-gradient-to-br from-emerald-50/80 to-card dark:from-emerald-950/20 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tresorerie</span>
            <Landmark className="h-4 w-4 text-emerald-500" />
          </div>
          <p className={"text-xl font-bold tabular-nums " + (data.totalCash >= 0 ? "" : "text-destructive")}>{fmt(data.totalCash)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">solde consolide des comptes</p>
        </div>

        <div className="rounded-xl border bg-gradient-to-br from-amber-50/80 to-card dark:from-amber-950/20 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Impayes</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className={"text-xl font-bold tabular-nums " + (data.totalOverdue > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-600")}>{fmt(data.totalOverdue)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">en attente de reglement</p>
        </div>

        <div className="rounded-xl border bg-gradient-to-br from-violet-50/80 to-card dark:from-violet-950/20 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              {data.grossYield !== null ? "Rendement brut" : "Occupation"}
            </span>
            <TrendingUp className="h-4 w-4 text-violet-500" />
          </div>
          <p className="text-xl font-bold tabular-nums">
            {data.grossYield !== null ? `${data.grossYield}%` : `${data.occupancyRate}%`}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {data.totalBuildings} immeuble{data.totalBuildings > 1 ? "s" : ""} · {data.totalLots} lots · {data.totalActiveLeases} baux
          </p>
        </div>
      </div>

      {/* ── Contenu principal : 2/3 + 1/3 ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Colonne gauche */}
        <div className="lg:col-span-2 space-y-5">

          {/* Situation de la dette consolidee */}
          {data.totalDebt > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Endettement consolide</CardTitle>
                </div>
                <CardDescription>Capital restant du et mensualites par societe</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Capital restant du</p>
                    <p className="text-lg font-bold tabular-nums">{fmt(data.totalDebt)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Mensualite totale</p>
                    <p className="text-lg font-bold tabular-nums">{fmt(data.totalMonthlyLoanPayment)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">LTV consolide</p>
                    <p className={"text-lg font-bold tabular-nums " + (data.consolidatedLTV !== null && data.consolidatedLTV > 80 ? "text-destructive" : data.consolidatedLTV !== null && data.consolidatedLTV > 60 ? "text-amber-600" : "text-emerald-600")}>
                      {data.consolidatedLTV !== null ? `${data.consolidatedLTV}%` : "—"}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {data.societies.filter((s) => s.totalDebt > 0).map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/30 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                          {s.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-4 tabular-nums text-xs">
                        <span>{fmt(s.totalDebt)}</span>
                        <span className="text-muted-foreground">{fmt(s.monthlyLoanPayment)}/mois</span>
                        <Badge variant={s.ltv !== null && s.ltv > 80 ? "destructive" : s.ltv !== null && s.ltv > 60 ? "warning" : "secondary"} className="text-[10px] min-w-[50px] justify-center">
                          LTV {s.ltv !== null ? `${s.ltv}%` : "—"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tresorerie par societe */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Tresorerie par societe</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.societies.map((s) => {
                const total = data.totalCash || 1;
                const pctBar = Math.max(0, Math.min(100, (s.cashBalance / total) * 100));
                return (
                  <div key={s.id} className="flex items-center gap-3 py-1.5 px-3 rounded-md bg-muted/30">
                    <div className="h-6 w-6 rounded bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                      {s.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm mb-0.5">
                        <span className="font-medium truncate">{s.name}</span>
                        <span className={"tabular-nums font-semibold " + (s.cashBalance < 0 ? "text-destructive" : "")}>{fmt(s.cashBalance)}</span>
                      </div>
                      <div className="h-1 rounded-full bg-secondary">
                        <div className={"h-1 rounded-full " + (s.cashBalance >= 0 ? "bg-emerald-500" : "bg-red-500")} style={{ width: pctBar + "%" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Mes societes */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Mes societes</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.societies.map((s) => {
                const occ = pct(s.occupiedLots, s.lots);
                const isActive = s.id === activeSocietyId;
                return (
                  <SocietyCardLink key={s.id} societyId={s.id}>
                    <Card className={"transition-all hover:shadow-md cursor-pointer h-full " + (isActive ? "border-primary ring-1 ring-primary" : "")}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                              {s.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <CardTitle className="text-sm font-semibold leading-tight">{s.name}</CardTitle>
                              <p className="text-xs text-muted-foreground">{LEGAL_FORM_LABELS[s.legalForm] ?? s.legalForm} · {s.city}</p>
                            </div>
                          </div>
                          {isActive && <Badge variant="default" className="text-[10px]">Actif</Badge>}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div><div className="text-lg font-bold">{s.buildings}</div><div className="text-[10px] text-muted-foreground">immeuble{s.buildings > 1 ? "s" : ""}</div></div>
                          <div><div className="text-lg font-bold">{s.lots}</div><div className="text-[10px] text-muted-foreground">lots</div></div>
                          <div><div className="text-lg font-bold">{s.activeLeases}</div><div className="text-[10px] text-muted-foreground">baux</div></div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Occupation</span>
                            <span className="font-medium">{occ}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-secondary">
                            <div className="h-1.5 rounded-full bg-primary" style={{ width: occ + "%" }} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                          <div>
                            <span className="text-muted-foreground">Revenus</span>
                            <p className="font-semibold tabular-nums">{fmt(s.currentMonthRevenue)}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-muted-foreground">Tresorerie</span>
                            <p className={"font-semibold tabular-nums " + (s.cashBalance < 0 ? "text-destructive" : "")}>{fmt(s.cashBalance)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </SocietyCardLink>
                );
              })}

              <Link href="/societes/nouvelle">
                <Card className="border-dashed transition-all hover:shadow-md cursor-pointer hover:border-primary/50 flex items-center justify-center min-h-[200px]">
                  <CardContent className="flex flex-col items-center gap-2 text-muted-foreground pt-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30">
                      <span className="text-2xl leading-none">+</span>
                    </div>
                    <p className="text-sm">Ajouter une societe</p>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
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

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vue proprietaire</h1>
          <p className="text-muted-foreground">
            Consolidation de {data.totalSocieties} societe{data.totalSocieties > 1 ? "s" : ""}
          </p>
        </div>
        {claimable.length > 0 && <ClaimSocietyDialog societies={claimable} />}
      </div>

      <ProprietaireTabs
        dashboardContent={dashboardContent}
        profileContent={profile ? <OwnerProfileForm profile={profile} /> : null}
      />
    </div>
  );
}
