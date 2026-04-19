/**
 * Moteur d'exécution des workflows.
 *
 * Chaque étape (step) est exécutée synchroniquement et son résultat stocké
 * dans WorkflowRun.stepResults. Les types d'étapes supportés :
 *   - send_notification  → crée une Notification in-app
 *   - send_email         → envoi via Resend (format texte simple)
 *   - webhook            → appel HTTP POST/GET externe
 *   - condition          → évalue une condition simple sur le contexte
 *   - delay              → enregistré comme "skipped" (exécution async non supportée ici)
 *   - update_status      → log seulement (la mutation cible est trop générique)
 *   - generate_pdf       → log seulement
 *   - create_task        → log seulement
 *   - send_reminder      → alias de send_notification
 */

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email";

export type WorkflowContext = {
  societyId: string;
  triggeredBy?: string;        // userId ou "system"
  event?: string;              // ex: "invoice.created"
  entityType?: string;         // ex: "Invoice"
  entityId?: string;
  entityData?: Record<string, unknown>;
};

type StepConfig = Record<string, unknown>;

type WorkflowStep = {
  id: string;
  type: string;
  config: StepConfig;
};

type StepResult = {
  stepId: string;
  status: "success" | "failed" | "skipped";
  output?: string;
  error?: string;
  duration?: number;
};

// ─── Résolution de templates simples ─────────────────────────────────────────

function resolveTemplate(template: string, ctx: WorkflowContext): string {
  return template
    .replace(/\{\{societyId\}\}/g, ctx.societyId)
    .replace(/\{\{entityId\}\}/g, ctx.entityId ?? "")
    .replace(/\{\{entityType\}\}/g, ctx.entityType ?? "")
    .replace(/\{\{event\}\}/g, ctx.event ?? "")
    .replace(/\{\{triggeredBy\}\}/g, ctx.triggeredBy ?? "system");
}

// ─── Handlers par type d'étape ────────────────────────────────────────────────

async function handleSendNotification(
  config: StepConfig,
  ctx: WorkflowContext
): Promise<{ output: string }> {
  const title = resolveTemplate(String(config.title ?? "Notification workflow"), ctx);
  const message = resolveTemplate(String(config.message ?? ""), ctx);

  // Récupérer les membres de la société pour diffusion
  const memberships = await prisma.userSociety.findMany({
    where: { societyId: ctx.societyId },
    select: { userId: true },
  });

  const targetUserId = config.targetUserId
    ? String(config.targetUserId)
    : null;

  const targets = targetUserId
    ? [{ userId: targetUserId }]
    : memberships;

  for (const m of targets) {
    await prisma.notification.create({
      data: {
        societyId: ctx.societyId,
        userId: m.userId,
        type: "MAINTENANCE_COMPLETED", // type générique pour les notifications workflow
        title: title.slice(0, 255),
        message: message.slice(0, 1000),
        link: config.link ? resolveTemplate(String(config.link), ctx) : null,
      },
    });
  }

  return { output: `${targets.length} notification(s) créée(s)` };
}

async function handleSendEmail(
  config: StepConfig,
  ctx: WorkflowContext
): Promise<{ output: string }> {
  const to = resolveTemplate(String(config.to ?? ""), ctx);
  if (!to || !to.includes("@")) throw new Error("Email destinataire invalide");

  const subject = resolveTemplate(String(config.subject ?? "Notification"), ctx);
  const body = resolveTemplate(String(config.body ?? ""), ctx);

  await sendMail(to, subject, body);
  return { output: `Email envoyé à ${to}` };
}

async function handleWebhook(
  config: StepConfig,
  ctx: WorkflowContext
): Promise<{ output: string }> {
  const url = resolveTemplate(String(config.url ?? ""), ctx);
  if (!url.startsWith("https://")) throw new Error("URL webhook invalide (HTTPS requis)");

  const method = String(config.method ?? "POST").toUpperCase();
  const bodyTemplate = config.body ? resolveTemplate(String(config.body), ctx) : null;

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: bodyTemplate ?? JSON.stringify({ event: ctx.event, entityId: ctx.entityId }),
    signal: AbortSignal.timeout(10_000), // 10s max
  });

  if (!res.ok) throw new Error(`Webhook HTTP ${res.status}`);
  return { output: `Webhook ${method} ${url} → ${res.status}` };
}

