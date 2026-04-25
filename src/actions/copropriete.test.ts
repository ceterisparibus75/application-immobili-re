import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import {
  createCopropriete,
  updateCopropriete,
  deleteCopropriete,
  createCoproLot,
  updateCoproLot,
  deleteCoproLot,
  createCoproBudget,
  approveBudget,
  createAssembly,
  updateAssembly,
  createResolution,
  recordVote,
  closeResolution,
} from "./copropriete";
import { createAuditLog } from "@/lib/audit";

const SOCIETY_ID = "society-1";
const COPRO_ID = "ccopro01234";
const CLOT_ID = "clot0123456";
const ASSEMBLY_ID = "cassembly01";
const RESOLUTION_ID = "cresolut001";
const VOTE_ID = "cvote012345";
const BUDGET_ID = "cbudget0123";

// ─── createCopropriete ────────────────────────────────────────────────────────

describe("createCopropriete", () => {
  const validInput = {
    name: "Résidence Les Pins",
    address: "12 rue des Pins",
    city: "Paris",
    postalCode: "75001",
    totalTantiemes: 1000,
    fiscalYearStart: 1,
  };

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await createCopropriete(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("erreur si role insuffisant (min GESTIONNAIRE requis)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await createCopropriete(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
  });

  it("erreur si champ requis manquant (name vide)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await createCopropriete(SOCIETY_ID, { ...validInput, name: "" });
    expect(r.success).toBe(false);
  });

  it("crée la copropriété et crée un audit log", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.copropriete.create.mockResolvedValue({ id: COPRO_ID } as never);

    const r = await createCopropriete(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    expect(r.data?.id).toBe(COPRO_ID);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE", entity: "Copropriete", entityId: COPRO_ID })
    );
  });
});

// ─── deleteCopropriete ────────────────────────────────────────────────────────

describe("deleteCopropriete", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await deleteCopropriete(SOCIETY_ID, COPRO_ID);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("erreur si role GESTIONNAIRE (min ADMIN_SOCIETE requis)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await deleteCopropriete(SOCIETY_ID, COPRO_ID);
    expect(r.success).toBe(false);
  });

  it("supprime avec succès en tant qu'ADMIN_SOCIETE", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.copropriete.delete.mockResolvedValue({ id: COPRO_ID } as never);

    const r = await deleteCopropriete(SOCIETY_ID, COPRO_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.copropriete.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: COPRO_ID, societyId: SOCIETY_ID } })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE", entity: "Copropriete" })
    );
  });
});

// ─── createCoproLot / deleteCoproLot ─────────────────────────────────────────

describe("createCoproLot", () => {
  const validInput = {
    coproprieteId: COPRO_ID,
    lotNumber: "A12",
    ownerName: "Martin Dupont",
    tantiemes: 150,
  };

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await createCoproLot(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("crée le lot et son audit log", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.coproLot.create.mockResolvedValue({ id: CLOT_ID } as never);

    const r = await createCoproLot(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    expect(r.data?.id).toBe(CLOT_ID);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE", entity: "CoproLot" })
    );
  });
});

describe("deleteCoproLot", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await deleteCoproLot(SOCIETY_ID, CLOT_ID);
    expect(r.success).toBe(false);
  });

  it("supprime avec succès", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.coproLot.delete.mockResolvedValue({ id: CLOT_ID } as never);

    const r = await deleteCoproLot(SOCIETY_ID, CLOT_ID);
    expect(r.success).toBe(true);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE", entity: "CoproLot" })
    );
  });

  it("retourne une erreur si rôle insuffisant pour deleteCoproLot (ForbiddenError lignes 209-211)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await deleteCoproLot(SOCIETY_ID, CLOT_ID);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/insuffisantes|refus/i);
  });
});

// ─── createCoproBudget / approveBudget ────────────────────────────────────────

