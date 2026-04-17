import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { Users, Plus, UserPlus } from "lucide-react";

export const metadata: Metadata = { title: "Candidatures" };
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  NEW: { label: "Nouveau", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200" },
  CONTACTED: { label: "Contacté", color: "text-cyan-700", bgColor: "bg-cyan-50 border-cyan-200" },
  VISIT_SCHEDULED: { label: "Visite prévue", color: "text-violet-700", bgColor: "bg-violet-50 border-violet-200" },
  VISIT_DONE: { label: "Visite faite", color: "text-indigo-700", bgColor: "bg-indigo-50 border-indigo-200" },
  DOSSIER_RECEIVED: { label: "Dossier reçu", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200" },
  DOSSIER_VALIDATED: { label: "Dossier validé", color: "text-emerald-700", bgColor: "bg-emerald-50 border-emerald-200" },
  ACCEPTED: { label: "Accepté", color: "text-green-700", bgColor: "bg-green-50 border-green-200" },
  REJECTED: { label: "Refusé", color: "text-red-700", bgColor: "bg-red-50 border-red-200" },
  WITHDRAWN: { label: "Désisté", color: "text-slate-700", bgColor: "bg-slate-50 border-slate-200" },
};

// Visual pipeline columns (excludes terminal states from board)
const PIPELINE_STAGES = ["NEW", "CONTACTED", "VISIT_SCHEDULED", "VISIT_DONE", "DOSSIER_RECEIVED", "DOSSIER_VALIDATED", "ACCEPTED"];

export default async function CandidaturesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/");

  const candidates = await prisma.candidate.findMany({
    where: { societyId, status: { notIn: ["REJECTED", "WITHDRAWN"] } },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
  });

  // Group by status
  const grouped = new Map<string, typeof candidates>();
  for (const stage of PIPELINE_STAGES) {
    grouped.set(stage, []);
  }
  for (const c of candidates) {
    const list = grouped.get(c.status);
    if (list) list.push(c);
  }

  // Stats
  const totalActive = candidates.length;
  const avgScore = totalActive > 0
    ? Math.round(candidates.reduce((s, c) => s + (c.score ?? 0), 0) / totalActive)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-[var(--color-brand-blue)]" />
            Pipeline candidatures
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {totalActive} candidature{totalActive > 1 ? "s" : ""} active{totalActive > 1 ? "s" : ""}
            {avgScore > 0 && ` · Score moyen : ${avgScore}/100`}
          </p>
        </div>
        <Button className="gap-1.5 bg-brand-gradient-soft hover:opacity-90 text-white">
          <UserPlus className="h-4 w-4" />
          Nouvelle candidature
        </Button>
      </div>

      {totalActive === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium mb-1">Aucune candidature</p>
            <p className="text-sm text-muted-foreground mb-6">
              Le pipeline de candidatures est vide
            </p>
            <Button className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              Ajouter un candidat
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Pipeline board */
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {PIPELINE_STAGES.map((stage) => {
              const config = STATUS_CONFIG[stage];
              const stageCards = grouped.get(stage) ?? [];

              return (
                <div key={stage} className="w-72 shrink-0">
                  {/* Column header */}
                  <div className={cn("rounded-t-lg px-3 py-2 border-b-2 flex items-center justify-between", config.bgColor)}>
                    <span className={cn("text-sm font-semibold", config.color)}>
                      {config.label}
                    </span>
                    <Badge variant="outline" className="text-[10px] tabular-nums">
                      {stageCards.length}
                    </Badge>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2 mt-2 min-h-[100px]">
                    {stageCards.map((candidate) => {
                      const tags = (candidate.tags as string[]) ?? [];
                      return (
                        <div
                          key={candidate.id}
                          className="rounded-lg border bg-card p-3 shadow-sm hover:shadow-brand transition-shadow cursor-pointer"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-medium">
                                {candidate.firstName} {candidate.lastName}
                              </p>
                              {candidate.company && (
                                <p className="text-xs text-muted-foreground">{candidate.company}</p>
                              )}
                            </div>
                            {candidate.score !== null && (
                              <div className={cn(
                                "text-xs font-bold tabular-nums px-1.5 py-0.5 rounded",
                                candidate.score >= 70 ? "bg-emerald-100 text-emerald-700" :
                                candidate.score >= 40 ? "bg-amber-100 text-amber-700" :
                                "bg-red-100 text-red-700"
                              )}>
                                {candidate.score}
                              </div>
                            )}
                          </div>

                          {candidate.email && (
                            <p className="text-[10px] text-muted-foreground mt-1 truncate">{candidate.email}</p>
                          )}

                          {candidate.source && (
                            <Badge variant="outline" className="text-[9px] mt-1.5">{candidate.source}</Badge>
                          )}

                          {candidate.monthlyIncome && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Revenus : {candidate.monthlyIncome.toLocaleString("fr-FR")} &euro;/mois
                            </p>
                          )}

                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
