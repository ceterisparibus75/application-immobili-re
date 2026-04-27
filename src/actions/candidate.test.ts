import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/plan-limits", () => ({ checkSubscriptionActive: vi.fn().mockResolvedValue({ active: true }) }));

import {
  createCandidate,
  updateCandidate,
  deleteCandidate,
  addActivity,
  createPipeline,
  convertCandidateToTenant,
} from "./candidate";
import { createAuditLog } from "@/lib/audit";

const SOCIETY_ID = "society-1";
const CANDIDATE_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const PIPELINE_ID = "clh3x2z4k0001qh8g7z1y2v3u";
const STAGE_ID = "stage-new";

// ─── createPipeline ───────────────────────────────────────────────────────────

describe("createPipeline", () => {
  const validInput = {
    name: "Pipeline Appartements",
    stages: [{ id: STAGE_ID, name: "Nouveau", order: 0, color: "#2563eb" }],
  };

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await createPipeline(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("erreur si role LECTURE (min GESTIONNAIRE requis)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await createPipeline(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toContain("Permissions");
  });

  it("crée un pipeline avec succès", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.candidatePipeline.create.mockResolvedValue({
      id: PIPELINE_ID,
      name: "Pipeline Appartements",
      stages: validInput.stages,
      societyId: SOCIETY_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const r = await createPipeline(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    expect(r.data?.id).toBe(PIPELINE_ID);
  });

  it("retourne une erreur générique si la BDD échoue dans createPipeline", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.candidatePipeline.create.mockRejectedValue(new Error("DB connection lost"));
    const r = await createPipeline(SOCIETY_ID, validInput);
    expect(r).toEqual({ success: false, error: "Erreur lors de la création" });
  });

  it("retourne une erreur si validation Zod échoue (stages vides) — ligne 33", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await createPipeline(SOCIETY_ID, { name: "Test", stages: [] });
    expect(r.success).toBe(false);
  });
});

// ─── createCandidate ──────────────────────────────────────────────────────────

describe("createCandidate", () => {
  const validInput = {
    pipelineId: PIPELINE_ID,
    firstName: "Marie",
    lastName: "Dupont",
    email: "marie.dupont@example.com",
    phone: "0612345678",
    stageId: STAGE_ID,
    monthlyIncome: 3000,
  };

  beforeEach(() => {
    prismaMock.candidate.create.mockResolvedValue({
      id: CANDIDATE_ID,
      societyId: SOCIETY_ID,
      ...validInput,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    prismaMock.candidateActivity.create.mockResolvedValue({ id: "act-1" } as never);
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await createCandidate(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("erreur si role LECTURE (min GESTIONNAIRE requis)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await createCandidate(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
  });

  it("erreur si firstName manquant", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await createCandidate(SOCIETY_ID, { ...validInput, firstName: "" });
    expect(r.success).toBe(false);
  });

  it("erreur si email invalide", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await createCandidate(SOCIETY_ID, { ...validInput, email: "pas-un-email" });
    expect(r.success).toBe(false);
  });

  it("crée un candidat et son activité initiale", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await createCandidate(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    expect(r.data?.id).toBe(CANDIDATE_ID);
    // Vérifie que l'activité initiale est créée
    expect(prismaMock.candidateActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "STATUS_CHANGE", content: "Candidature créée" }),
      })
    );
    // Vérifie l'audit log
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE", entity: "Candidate" })
    );
  });

  it("retourne une erreur si rôle insuffisant pour createCandidate", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await createCandidate(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans createCandidate", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.candidate.create.mockRejectedValue(new Error("DB connection lost"));
    const r = await createCandidate(SOCIETY_ID, validInput);
    expect(r).toEqual({ success: false, error: "Erreur lors de la création" });
  });

  it("convertit desiredMoveIn en Date si fourni (ligne 63 branche true)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.candidate.create.mockResolvedValue({ id: CANDIDATE_ID } as never);
    prismaMock.candidateActivity.create.mockResolvedValue({ id: "act-1" } as never);

    const r = await createCandidate(SOCIETY_ID, { ...validInput, desiredMoveIn: "2026-09-01" });

    expect(r.success).toBe(true);
    expect(prismaMock.candidate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ desiredMoveIn: new Date("2026-09-01") }),
      })
    );
  });
});

// ─── updateCandidate ──────────────────────────────────────────────────────────

describe("updateCandidate", () => {
  const validInput = { id: CANDIDATE_ID, status: "CONTACTED" as const };

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await updateCandidate(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("crée une activité de changement de statut", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.candidate.findUnique.mockResolvedValue({
      id: CANDIDATE_ID,
      status: "NEW",
    } as never);
    prismaMock.candidateActivity.create.mockResolvedValue({ id: "act-2" } as never);
    prismaMock.candidate.update.mockResolvedValue({
      id: CANDIDATE_ID,
      status: "CONTACTED",
    } as never);

    const r = await updateCandidate(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    // Une activité STATUS_CHANGE doit être créée car le statut a changé
    expect(prismaMock.candidateActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "STATUS_CHANGE" }),
      })
    );
  });

  it("ne crée pas d'activité si le statut ne change pas", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.candidate.findUnique.mockResolvedValue({
      id: CANDIDATE_ID,
      status: "CONTACTED",
    } as never);
    prismaMock.candidate.update.mockResolvedValue({ id: CANDIDATE_ID } as never);

    const r = await updateCandidate(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    expect(prismaMock.candidateActivity.create).not.toHaveBeenCalled();
  });

  it("retourne une erreur si rôle insuffisant pour updateCandidate", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await updateCandidate(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans updateCandidate", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.candidate.findUnique.mockRejectedValue(new Error("DB connection lost"));
    const r = await updateCandidate(SOCIETY_ID, validInput);
    expect(r).toEqual({ success: false, error: "Erreur lors de la mise à jour" });
  });

  it("retourne une erreur si validation Zod échoue (id invalide) — ligne 106", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await updateCandidate(SOCIETY_ID, { id: "not-a-cuid", status: "CONTACTED" });
    expect(r.success).toBe(false);
  });

  it("convertit desiredMoveIn en Date si fourni dans updateCandidate (ligne 111 branche true)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.candidate.findUnique.mockResolvedValue({ id: CANDIDATE_ID, status: "CONTACTED" } as never);
    prismaMock.candidate.update.mockResolvedValue({ id: CANDIDATE_ID } as never);

    const r = await updateCandidate(SOCIETY_ID, { id: CANDIDATE_ID, desiredMoveIn: "2026-10-01" });

    expect(r.success).toBe(true);
    expect(prismaMock.candidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ desiredMoveIn: new Date("2026-10-01") }),
      })
    );
  });
});

