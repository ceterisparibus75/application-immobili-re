import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import {
  Workflow, Plus, Play, Clock, Zap, Mail, Bell,
  FileText, ArrowRight, CheckCircle2, XCircle, Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { WorkflowStep, WorkflowTrigger } from "@/validations/workflow";

const TRIGGER_LABELS: Record<string, { label: string; icon: typeof Zap }> = {
  event: { label: "Événement", icon: Zap },
  schedule: { label: "Planifié", icon: Clock },
  manual: { label: "Manuel", icon: Play },
};

const STEP_ICONS: Record<string, typeof Mail> = {
  send_email: Mail,
  send_notification: Bell,
  generate_pdf: FileText,
  delay: Timer,
  send_reminder: Bell,
  update_status: CheckCircle2,
  create_task: Plus,
  condition: ArrowRight,
  webhook: Zap,
};

export default async function WorkflowsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/");

  const workflows = await prisma.workflow.findMany({
    where: { societyId },
    include: {
      runs: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, status: true, createdAt: true, completedAt: true },
      },
    },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
  });

  const activeCount = workflows.filter((w) => w.isActive).length;
  const totalRuns = workflows.reduce((s, w) => s + w.runCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Workflow className="h-6 w-6 text-[var(--color-brand-blue)]" />
            Workflows
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {workflows.length} workflow{workflows.length > 1 ? "s" : ""}
            {activeCount > 0 && ` · ${activeCount} actif${activeCount > 1 ? "s" : ""}`}
            {totalRuns > 0 && ` · ${totalRuns} exécution${totalRuns > 1 ? "s" : ""}`}
          </p>
        </div>
        <Button className="gap-1.5 bg-brand-gradient-soft hover:opacity-90 text-white">
          <Plus className="h-4 w-4" />
          Nouveau workflow
        </Button>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Workflow className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium mb-1">Aucun workflow</p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md text-center">
              Automatisez vos processus : relances, notifications, mises à jour de statut, génération de documents...
            </p>
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" />
              Créer un workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workflows.map((wf) => {
            const trigger = wf.trigger as unknown as WorkflowTrigger;
            const steps = wf.steps as unknown as WorkflowStep[];
            const triggerConfig = TRIGGER_LABELS[trigger.type] ?? TRIGGER_LABELS.manual;
            const TriggerIcon = triggerConfig.icon;

            return (
              <Card key={wf.id} className={cn("hover:shadow-brand-lg transition-shadow", wf.isActive && "border-[var(--color-brand-cyan)]/30")}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {wf.isActive ? (
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-slate-300" />
                      )}
                      {wf.name}
                    </CardTitle>
                    <Badge variant={wf.isActive ? "success" : "outline"} className="text-[10px]">
                      {wf.isActive ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                  {wf.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{wf.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Trigger */}
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-violet-100 text-violet-600">
                      <TriggerIcon className="h-3 w-3" />
                    </div>
                    <span className="text-muted-foreground">Déclencheur :</span>
                    <span className="font-medium">{triggerConfig.label}</span>
                  </div>

                  {/* Steps flow */}
                  <div className="flex items-center gap-1 overflow-x-auto py-1">
                    {steps.slice(0, 5).map((step, i) => {
                      const StepIcon = STEP_ICONS[step.type] ?? Zap;
                      return (
                        <div key={step.id} className="flex items-center gap-1 shrink-0">
                          {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/40" />}
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-accent transition-colors" title={step.type}>
                            <StepIcon className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      );
                    })}
                    {steps.length > 5 && (
                      <span className="text-[10px] text-muted-foreground ml-1">+{steps.length - 5}</span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span className="tabular-nums">{wf.runCount} exécution{wf.runCount > 1 ? "s" : ""}</span>
                    {wf.lastRunAt && (
                      <span>Dernière : {formatDate(wf.lastRunAt)}</span>
                    )}
                  </div>

                  {/* Recent runs */}
                  {wf.runs.length > 0 && (
                    <div className="space-y-1">
                      {wf.runs.map((run) => (
                        <div key={run.id} className="flex items-center gap-2 text-[10px]">
                          {run.status === "COMPLETED" ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          ) : run.status === "FAILED" ? (
                            <XCircle className="h-3 w-3 text-red-500" />
                          ) : (
                            <Timer className="h-3 w-3 text-amber-500 animate-spin" />
                          )}
                          <span className="text-muted-foreground">{formatDate(run.createdAt)}</span>
                          <Badge variant={run.status === "COMPLETED" ? "success" : run.status === "FAILED" ? "destructive" : "outline"} className="text-[8px]">
                            {run.status === "COMPLETED" ? "OK" : run.status === "FAILED" ? "Erreur" : "En cours"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
