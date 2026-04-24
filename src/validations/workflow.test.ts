import { describe, it, expect } from "vitest";
import { createWorkflowSchema, updateWorkflowSchema } from "./workflow";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";

const validStep = {
  id: "step-1",
  type: "send_email" as const,
  config: { template: "relance" },
};

const validWorkflow = {
  name: "Workflow relance loyer",
  trigger: { type: "event" as const, config: { event: "invoice.overdue" } },
  steps: [validStep],
};

describe("createWorkflowSchema", () => {
  it("accepte un workflow minimal valide", () => {
    expect(createWorkflowSchema.safeParse(validWorkflow).success).toBe(true);
  });

  it("isActive vaut false par défaut", () => {
    const result = createWorkflowSchema.safeParse(validWorkflow);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isActive).toBe(false);
  });

  it("rejette un nom vide", () => {
    const result = createWorkflowSchema.safeParse({ ...validWorkflow, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Nom requis/);
    }
  });

  it("rejette un nom trop long (> 200 chars)", () => {
    const result = createWorkflowSchema.safeParse({ ...validWorkflow, name: "N".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejette un trigger avec type invalide", () => {
    const result = createWorkflowSchema.safeParse({
      ...validWorkflow,
      trigger: { type: "webhook", config: {} },
    });
    expect(result.success).toBe(false);
  });

  it("accepte les trois types de trigger valides", () => {
    for (const type of ["event", "schedule", "manual"] as const) {
      const result = createWorkflowSchema.safeParse({
        ...validWorkflow,
        trigger: { type, config: {} },
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejette si steps est vide", () => {
    const result = createWorkflowSchema.safeParse({ ...validWorkflow, steps: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Au moins une étape requise/);
    }
  });

  it("rejette un step avec type invalide", () => {
    const result = createWorkflowSchema.safeParse({
      ...validWorkflow,
      steps: [{ id: "s1", type: "unknown_action", config: {} }],
    });
    expect(result.success).toBe(false);
  });

  it("accepte tous les types de step valides", () => {
    const stepTypes = [
      "send_email", "send_notification", "update_status", "create_task",
      "delay", "condition", "webhook", "generate_pdf", "send_reminder",
    ] as const;
    for (const type of stepTypes) {
      const result = createWorkflowSchema.safeParse({
        ...validWorkflow,
        steps: [{ id: "s1", type, config: {} }],
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepte un step avec position et connections", () => {
    const result = createWorkflowSchema.safeParse({
      ...validWorkflow,
      steps: [{
        ...validStep,
        position: { x: 100, y: 200 },
        connections: ["step-2"],
      }],
    });
    expect(result.success).toBe(true);
  });

  it("accepte une description optionnelle", () => {
    const result = createWorkflowSchema.safeParse({ ...validWorkflow, description: "Envoi relance automatique" });
    expect(result.success).toBe(true);
  });
});

describe("updateWorkflowSchema", () => {
  it("accepte une mise à jour partielle avec id", () => {
    expect(updateWorkflowSchema.safeParse({ id: VALID_CUID, isActive: true }).success).toBe(true);
  });

  it("rejette si id absent", () => {
    expect(updateWorkflowSchema.safeParse({ isActive: true }).success).toBe(false);
  });

  it("accepte id seul", () => {
    expect(updateWorkflowSchema.safeParse({ id: VALID_CUID }).success).toBe(true);
  });
});
