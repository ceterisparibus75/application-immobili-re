import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeWorkflowSteps } from "@/lib/workflow-engine";
import { verifyCronSecret } from "@/lib/cron-auth";

/**
 * Route CRON : exécute les workflows déclenchés par un planning (trigger.type = "schedule").
 *
 * Planifié via vercel.json :
 * { "crons": [{ "path": "/api/cron/run-workflows", "schedule": "0 * * * *" }] }
 *
 * Protégée par Authorization: Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!verifyCronSecret(authHeader)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const now = new Date();
  let executed = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    // Récupérer tous les workflows actifs de type "schedule"
    const workflows = await prisma.workflow.findMany({
      where: { isActive: true },
    });

    const scheduled = workflows.filter((wf) => {
      const trigger = wf.trigger as { type: string; config?: { cron?: string } };
      return trigger.type === "schedule";
    });

    for (const wf of scheduled) {
      try {
        const trigger = wf.trigger as { type: string; config?: { cron?: string } };
        const cron = trigger.config?.cron;

        // Vérification simpliste : si le cron matche l'heure courante.
        // Pour une implémentation complète, utiliser une lib comme "cron-parser".
        // Ici on exécute tous les workflows planifiés à chaque run du cron.
        if (!cron) continue;

        const run = await prisma.workflowRun.create({
          data: {
            workflowId: wf.id,
            triggeredBy: "system",
            status: "RUNNING",
          },
        });

        const steps = (wf.steps as Array<{ id: string; type: string; config: Record<string, unknown> }>) ?? [];
        const stepResults = await executeWorkflowSteps(steps, {
          societyId: wf.societyId,
          triggeredBy: "system",
          event: "schedule",
        });

        const hasFailed = stepResults.some((r) => r.status === "failed");

        await Promise.all([
          prisma.workflowRun.update({
            where: { id: run.id },
            data: {
              status: hasFailed ? "FAILED" : "COMPLETED",
              completedAt: now,
              stepResults: stepResults as never,
              ...(hasFailed
                ? { error: stepResults.find((r) => r.status === "failed")?.error }
                : {}),
            },
          }),
          prisma.workflow.update({
            where: { id: wf.id },
            data: { lastRunAt: now, runCount: { increment: 1 } },
          }),
        ]);

        if (hasFailed) {
          failed++;
          const errStep = stepResults.find((r) => r.status === "failed");
          if (errors.length < 10) errors.push(`Workflow ${wf.name}: ${errStep?.error}`);
        } else {
          executed++;
        }
      } catch (err) {
        failed++;
        if (errors.length < 10) {
          errors.push(`Workflow ${wf.name}: ${err instanceof Error ? err.message : "Erreur"}`);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      scheduled: scheduled.length,
      executed,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("[cron/run-workflows]", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