describe("createCoproBudget", () => {
  const validInput = {
    coproprieteId: COPRO_ID,
    year: 2026,
    totalAmount: 50000,
    lines: [{ category: "charges_communes", label: "Entretien parties communes", amount: 50000 }],
  };

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await createCoproBudget(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
  });

  it("crée le budget avec ses lignes", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.coproBudget.create.mockResolvedValue({ id: BUDGET_ID } as never);

    const r = await createCoproBudget(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    expect(r.data?.id).toBe(BUDGET_ID);
  });

  it("retourne une erreur si rôle insuffisant pour createCoproBudget (ForbiddenError lignes 241-243)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await createCoproBudget(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/insuffisantes|refus/i);
  });
});

describe("approveBudget", () => {
  it("erreur si role GESTIONNAIRE (min ADMIN_SOCIETE requis)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await approveBudget(SOCIETY_ID, BUDGET_ID);
    expect(r.success).toBe(false);
  });

  it("approuve le budget avec le statut APPROVED", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.coproBudget.update.mockResolvedValue({} as never);

    const r = await approveBudget(SOCIETY_ID, BUDGET_ID, ASSEMBLY_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.coproBudget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BUDGET_ID },
        data: expect.objectContaining({ status: "APPROVED", approvedByAssemblyId: ASSEMBLY_ID }),
      })
    );
  });

  it("retourne une erreur générique si la BDD échoue dans approveBudget", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.coproBudget.update.mockRejectedValue(new Error("DB error"));
    const r = await approveBudget(SOCIETY_ID, BUDGET_ID);
    expect(r).toEqual({ success: false, error: "Erreur lors de l'approbation" });
  });
});

// ─── createAssembly / createResolution ───────────────────────────────────────

describe("createAssembly", () => {
  const validInput = {
    coproprieteId: COPRO_ID,
    title: "AG Ordinaire 2026",
    date: "2026-09-15",
    type: "ORDINAIRE" as const,
    isOnline: false,
    quorumRequired: 0.5,
  };

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await createAssembly(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
  });

  it("crée l'AG avec conversion de date", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.coproAssembly.create.mockResolvedValue({ id: ASSEMBLY_ID } as never);

    const r = await createAssembly(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    // La date doit être passée en objet Date
    expect(prismaMock.coproAssembly.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ date: expect.any(Date) }),
      })
    );
  });

  it("retourne une erreur si rôle insuffisant pour createAssembly", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await createAssembly(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans createAssembly", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.coproAssembly.create.mockRejectedValue(new Error("DB error"));
    const r = await createAssembly(SOCIETY_ID, validInput);
    expect(r).toEqual({ success: false, error: "Erreur lors de la création de l'AG" });
  });
});

describe("createResolution", () => {
  const validInput = {
    assemblyId: ASSEMBLY_ID,
    number: 1,
    title: "Approbation des comptes",
    majority: "SIMPLE" as const,
  };

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await createResolution(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
  });

  it("crée la résolution", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.coproResolution.create.mockResolvedValue({ id: RESOLUTION_ID } as never);

    const r = await createResolution(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    expect(r.data?.id).toBe(RESOLUTION_ID);
  });

  it("retourne une erreur si rôle insuffisant pour createResolution", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await createResolution(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans createResolution", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.coproResolution.create.mockRejectedValue(new Error("DB error"));
    const r = await createResolution(SOCIETY_ID, validInput);
    expect(r).toEqual({ success: false, error: "Erreur lors de la création de la résolution" });
  });
});

// ─── recordVote ───────────────────────────────────────────────────────────────

