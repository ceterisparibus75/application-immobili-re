import { describe, it, expect } from "vitest";
import {
  createCandidateSchema,
  updateCandidateSchema,
  createPipelineSchema,
  addActivitySchema,
} from "./candidate";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";

const validCandidate = {
  firstName: "Alice",
  lastName: "Martin",
};

describe("createCandidateSchema", () => {
  it("accepte un candidat minimal valide", () => {
    expect(createCandidateSchema.safeParse(validCandidate).success).toBe(true);
  });

  it("accepte un candidat complet", () => {
    const result = createCandidateSchema.safeParse({
      ...validCandidate,
      email: "alice@example.com",
      phone: "0612345678",
      company: "SARL Alice",
      pipelineId: VALID_CUID,
      lotId: VALID_CUID,
      score: 75,
      monthlyIncome: 3000,
      tags: ["solvable", "prioritaire"],
    });
    expect(result.success).toBe(true);
  });

  it("rejette un prénom vide", () => {
    const result = createCandidateSchema.safeParse({ ...validCandidate, firstName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Prénom requis/);
    }
  });

  it("rejette un nom vide", () => {
    const result = createCandidateSchema.safeParse({ ...validCandidate, lastName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Nom requis/);
    }
  });

  it("rejette un email invalide non vide", () => {
    const result = createCandidateSchema.safeParse({ ...validCandidate, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("accepte email comme chaîne vide", () => {
    const result = createCandidateSchema.safeParse({ ...validCandidate, email: "" });
    expect(result.success).toBe(true);
  });

  it("rejette un score < 0", () => {
    const result = createCandidateSchema.safeParse({ ...validCandidate, score: -1 });
    expect(result.success).toBe(false);
  });

  it("rejette un score > 100", () => {
    const result = createCandidateSchema.safeParse({ ...validCandidate, score: 101 });
    expect(result.success).toBe(false);
  });

  it("rejette un score non entier", () => {
    const result = createCandidateSchema.safeParse({ ...validCandidate, score: 75.5 });
    expect(result.success).toBe(false);
  });

  it("accepte score=0 et score=100 (limites)", () => {
    expect(createCandidateSchema.safeParse({ ...validCandidate, score: 0 }).success).toBe(true);
    expect(createCandidateSchema.safeParse({ ...validCandidate, score: 100 }).success).toBe(true);
  });

  it("rejette monthlyIncome négatif", () => {
    const result = createCandidateSchema.safeParse({ ...validCandidate, monthlyIncome: -100 });
    expect(result.success).toBe(false);
  });
});

describe("updateCandidateSchema", () => {
  it("accepte une mise à jour de statut", () => {
    const result = updateCandidateSchema.safeParse({ id: VALID_CUID, status: "DOSSIER_RECEIVED" });
    expect(result.success).toBe(true);
  });

  it("rejette un statut invalide", () => {
    const result = updateCandidateSchema.safeParse({ id: VALID_CUID, status: "ARCHIVE" });
    expect(result.success).toBe(false);
  });

  it("accepte tous les statuts valides", () => {
    const statuses = ["NEW", "CONTACTED", "VISIT_SCHEDULED", "VISIT_DONE",
      "DOSSIER_RECEIVED", "DOSSIER_VALIDATED", "ACCEPTED", "REJECTED", "WITHDRAWN"];
    for (const status of statuses) {
      expect(updateCandidateSchema.safeParse({ id: VALID_CUID, status }).success).toBe(true);
    }
  });

  it("rejette si id absent", () => {
    expect(updateCandidateSchema.safeParse({ status: "ACCEPTED" }).success).toBe(false);
  });
});

describe("createPipelineSchema", () => {
  const validStage = { id: "stage-1", name: "Nouveau", order: 1 };

  it("accepte un pipeline valide", () => {
    const result = createPipelineSchema.safeParse({
      name: "Pipeline Appartements",
      stages: [validStage],
    });
    expect(result.success).toBe(true);
  });

  it("rejette si stages est vide", () => {
    const result = createPipelineSchema.safeParse({ name: "Pipeline", stages: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Au moins une étape requise/);
    }
  });

  it("rejette un nom de pipeline vide", () => {
    const result = createPipelineSchema.safeParse({ name: "", stages: [validStage] });
    expect(result.success).toBe(false);
  });

  it("accepte un stage avec couleur", () => {
    const result = createPipelineSchema.safeParse({
      name: "Pipeline",
      stages: [{ ...validStage, color: "#FF5733" }],
    });
    expect(result.success).toBe(true);
  });
});

describe("addActivitySchema", () => {
  it("accepte une activité valide", () => {
    const result = addActivitySchema.safeParse({
      candidateId: VALID_CUID,
      type: "NOTE",
      content: "Candidat très intéressé",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un type invalide", () => {
    const result = addActivitySchema.safeParse({ candidateId: VALID_CUID, type: "MEETING" });
    expect(result.success).toBe(false);
  });

  it("accepte tous les types d'activité valides", () => {
    const types = ["NOTE", "EMAIL_SENT", "CALL", "VISIT", "DOCUMENT_RECEIVED", "STATUS_CHANGE", "SCORE_UPDATE"];
    for (const type of types) {
      expect(addActivitySchema.safeParse({ candidateId: VALID_CUID, type }).success).toBe(true);
    }
  });

  it("rejette un contenu trop long (> 5000 chars)", () => {
    const result = addActivitySchema.safeParse({
      candidateId: VALID_CUID,
      type: "NOTE",
      content: "X".repeat(5001),
    });
    expect(result.success).toBe(false);
  });
});
