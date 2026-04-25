import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/workflow-engine", () => ({
  executeWorkflowSteps: vi.fn().mockResolvedValue([]),
}));

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { createWorkflow, updateWorkflow, deleteWorkflow, toggleWorkflow, runWorkflow } from "./workflow";
import { executeWorkflowSteps } from "@/lib/workflow-engine";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const WORKFLOW_ID = "clh3x2z4k0001qh8g7z1y2v3u";
const RUN_ID = "clh3x2z4k0002qh8g7z1y2v3v";

const validStep = {
  id: "step-1",
  type: "send_notification" as const,
  config: { title: "Alerte", message: "Test" },
};

const validInput = {
  name: "Mon workflow",
  trigger: { type: "manual" as const, config: {} },
  steps: [validStep],
  isActive: false,
};

function makeWorkflow(overrides = {}) {
  return {
    id: WORKFLOW_ID,
    societyId: SOCIETY_ID,
    name: "Mon workflow",
    isActive: true,
    steps: [],
    trigger: { type: "manual", config: {} },
    ...overrides,
  };
}

describe("createWorkflow", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await createWorkflow(SOCIETY_ID, validInput);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si validation Zod échoue (nom vide)", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    const result = await createWorkflow(SOCIETY_ID, { ...validInput, name: "" });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si rôle insuffisant pour createWorkflow (min ADMIN_SOCIETE)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await createWorkflow(SOCIETY_ID, validInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans createWorkflow", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.workflow.create.mockRejectedValue(new Error("DB connection lost"));
    const result = await createWorkflow(SOCIETY_ID, validInput);
    expect(result).toEqual({ success: false, error: "Erreur lors de la création" });
  });

  it("retourne une erreur si aucune étape", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    const result = await createWorkflow(SOCIETY_ID, { ...validInput, steps: [] });
    expect(result.success).toBe(false);
  });

  it("crée le workflow avec succès", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.workflow.create.mockResolvedValue(makeWorkflow() as never);

    const result = await createWorkflow(SOCIETY_ID, validInput);
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(WORKFLOW_ID);
    expect(prismaMock.workflow.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ societyId: SOCIETY_ID }) })
    );
  });
});

describe("updateWorkflow", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await updateWorkflow(SOCIETY_ID, { id: WORKFLOW_ID, name: "Nouveau" });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si id invalide (non-CUID)", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    const result = await updateWorkflow(SOCIETY_ID, { id: "not-a-cuid", name: "Test" });
    expect(result.success).toBe(false);
  });

  it("met à jour le workflow avec succès", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.workflow.update.mockResolvedValue(makeWorkflow({ name: "Nouveau" }) as never);

    const result = await updateWorkflow(SOCIETY_ID, { id: WORKFLOW_ID, name: "Nouveau" });
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(WORKFLOW_ID);
  });

  it("met à jour trigger et steps quand fournis (branches if(trigger) + if(steps))", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.workflow.update.mockResolvedValue(makeWorkflow() as never);

    const result = await updateWorkflow(SOCIETY_ID, {
      id: WORKFLOW_ID,
      trigger: { type: "schedule" as const, config: {} },
      steps: [validStep],
    });
    expect(result.success).toBe(true);
  });

  it("retourne une erreur si rôle insuffisant pour updateWorkflow (min ADMIN_SOCIETE)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await updateWorkflow(SOCIETY_ID, { id: WORKFLOW_ID, name: "Test" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans updateWorkflow", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.workflow.update.mockRejectedValue(new Error("DB connection lost"));
    const result = await updateWorkflow(SOCIETY_ID, { id: WORKFLOW_ID, name: "Test" });
    expect(result).toEqual({ success: false, error: "Erreur lors de la mise à jour" });
  });
});

describe("deleteWorkflow", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await deleteWorkflow(SOCIETY_ID, WORKFLOW_ID);
    expect(result.success).toBe(false);
  });

  it("supprime le workflow avec succès", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.workflow.delete.mockResolvedValue(makeWorkflow() as never);

    const result = await deleteWorkflow(SOCIETY_ID, WORKFLOW_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.workflow.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: WORKFLOW_ID, societyId: SOCIETY_ID } })
    );
  });

  it("retourne une erreur si rôle insuffisant pour deleteWorkflow (min ADMIN_SOCIETE)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await deleteWorkflow(SOCIETY_ID, WORKFLOW_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans deleteWorkflow", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.workflow.delete.mockRejectedValue(new Error("DB connection lost"));
    const result = await deleteWorkflow(SOCIETY_ID, WORKFLOW_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors de la suppression" });
  });
});