function handleCondition(config: StepConfig, ctx: WorkflowContext): boolean {
  const field = String(config.field ?? "");
  const operator = String(config.operator ?? "eq");
  const expected = config.value;
  const actual = ctx.entityData?.[field];

  switch (operator) {
    case "eq": return actual === expected;
    case "neq": return actual !== expected;
    case "gt": return Number(actual) > Number(expected);
    case "lt": return Number(actual) < Number(expected);
    case "contains": return String(actual).includes(String(expected));
    case "exists": return actual !== undefined && actual !== null;
    default: return false;
  }
}

// ─── Exécuteur principal ──────────────────────────────────────────────────────

export async function executeWorkflowSteps(
  steps: WorkflowStep[],
  ctx: WorkflowContext
): Promise<StepResult[]> {
  const results: StepResult[] = [];

  for (const step of steps) {
    const start = Date.now();
    try {
      let output = "";

      switch (step.type) {
        case "send_notification":
        case "send_reminder": {
          const r = await handleSendNotification(step.config, ctx);
          output = r.output;
          break;
        }
        case "send_email": {
          const r = await handleSendEmail(step.config, ctx);
          output = r.output;
          break;
        }
        case "webhook": {
          const r = await handleWebhook(step.config, ctx);
          output = r.output;
          break;
        }
        case "condition": {
          const passed = handleCondition(step.config, ctx);
          output = `Condition ${passed ? "vraie" : "fausse"}`;
          break;
        }
        case "delay":
          // L'exécution synchrone ne peut pas réellement attendre
          output = `Délai ignoré (exécution synchrone)`;
          results.push({ stepId: step.id, status: "skipped", output, duration: 0 });
          continue;
        case "update_status":
          output = `update_status non implémenté (cible: ${step.config.entity ?? "?"}/${step.config.value ?? "?"})`;
          results.push({ stepId: step.id, status: "skipped", output, duration: 0 });
          continue;
        case "generate_pdf":
          output = "generate_pdf non implémenté";
          results.push({ stepId: step.id, status: "skipped", output, duration: 0 });
          continue;
        case "create_task":
          output = "create_task non implémenté";
          results.push({ stepId: step.id, status: "skipped", output, duration: 0 });
          continue;
        default:
          output = `Type d'étape inconnu : ${step.type}`;
          results.push({ stepId: step.id, status: "skipped", output, duration: 0 });
          continue;
      }

      results.push({
        stepId: step.id,
        status: "success",
        output,
        duration: Date.now() - start,
      });
    } catch (err) {
      results.push({
        stepId: step.id,
        status: "failed",
        error: err instanceof Error ? err.message : "Erreur inconnue",
        duration: Date.now() - start,
      });
    }
  }

  return results;
}

// ─── Déclenchement par événement ─────────────────────────────────────────────

/**
 * Recherche et exécute tous les workflows actifs de la société déclenchés
 * par l'événement donné. À appeler en mode non-bloquant (void) depuis
 * les server actions critiques.
 *
 * @example
 *   void triggerEventWorkflows("invoice.paid", { societyId, entityId: invoice.id, entityData: { amount: invoice.total } })
 */
export async function triggerEventWorkflows(
  event: string,
  ctx: Omit<WorkflowContext, "event">
): Promise<void> {
  try {
    const workflows = await prisma.workflow.findMany({
      where: { societyId: ctx.societyId, isActive: true },
    });

    const matching = workflows.filter((wf) => {
      const trigger = wf.trigger as { type: string; config?: { event?: string } };
      return trigger.type === "event" && trigger.config?.event === event;
    });

    if (matching.length === 0) return;

    for (const wf of matching) {
      const run = await prisma.workflowRun.create({
        data: {
          workflowId: wf.id,
          triggeredBy: ctx.triggeredBy ?? "system",
          status: "RUNNING",
        },
      });

      const steps = (wf.steps as WorkflowStep[]) ?? [];
      const fullCtx: WorkflowContext = { ...ctx, event };
      const stepResults = await executeWorkflowSteps(steps, fullCtx);

      const hasFailed = stepResults.some((r) => r.status === "failed");

      await Promise.all([
        prisma.workflowRun.update({
          where: { id: run.id },
          data: {
            status: hasFailed ? "FAILED" : "COMPLETED",
            completedAt: new Date(),
            stepResults: stepResults as never,
            ...(hasFailed
              ? { error: stepResults.find((r) => r.status === "failed")?.error }
              : {}),
          },
        }),
        prisma.workflow.update({
          where: { id: wf.id },
          data: { lastRunAt: new Date(), runCount: { increment: 1 } },
        }),
      ]);
    }
  } catch (err) {
    console.error("[triggerEventWorkflows]", event, err);
  }
}
