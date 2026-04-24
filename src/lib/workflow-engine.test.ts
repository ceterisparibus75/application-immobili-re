import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/workflow-engine", async (importOriginal) => {
  return await importOriginal();
});

import { prismaMock } from "@/test/mocks/prisma";
import { executeWorkflowSteps, triggerEventWorkflows } from "./workflow-engine";
import type { WorkflowContext } from "./workflow-engine";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";

const baseCtx: WorkflowContext = {
  societyId: SOCIETY_ID,
  triggeredBy: "user-123",
  event: "invoice.paid",
  entityType: "Invoice",
  entityId: "inv-001",
};

describe("executeWorkflowSteps", () => {
  describe("condition", () => {
    it("évalue eq correctement (vrai)", async () => {
      const results = await executeWorkflowSteps(
        [{ id: "s1", type: "condition", config: { field: "status", operator: "eq", value: "PAID" } }],
        { ...baseCtx, entityData: { status: "PAID" } }
      );
      expect(results[0].status).toBe("success");
      expect(results[0].output).toMatch(/vraie/);
    });

    it("évalue eq correctement (faux)", async () => {
      const results = await executeWorkflowSteps(
        [{ id: "s1", type: "condition", config: { field: "status", operator: "eq", value: "PAID" } }],
        { ...baseCtx, entityData: { status: "PENDING" } }
      );
      expect(results[0].status).toBe("success");
      expect(results[0].output).toMatch(/fausse/);
    });

    it("évalue gt correctement", async () => {
      const results = await executeWorkflowSteps(
        [{ id: "s1", type: "condition", config: { field: "amount", operator: "gt", value: 500 } }],
        { ...baseCtx, entityData: { amount: 1000 } }
      );
      expect(results[0].output).toMatch(/vraie/);
    });

    it("évalue contains correctement", async () => {
      const results = await executeWorkflowSteps(
        [{ id: "s1", type: "condition", config: { field: "label", operator: "contains", value: "loyer" } }],
        { ...baseCtx, entityData: { label: "Paiement loyer janvier" } }
      );
      expect(results[0].output).toMatch(/vraie/);
    });

    it("évalue exists correctement", async () => {
      const results = await executeWorkflowSteps(
        [{ id: "s1", type: "condition", config: { field: "amount", operator: "exists" } }],
        { ...baseCtx, entityData: { amount: 0 } }
      );
      expect(results[0].output).toMatch(/vraie/);
    });
  });

  describe("delay — skipped (exécution synchrone)", () => {
    it("retourne statut skipped", async () => {
      const results = await executeWorkflowSteps(
        [{ id: "s1", type: "delay", config: { duration: 3600 } }],
        baseCtx
      );
      expect(results[0].status).toBe("skipped");
    });
  });

  describe("update_status — skipped", () => {
    it("retourne statut skipped", async () => {
      const results = await executeWorkflowSteps(
        [{ id: "s1", type: "update_status", config: { entity: "Invoice", value: "PAID" } }],
        baseCtx
      );
      expect(results[0].status).toBe("skipped");
    });
  });

  describe("generate_pdf — skipped", () => {
    it("retourne statut skipped", async () => {
      const results = await executeWorkflowSteps(
        [{ id: "s1", type: "generate_pdf", config: {} }],
        baseCtx
      );
      expect(results[0].status).toBe("skipped");
    });
  });

  describe("type inconnu — skipped", () => {
    it("retourne statut skipped avec message", async () => {
      const results = await executeWorkflowSteps(
        [{ id: "s1", type: "fly_to_moon", config: {} }],
        baseCtx
      );
      expect(results[0].status).toBe("skipped");
      expect(results[0].output).toMatch(/inconnu/);
    });
  });

  describe("send_notification", () => {
    it("crée des notifications pour tous les membres", async () => {
      prismaMock.userSociety.findMany.mockResolvedValue([
        { userId: "user-A" },
        { userId: "user-B" },
      ] as never);
      prismaMock.notification.create.mockResolvedValue({} as never);

      const results = await executeWorkflowSteps(
        [{ id: "s1", type: "send_notification", config: { title: "Alerte", message: "Facture payée" } }],
        baseCtx
      );

      expect(results[0].status).toBe("success");
      expect(prismaMock.notification.create).toHaveBeenCalledTimes(2);
      expect(results[0].output).toMatch(/2 notification/);
    });

    it("résout les variables {{societyId}} et {{entityId}} dans le titre", async () => {
      prismaMock.userSociety.findMany.mockResolvedValue([{ userId: "user-A" }] as never);
      prismaMock.notification.create.mockResolvedValue({} as never);

      await executeWorkflowSteps(
        [{ id: "s1", type: "send_notification", config: { title: "Société {{societyId}} entité {{entityId}}", message: "" } }],
        baseCtx
      );

      expect(prismaMock.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: `Société ${SOCIETY_ID} entité inv-001`,
          }),
        })
      );
    });
  });

  describe("send_email", () => {
    it("retourne failed si email invalide", async () => {
      const results = await executeWorkflowSteps(
        [{ id: "s1", type: "send_email", config: { to: "not-an-email", subject: "Test", body: "Corps" } }],
        baseCtx
      );
      expect(results[0].status).toBe("failed");
      expect(results[0].error).toMatch(/invalide/);
    });
  });

  describe("webhook", () => {
    it("retourne failed si URL sans HTTPS", async () => {
      const results = await executeWorkflowSteps(
        [{ id: "s1", type: "webhook", config: { url: "http://example.com", method: "POST" } }],
        baseCtx
      );
      expect(results[0].status).toBe("failed");
      expect(results[0].error).toMatch(/HTTPS/);
    });
  });

  describe("plusieurs étapes", () => {
    it("exécute toutes les étapes et retourne les résultats dans l'ordre", async () => {
      const results = await executeWorkflowSteps(
        [
          { id: "s1", type: "delay", config: { duration: 10 } },
          { id: "s2", type: "condition", config: { field: "x", operator: "eq", value: 1 } },
        ],
        baseCtx
      );
      expect(results).toHaveLength(2);
      expect(results[0].stepId).toBe("s1");
      expect(results[1].stepId).toBe("s2");
    });
  });
});

