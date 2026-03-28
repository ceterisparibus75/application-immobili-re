import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getOwnerAnalytics, getClaimableSocieties, getOwnerProfile } from "@/actions/owner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Layers, Euro, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { ClaimSocietyDialog } from "./_components/claim-society-dialog";
import { OwnerProfileForm } from "./_components/owner-profile-form";
import { ProprietaireTabs } from "./_components/proprietaire-tabs";

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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenus du mois</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{fmt(data.totalMonthRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">toutes societes confondues</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupation</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{pct(data.totalOccupied, data.totalLots)}%</div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-secondary">
              <div className="h-1.5 rounded-full bg-primary" style={{ width: pct(data.totalOccupied, data.totalLots) + "%" }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{data.totalOccupied} / {data.totalLots} lots occupes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Impayes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={"text-2xl font-bold tabular-nums " + (data.totalOverdue > 0 ? "text-destructive" : "text-green-600")}>
              {fmt(data.totalOverdue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">toutes societes confondues</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Patrimoine</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{data.totalBuildings}</div>
            <p className="text-xs text-muted-foreground mt-1">
              immeuble{data.totalBuildings > 1 ? "s" : ""} &middot; {data.totalLots} lots &middot; {data.totalActiveLeases} baux actifs
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Mes societes</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.societies.map((s) => {
            const occ = pct(s.occupiedLots, s.lots);
            const isActive = s.id === activeSocietyId;
            return (
              <Link key={s.id} href="/dashboard">
                <Card className={"transition-all hover:shadow-md cursor-pointer " + (isActive ? "border-primary ring-1 ring-primary" : "")}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                          {s.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <CardTitle className="text-sm font-semibold leading-tight">{s.name}</CardTitle>
                          <p className="text-xs text-muted-foreground">{LEGAL_FORM_LABELS[s.legalForm] ?? s.legalForm} &middot; {s.city}</p>
                        </div>
                      </div>
                      {isActive && <Badge variant="default" className="text-xs">Actif</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-lg font-bold">{s.buildings}</div>
                        <div className="text-xs text-muted-foreground">immeuble{s.buildings > 1 ? "s" : ""}</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold">{s.lots}</div>
                        <div className="text-xs text-muted-foreground">lots</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold">{s.activeLeases}</div>
                        <div className="text-xs text-muted-foreground">baux</div>
                      </div>
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
                    <div className="flex justify-between items-center pt-1 border-t">
                      <div>
                        <div className="text-xs text-muted-foreground">Revenus / mois</div>
                        <div className="text-sm font-semibold tabular-nums">{fmt(s.currentMonthRevenue)}</div>
                      </div>
                      {s.overdueAmount > 0 && (
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Impayes</div>
                          <div className="text-sm font-semibold text-destructive tabular-nums">{fmt(s.overdueAmount)}</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
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
    </>
  );

  return (
    <div className="space-y-6">
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
