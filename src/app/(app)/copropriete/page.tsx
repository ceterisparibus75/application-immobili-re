import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import Link from "next/link";
import { Building2, Plus, Users, Calendar, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function CoproprietePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/");

  const coproprietes = await prisma.copropriete.findMany({
    where: { societyId },
    include: {
      lots: { select: { id: true, tantiemes: true } },
      assemblies: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { date: "desc" },
        take: 1,
        select: { id: true, title: true, date: true, status: true },
      },
      budgets: {
        orderBy: { year: "desc" },
        take: 1,
        select: { id: true, year: true, status: true, totalAmount: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="h-6 w-6 text-[var(--color-brand-blue)]" />
            Copropriétés
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestion des copropriétés, tantièmes, AG et budgets prévisionnels
          </p>
        </div>
        <Link href="/copropriete/nouvelle">
          <Button className="gap-1.5 bg-brand-gradient-soft hover:opacity-90 text-white">
            <Plus className="h-4 w-4" />
            Nouvelle copropriété
          </Button>
        </Link>
      </div>

      {coproprietes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium mb-1">Aucune copropriété</p>
            <p className="text-sm text-muted-foreground mb-6">
              Commencez par créer votre première copropriété
            </p>
            <Link href="/copropriete/nouvelle">
              <Button className="gap-1.5">
                <Plus className="h-4 w-4" />
                Créer une copropriété
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {coproprietes.map((copro) => {
            const totalTantAssigned = copro.lots.reduce((s, l) => s + l.tantiemes, 0);
            const lastAG = copro.assemblies[0];
            const lastBudget = copro.budgets[0];

            return (
              <Link key={copro.id} href={`/copropriete/${copro.id}`}>
                <Card className="hover:shadow-brand-lg transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-[var(--color-brand-blue)]" />
                      {copro.name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {copro.address}, {copro.postalCode} {copro.city}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Lots & tantièmes */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {copro.lots.length} lot{copro.lots.length > 1 ? "s" : ""}
                      </span>
                      <span className="text-xs font-mono tabular-nums">
                        {totalTantAssigned}/{copro.totalTantiemes} tant.
                      </span>
                    </div>

                    {/* Tantièmes progress */}
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-gradient-soft transition-all"
                        style={{ width: `${Math.min(100, (totalTantAssigned / copro.totalTantiemes) * 100)}%` }}
                      />
                    </div>

                    {/* Last AG */}
                    {lastAG && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        AG : {lastAG.title.slice(0, 30)}
                        <Badge variant="outline" className="text-[10px] ml-auto">
                          {lastAG.status === "COMPLETED" ? "Terminée" : lastAG.status === "IN_PROGRESS" ? "En cours" : "Prévue"}
                        </Badge>
                      </div>
                    )}

                    {/* Last Budget */}
                    {lastBudget && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Budget {lastBudget.year}</span>
                        <Badge
                          variant={lastBudget.status === "APPROVED" ? "success" : "outline"}
                          className="text-[10px]"
                        >
                          {lastBudget.status === "APPROVED" ? "Approuvé" : lastBudget.status === "DRAFT" ? "Brouillon" : "Soumis"}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