describe("triggerEventWorkflows", () => {
  it("ne fait rien si aucun workflow ne correspond à l'événement", async () => {
    prismaMock.workflow.findMany.mockResolvedValue([
      { id: "wf-1", trigger: { type: "event", config: { event: "invoice.created" } }, steps: [], isActive: true },
    ] as never);

    await triggerEventWorkflows("invoice.paid", { societyId: SOCIETY_ID });

    expect(prismaMock.workflowRun.create).not.toHaveBeenCalled();
  });

  it("crée un WorkflowRun et le complète si aucune étape", async () => {
    prismaMock.workflow.findMany.mockResolvedValue([
      { id: "wf-2", trigger: { type: "event", config: { event: "invoice.paid" } }, steps: [], isActive: true },
    ] as never);
    prismaMock.workflowRun.create.mockResolvedValue({ id: "run-1" } as never);
    prismaMock.workflowRun.update.mockResolvedValue({} as never);
    prismaMock.workflow.update.mockResolvedValue({} as never);

    await triggerEventWorkflows("invoice.paid", { societyId: SOCIETY_ID });

    expect(prismaMock.workflowRun.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "RUNNING" }) })
    );
    expect(prismaMock.workflowRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) })
    );
  });

  it("ne propage pas les exceptions (mode non-bloquant)", async () => {
    prismaMock.workflow.findMany.mockRejectedValue(new Error("DB down"));

    await expect(triggerEventWorkflows("invoice.paid", { societyId: SOCIETY_ID })).resolves.not.toThrow();
  });
});
