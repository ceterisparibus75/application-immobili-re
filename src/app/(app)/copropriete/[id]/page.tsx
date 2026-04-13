import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  Landmark, Users, Calendar, ArrowLeft,
  BarChart3, Vote, FileText, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CoproprieteDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/");

  const copro = await prisma.copropriete.findUnique({
    where: { id, societyId },
    include: {
      lots: { orderBy: { lotNumber: "asc" } },
      budgets: { orderBy: { year: "desc" } },
      assemblies: {
        orderBy: { date: "desc" },
        include: {
          resolutions: {
            orderBy: { number: "asc" },
            select: { id: true, number: true, title: true, status: true, majority: true },
          },
        },
      },
      buildings: {
        select: { id: true, name: true },
      },
    },
  });

  if (!copro) notFound();

  const totalAssigned = copro.lots.reduce((s, l) => s + l.tantiemes, 0);
  const remainingTant = copro.totalTantiemes - totalAssigned;

  const MAJORITY_LABELS: Record<string, string> = {
    SIMPLE: "Art. 24",
    ABSOLUE: "Art. 25",
    DOUBLE: "Art. 26",
    UNANIMITE: "Unanimité",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/copropriete" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
            <ArrowLeft className="h-3 w-3" />
            Copropriétés
          </Link>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="h-6 w-6 text-[var(--color-brand-blue)]" />
            {copro.name}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {copro.address}, {copro.postalCode} {copro.city}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{copro.lots.length}</p>
            <p className="text-xs text-muted-foreground">Lots</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{copro.totalTantiemes}</p>
            <p className="text-xs text-muted-foreground">Tantièmes totaux</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{copro.assemblies.length}</p>
            <p className="text-xs text-muted-foreground">Assemblées</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{copro.budgets.length}</p>
            <p className="text-xs text-muted-foreground">Budgets</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lots / Copropriétaires */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Copropriétaires ({copro.lots.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {copro.lots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucun lot enregistré</p>
            ) : (
              <div className="space-y-2">
                {copro.lots.map((lot) => (
                  <div key={lot.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium">Lot {lot.lotNumber} — {lot.ownerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {lot.description ?? ""}
                        {lot.area ? ` · ${lot.area} m²` : ""}
                        {lot.floor ? ` · Étage ${lot.floor}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono tabular-nums font-semibold">{lot.tantiemes}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {((lot.tantiemes / copro.totalTantiemes) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
                {remainingTant > 0 && (
                  <p className="text-xs text-amber-600 text-center pt-2">
                    {remainingTant} tantièmes non attribués ({((remainingTant / copro.totalTantiemes) * 100).toFixed(1)}%)
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assemblées Générales */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Assemblées Générales
            </CardTitle>
          </CardHeader>
          <CardContent>
            {copro.assemblies.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucune AG enregistrée</p>
            ) : (
              <div className="space-y-3">
                {copro.assemblies.map((ag) => (
                  <div key={ag.id} className="p-3 rounded-lg border hover:bg-accent/30 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">{ag.title}</p>
                      <Badge
                        variant={ag.status === "COMPLETED" ? "success" : ag.status === "IN_PROGRESS" ? "default" : "outline"}
                        className="text-[10px]"
                      >
                        {ag.status === "COMPLETED" ? "Terminée" : ag.status === "IN_PROGRESS" ? "En cours" : ag.status === "CONVOCATION_SENT" ? "Convoquée" : "Prévue"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(ag.date)} · {ag.type} {ag.isOnline && "· En ligne"}
                    </p>
                    {ag.resolutions.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {ag.resolutions.map((res) => (
                          <div key={res.id} className="flex items-center gap-2 text-xs">
                            <Vote className="h-3 w-3 text-muted-foreground" />
                            <span className="flex-1 truncate">
                              Rés. {res.number}: {res.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{MAJORITY_LABELS[res.majority]}</span>
                            <Badge
                              variant={res.status === "ADOPTED" ? "success" : res.status === "REJECTED" ? "destructive" : "outline"}
                              className="text-[9px]"
                            >
                              {res.status === "ADOPTED" ? "Adoptée" : res.status === "REJECTED" ? "Rejetée" : res.status === "DEFERRED" ? "Reportée" : "En cours"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budgets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Budgets prévisionnels
          </CardTitle>
        </CardHeader>
        <CardContent>
          {copro.budgets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun budget créé</p>
          ) : (
            <div className="space-y-3">
              {copro.budgets.map((budget) => {
                const lines = (budget.lines as Array<{ category: string; label: string; amount: number }>) ?? [];
                const categories = new Set(lines.map((l) => l.category));

                return (
                  <div key={budget.id} className="p-4 rounded-lg border hover:bg-accent/30 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold">Budget {budget.year}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono tabular-nums font-bold">
                          {formatCurrency(budget.totalAmount)}
                        </span>
                        <Badge
                          variant={budget.status === "APPROVED" ? "success" : budget.status === "DRAFT" ? "outline" : "default"}
                          className="text-[10px]"
                        >
                          {budget.status === "APPROVED" ? "Approuvé" : budget.status === "DRAFT" ? "Brouillon" : budget.status === "SUBMITTED" ? "Soumis" : "Rejeté"}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Array.from(categories).map((cat) => {
                        const catTotal = lines.filter((l) => l.category === cat).reduce((s, l) => s + l.amount, 0);
                        return (
                          <div key={cat} className="text-xs">
                            <span className="text-muted-foreground">{cat}</span>
                            <span className="ml-1 font-mono tabular-nums font-medium">{formatCurrency(catTotal)}</span>
                          </div>
                        );
                      })}
                    </div>
                    {/* Per-lot share */}
                    {budget.status === "APPROVED" && copro.lots.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Appel moyen par lot : {formatCurrency(budget.totalAmount / copro.lots.length)} /an
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Relevés tiers — immeubles liés */}
      {copro.buildings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Relevés tiers (immeubles liés)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {copro.buildings.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border">
                <span className="text-sm font-medium">{b.name}</span>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/patrimoine/immeubles/${b.id}/releves-tiers`}>
                    Relevés tiers
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