describe("toggleWorkflow", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await toggleWorkflow(SOCIETY_ID, WORKFLOW_ID, true);
    expect(result.success).toBe(false);
  });

  it("active le workflow avec succès", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.workflow.update.mockResolvedValue(makeWorkflow({ isActive: true }) as never);

    const result = await toggleWorkflow(SOCIETY_ID, WORKFLOW_ID, true);
    expect(result.success).toBe(true);
    expect(prismaMock.workflow.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: true } })
    );
  });

  it("désactive le workflow avec succès", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.workflow.update.mockResolvedValue(makeWorkflow({ isActive: false }) as never);

    const result = await toggleWorkflow(SOCIETY_ID, WORKFLOW_ID, false);
    expect(result.success).toBe(true);
    expect(prismaMock.workflow.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } })
    );
  });

  it("retourne une erreur si rôle insuffisant pour toggleWorkflow (min ADMIN_SOCIETE)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await toggleWorkflow(SOCIETY_ID, WORKFLOW_ID, true);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans toggleWorkflow", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.workflow.update.mockRejectedValue(new Error("DB connection lost"));
    const result = await toggleWorkflow(SOCIETY_ID, WORKFLOW_ID, true);
    expect(result).toEqual({ success: false, error: "Erreur lors du changement d'état" });
  });
});

describe("runWorkflow", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await runWorkflow(SOCIETY_ID, WORKFLOW_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si workflow introuvable", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.workflow.findFirst.mockResolvedValue(null);

    const result = await runWorkflow(SOCIETY_ID, WORKFLOW_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("exécute le workflow et retourne le runId", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.workflow.findFirst.mockResolvedValue(makeWorkflow({ steps: [validStep] }) as never);
    prismaMock.workflowRun.create.mockResolvedValue({ id: RUN_ID } as never);
    prismaMock.workflowRun.update.mockResolvedValue({} as never);
    prismaMock.workflow.update.mockResolvedValue({} as never);

    const result = await runWorkflow(SOCIETY_ID, WORKFLOW_ID);
    expect(result.success).toBe(true);
    expect(result.data?.runId).toBe(RUN_ID);
    expect(executeWorkflowSteps).toHaveBeenCalled();
    expect(prismaMock.workflowRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) })
    );
  });

  it("utilise [] si workflow.steps est null (branche ?? [])", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.workflow.findFirst.mockResolvedValue(makeWorkflow({ steps: null }) as never);
    prismaMock.workflowRun.create.mockResolvedValue({ id: RUN_ID } as never);
    prismaMock.workflowRun.update.mockResolvedValue({} as never);
    prismaMock.workflow.update.mockResolvedValue({} as never);

    const result = await runWorkflow(SOCIETY_ID, WORKFLOW_ID);
    expect(result.success).toBe(true);
    expect(executeWorkflowSteps).toHaveBeenCalledWith([], expect.any(Object));
  });

  it("marque le run comme FAILED si une étape échoue", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.workflow.findFirst.mockResolvedValue(makeWorkflow() as never);
    prismaMock.workflowRun.create.mockResolvedValue({ id: RUN_ID } as never);
    prismaMock.workflowRun.update.mockResolvedValue({} as never);
    prismaMock.workflow.update.mockResolvedValue({} as never);

    vi.mocked(executeWorkflowSteps).mockResolvedValueOnce([
      { stepId: "s1", status: "failed", error: "Erreur réseau" },
    ]);

    const result = await runWorkflow(SOCIETY_ID, WORKFLOW_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.workflowRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) })
    );
  });

  it("retourne une erreur si rôle insuffisant pour runWorkflow (min ADMIN_SOCIETE)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await runWorkflow(SOCIETY_ID, WORKFLOW_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans runWorkflow", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.workflow.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const result = await runWorkflow(SOCIETY_ID, WORKFLOW_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors de l'exécution" });
  });
});