// ─── deleteCandidate ──────────────────────────────────────────────────────────

describe("deleteCandidate", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await deleteCandidate(SOCIETY_ID, CANDIDATE_ID);
    expect(r.success).toBe(false);
  });

  it("erreur si role GESTIONNAIRE (min ADMIN_SOCIETE requis)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await deleteCandidate(SOCIETY_ID, CANDIDATE_ID);
    expect(r.success).toBe(false);
    expect(r.error).toContain("Permissions");
  });

  it("supprime avec succès en tant qu'ADMIN_SOCIETE", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.candidate.delete.mockResolvedValue({ id: CANDIDATE_ID } as never);

    const r = await deleteCandidate(SOCIETY_ID, CANDIDATE_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.candidate.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CANDIDATE_ID, societyId: SOCIETY_ID } })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE", entity: "Candidate", entityId: CANDIDATE_ID })
    );
  });

  it("retourne une erreur générique si la BDD échoue dans deleteCandidate", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.candidate.delete.mockRejectedValue(new Error("DB error"));
    const r = await deleteCandidate(SOCIETY_ID, CANDIDATE_ID);
    expect(r).toEqual({ success: false, error: "Erreur lors de la suppression" });
  });
});

// ─── convertCandidateToTenant ────────────────────────────────────────────────

describe("convertCandidateToTenant", () => {
  const candidate = {
    id: CANDIDATE_ID,
    societyId: SOCIETY_ID,
    firstName: "Marie",
    lastName: "Dupont",
    email: "marie.dupont@example.com",
    phone: "0612345678",
    company: null,
    status: "DOSSIER_VALIDATED",
    score: 82,
    source: "SeLoger",
    monthlyIncome: 3600,
    guarantorName: "Paul Dupont",
    notes: "Dossier complet",
  };

  beforeEach(() => {
    prismaMock.candidate.findFirst.mockResolvedValue(candidate as never);
    prismaMock.tenant.findFirst.mockResolvedValue(null as never);
    prismaMock.tenant.create.mockResolvedValue({ id: "tenant-1" } as never);
    prismaMock.contact.create.mockResolvedValue({ id: "contact-1" } as never);
    prismaMock.candidate.update.mockResolvedValue({ id: CANDIDATE_ID } as never);
    prismaMock.candidateActivity.create.mockResolvedValue({ id: "act-convert" } as never);
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock) as never);
  });

  it("crée un locataire depuis une candidature validée", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);

    const r = await convertCandidateToTenant(SOCIETY_ID, CANDIDATE_ID);

    expect(r.success).toBe(true);
    expect(r.data?.tenantId).toBe("tenant-1");
    expect(prismaMock.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          societyId: SOCIETY_ID,
          entityType: "PERSONNE_PHYSIQUE",
          firstName: "Marie",
          lastName: "Dupont",
          email: "marie.dupont@example.com",
          riskIndicator: "VERT",
        }),
      })
    );
    expect(prismaMock.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contactType: "LOCATAIRE", tenantId: "tenant-1" }),
      })
    );
    expect(prismaMock.candidate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACCEPTED" } })
    );
  });

  it("bloque la conversion si l'email est absent", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.candidate.findFirst.mockResolvedValue({ ...candidate, email: null } as never);

    const r = await convertCandidateToTenant(SOCIETY_ID, CANDIDATE_ID);

    expect(r.success).toBe(false);
    expect(r.error).toBe("Email requis pour créer le locataire");
    expect(prismaMock.tenant.create).not.toHaveBeenCalled();
  });
});

// ─── addActivity ──────────────────────────────────────────────────────────────

describe("addActivity", () => {
  const validInput = {
    candidateId: CANDIDATE_ID,
    type: "NOTE" as const,
    content: "Premier contact téléphonique",
  };

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await addActivity(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
  });

  it("erreur si role LECTURE (min GESTIONNAIRE requis)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await addActivity(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
  });

  it("crée l'activité avec l'userId de la session", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.candidateActivity.create.mockResolvedValue({ id: "act-3" } as never);

    const r = await addActivity(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    expect(r.data?.id).toBe("act-3");
    expect(prismaMock.candidateActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1", type: "NOTE" }),
      })
    );
  });

  it("retourne une erreur générique si la BDD échoue dans addActivity", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.candidateActivity.create.mockRejectedValue(new Error("DB error"));
    const r = await addActivity(SOCIETY_ID, validInput);
    expect(r).toEqual({ success: false, error: "Erreur lors de l'ajout" });
  });

  it("retourne une erreur si validation Zod échoue (candidateId invalide) — ligne 189", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await addActivity(SOCIETY_ID, { candidateId: "not-a-cuid", type: "NOTE" });
    expect(r.success).toBe(false);
  });
});