describe("recordVote", () => {
  const validInput = {
    resolutionId: RESOLUTION_ID,
    lotId: CLOT_ID,
    vote: "POUR" as const,
    proxy: false,
  };

  beforeEach(() => {
    prismaMock.coproVote.upsert.mockResolvedValue({ id: VOTE_ID } as never);
    prismaMock.coproVote.findMany.mockResolvedValue([
      { vote: "POUR", lot: { tantiemes: 300 } },
      { vote: "CONTRE", lot: { tantiemes: 200 } },
      { vote: "ABSTENTION", lot: { tantiemes: 100 } },
    ] as never);
    prismaMock.coproResolution.update.mockResolvedValue({} as never);
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await recordVote(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("enregistre le vote et recalcule les totaux en tantiemes", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await recordVote(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    expect(r.data?.id).toBe(VOTE_ID);
    // Les totaux sont calculés à partir des tantiemes de chaque lot
    expect(prismaMock.coproResolution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { votesFor: 300, votesAgainst: 200, abstentions: 100 },
      })
    );
  });

  it("fait un upsert (vote existant remplacé)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    await recordVote(SOCIETY_ID, validInput);
    expect(prismaMock.coproVote.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { resolutionId_lotId: { resolutionId: RESOLUTION_ID, lotId: CLOT_ID } },
      })
    );
  });
});

// ─── closeResolution ──────────────────────────────────────────────────────────

describe("closeResolution", () => {
  const buildResolution = (
    majority: string,
    votesFor: number,
    votesAgainst: number,
    abstentions: number,
    totalTantiemes: number
  ) => ({
    id: RESOLUTION_ID,
    majority,
    votesFor,
    votesAgainst,
    abstentions,
    assembly: { copropriete: { totalTantiemes } },
  });

  beforeEach(() => {
    prismaMock.coproResolution.update.mockResolvedValue({} as never);
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await closeResolution(SOCIETY_ID, RESOLUTION_ID);
    expect(r.success).toBe(false);
  });

  it("erreur si résolution introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.coproResolution.findUnique.mockResolvedValue(null);
    const r = await closeResolution(SOCIETY_ID, RESOLUTION_ID);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Résolution introuvable");
  });

  it("majorité SIMPLE — adoptée si votesFor > votesAgainst", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.coproResolution.findUnique.mockResolvedValue(
      buildResolution("SIMPLE", 60, 40, 0, 1000) as never
    );
    const r = await closeResolution(SOCIETY_ID, RESOLUTION_ID);
    expect(r.success).toBe(true);
    expect(r.data?.status).toBe("ADOPTED");
  });

  it("majorité SIMPLE — rejetée si votesFor < votesAgainst", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.coproResolution.findUnique.mockResolvedValue(
      buildResolution("SIMPLE", 40, 60, 0, 1000) as never
    );
    const r = await closeResolution(SOCIETY_ID, RESOLUTION_ID);
    expect(r.success).toBe(true);
    expect(r.data?.status).toBe("REJECTED");
  });

  it("majorité ABSOLUE — adoptée si votesFor > totalTantiemes / 2", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.coproResolution.findUnique.mockResolvedValue(
      buildResolution("ABSOLUE", 501, 499, 0, 1000) as never
    );
    const r = await closeResolution(SOCIETY_ID, RESOLUTION_ID);
    expect(r.success).toBe(true);
    expect(r.data?.status).toBe("ADOPTED");
  });

  it("majorité DOUBLE — adoptée si votesFor >= totalTantiemes × 2/3", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.coproResolution.findUnique.mockResolvedValue(
      buildResolution("DOUBLE", 667, 333, 0, 1000) as never
    );
    const r = await closeResolution(SOCIETY_ID, RESOLUTION_ID);
    expect(r.success).toBe(true);
    expect(r.data?.status).toBe("ADOPTED");
  });

  it("majorité UNANIMITE — adoptée si votesFor === totalTantiemes", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.coproResolution.findUnique.mockResolvedValue(
      buildResolution("UNANIMITE", 1000, 0, 0, 1000) as never
    );
    const r = await closeResolution(SOCIETY_ID, RESOLUTION_ID);
    expect(r.success).toBe(true);
    expect(r.data?.status).toBe("ADOPTED");
  });

  it("majorité UNANIMITE — rejetée si un tantiemе manque", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.coproResolution.findUnique.mockResolvedValue(
      buildResolution("UNANIMITE", 999, 0, 1, 1000) as never
    );
    const r = await closeResolution(SOCIETY_ID, RESOLUTION_ID);
    expect(r.success).toBe(true);
    expect(r.data?.status).toBe("REJECTED");
  });
});

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";
const VALID_CUID_2 = "clh3x2z4k0001qh8g7z1y2v3t";

// ─── updateCopropriete ────────────────────────────────────────────────────────

describe("updateCopropriete", () => {
  const validUpdate = { id: VALID_CUID, name: "Résidence Modifiée" };

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await updateCopropriete(SOCIETY_ID, validUpdate);
    expect(r.success).toBe(false);
  });

  it("met à jour la copropriété avec succès", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.copropriete.update.mockResolvedValue({ id: VALID_CUID } as never);
    const r = await updateCopropriete(SOCIETY_ID, validUpdate);
    expect(r.success).toBe(true);
    expect(r.data?.id).toBe(VALID_CUID);
    expect(prismaMock.copropriete.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: VALID_CUID, societyId: SOCIETY_ID } })
    );
  });
});

// ─── updateCoproLot ───────────────────────────────────────────────────────────

describe("updateCoproLot", () => {
  const validUpdate = { id: VALID_CUID, ownerName: "Nouveau Proprio" };

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await updateCoproLot(SOCIETY_ID, validUpdate);
    expect(r.success).toBe(false);
  });

  it("met à jour le lot avec succès", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.coproLot.update.mockResolvedValue({ id: VALID_CUID } as never);
    const r = await updateCoproLot(SOCIETY_ID, validUpdate);
    expect(r.success).toBe(true);
    expect(r.data?.id).toBe(VALID_CUID);
  });
});

// ─── updateAssembly ───────────────────────────────────────────────────────────

describe("updateAssembly", () => {
  const validUpdate = { id: VALID_CUID_2, title: "AG Extraordinaire 2025" };

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await updateAssembly(SOCIETY_ID, validUpdate);
    expect(r.success).toBe(false);
  });

  it("met à jour l'assemblée avec succès", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.coproAssembly.update.mockResolvedValue({ id: VALID_CUID_2 } as never);
    const r = await updateAssembly(SOCIETY_ID, validUpdate);
    expect(r.success).toBe(true);
    expect(r.data?.id).toBe(VALID_CUID_2);
  });

  it("retourne une erreur si rôle insuffisant pour updateAssembly", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await updateAssembly(SOCIETY_ID, validUpdate);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans updateAssembly", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.coproAssembly.update.mockRejectedValue(new Error("DB error"));
    const r = await updateAssembly(SOCIETY_ID, validUpdate);
    expect(r).toEqual({ success: false, error: "Erreur lors de la mise à jour" });
  });
});

describe("recordVote — erreurs", () => {
  it("retourne une erreur si rôle insuffisant", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await recordVote(SOCIETY_ID, {
      resolutionId: RESOLUTION_ID,
      lotId: CLOT_ID,
      vote: "POUR",
      proxy: false,
    });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.coproVote.upsert.mockRejectedValue(new Error("DB error"));
    const r = await recordVote(SOCIETY_ID, {
      resolutionId: RESOLUTION_ID,
      lotId: CLOT_ID,
      vote: "POUR",
      proxy: false,
    });
    expect(r).toEqual({ success: false, error: "Erreur lors de l'enregistrement du vote" });
  });
});

describe("closeResolution — erreurs", () => {
  it("retourne une erreur si rôle insuffisant", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await closeResolution(SOCIETY_ID, RESOLUTION_ID);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.coproResolution.findUnique.mockRejectedValue(new Error("DB connection lost"));
    const r = await closeResolution(SOCIETY_ID, RESOLUTION_ID);
    expect(r).toEqual({ success: false, error: "Erreur lors de la clôture" });
  });
});
