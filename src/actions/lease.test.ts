import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers"
import {
  createLease,
  updateLease,
  deleteLease,
  getLeases,
  getLeaseById,
  getLeaseFinancialSummary,
  getLeaseDocuments,
  createRentSteps,
  updateRentStep,
  deleteRentStep,
  getRentSteps,
} from "@/actions/lease"
import type { CreateLeaseInput } from "@/validations/lease"
import { UserRole } from "@/generated/prisma/client"
import { prismaMock } from "@/test/mocks/prisma"
import { buildTenantPhysique } from "@/test/factories"
import { checkSubscriptionActive } from "@/lib/plan-limits"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t"
const VALID_CUID2 = "clh3x2z4k0001qh8g7z1y2v3u"
const validLeaseInput = { lotIds: [VALID_CUID], tenantId: VALID_CUID2, leaseType: "COMMERCIAL_369" as const, startDate: "2024-01-01", durationMonths: 108, baseRentHT: 1500, depositAmount: 3000, paymentFrequency: "MENSUEL" as const, vatApplicable: true, vatRate: 20, billingTerm: "A_ECHOIR" as const, revisionFrequency: 12, rentFreeMonths: 0, entryFee: 0 } as unknown as CreateLeaseInput

describe("createLease", () => {
  it("erreur si non authentifie", async () => { mockUnauthenticated(); const r = await createLease("society-1", validLeaseInput); expect(r.success).toBe(false); expect(r.error).toBe("Non authentifié") })
  it("erreur si role LECTURE", async () => { mockAuthSession(UserRole.LECTURE); const r = await createLease("society-1", validLeaseInput); expect(r.success).toBe(false); expect(r.error).toBe("Permissions insuffisantes pour cette action") })
  it("erreur si role COMPTABLE", async () => { mockAuthSession(UserRole.COMPTABLE); const r = await createLease("society-1", validLeaseInput); expect(r.success).toBe(false); expect(r.error).toBe("Permissions insuffisantes pour cette action") })
  it("erreur si lotIds contient un id invalide", async () => { mockAuthSession(UserRole.GESTIONNAIRE); const r = await createLease("society-1", { ...validLeaseInput, lotIds: ["not-a-cuid"] } as unknown as CreateLeaseInput); expect(r.success).toBe(false) })
  it("erreur si startDate manquante", async () => { mockAuthSession(UserRole.GESTIONNAIRE); const r = await createLease("society-1", { ...validLeaseInput, startDate: "" } as unknown as CreateLeaseInput); expect(r.success).toBe(false) })
  it("erreur si baseRentHT negatif", async () => { mockAuthSession(UserRole.GESTIONNAIRE); const r = await createLease("society-1", { ...validLeaseInput, baseRentHT: -100 } as unknown as CreateLeaseInput); expect(r.success).toBe(false) })
  it("erreur si lot introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lot.findMany.mockResolvedValue([])
    prismaMock.tenant.findFirst.mockResolvedValue(buildTenantPhysique({ id: VALID_CUID2 }) as never)
    const r = await createLease("society-1", validLeaseInput)
    expect(r.success).toBe(false); expect(r.error).toContain("introuvable")
  })
  it("erreur si locataire introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lot.findMany.mockResolvedValue([{ id: VALID_CUID, buildingId: "b1" }] as never)
    prismaMock.tenant.findFirst.mockResolvedValue(null)
    const r = await createLease("society-1", validLeaseInput)
    expect(r.success).toBe(false); expect(r.error).toContain("Locataire introuvable")
  })
  it("erreur si lot a deja un bail actif", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lot.findMany.mockResolvedValue([{ id: VALID_CUID, buildingId: "b1" }] as never)
    prismaMock.tenant.findFirst.mockResolvedValue(buildTenantPhysique({ id: VALID_CUID2 }) as never)
    prismaMock.leaseLot.findMany.mockResolvedValue([{ id: "ll-1", lotId: VALID_CUID, lot: { number: "101" } }] as never)
    const r = await createLease("society-1", validLeaseInput)
    expect(r.success).toBe(false); expect(r.error).toContain("bail actif")
  })
  it("cree un bail avec succes", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lot.findMany.mockResolvedValue([{ id: VALID_CUID, buildingId: "b1" }] as never)
    prismaMock.tenant.findFirst.mockResolvedValue(buildTenantPhysique({ id: VALID_CUID2 }) as never)
    prismaMock.leaseLot.findMany.mockResolvedValue([])
    prismaMock.lease.create.mockResolvedValue({ id: "lease-new" } as never)
    prismaMock.lot.updateMany.mockResolvedValue({ count: 1 } as never)
    prismaMock.lot.update.mockResolvedValue({} as never)
    const r = await createLease("society-1", validLeaseInput)
    expect(r.success).toBe(true); expect(r.data?.id).toBe("lease-new")
  })
  it("met tous les lots en OCCUPE", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lot.findMany.mockResolvedValue([{ id: VALID_CUID, buildingId: "b1" }] as never)
    prismaMock.tenant.findFirst.mockResolvedValue(buildTenantPhysique({ id: VALID_CUID2 }) as never)
    prismaMock.leaseLot.findMany.mockResolvedValue([])
    prismaMock.lease.create.mockResolvedValue({ id: "lease-new" } as never)
    prismaMock.lot.updateMany.mockResolvedValue({ count: 1 } as never)
    prismaMock.lot.update.mockResolvedValue({} as never)
    await createLease("society-1", validLeaseInput)
    expect(prismaMock.lot.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [VALID_CUID] } }, data: expect.objectContaining({ status: "OCCUPE" }) }))
  })
  it("retourne une erreur si l'abonnement est inactif (ligne 32)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    vi.mocked(checkSubscriptionActive).mockResolvedValueOnce({ active: false, message: "Abonnement expiré" } as never)
    const r = await createLease("society-1", validLeaseInput)
    expect(r.success).toBe(false)
    expect(r.error).toContain("Abonnement")
  })

  it("retourne une erreur générique si la BDD échoue dans createLease", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lot.findMany.mockRejectedValue(new Error("DB connection lost"))
    const r = await createLease("society-1", validLeaseInput)
    expect(r).toEqual({ success: false, error: "Erreur lors de la création du bail" })
  })

  it("ne remet pas le compteur à 1 si leaseNumberYear est l'année courante (branche if(year) false)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lot.findMany.mockResolvedValue([{ id: VALID_CUID, buildingId: "b1" }] as never)
    prismaMock.tenant.findFirst.mockResolvedValue(buildTenantPhysique({ id: VALID_CUID2 }) as never)
    prismaMock.leaseLot.findMany.mockResolvedValue([])
    prismaMock.society.findUnique.mockResolvedValue({
      leasePrefix: "BAIL",
      nextLeaseNumber: 5,
      leaseNumberYear: new Date().getFullYear(),
    } as never)
    prismaMock.society.update.mockResolvedValue({} as never)
    prismaMock.lease.create.mockResolvedValue({ id: "lease-year" } as never)
    prismaMock.lot.updateMany.mockResolvedValue({ count: 1 } as never)
    prismaMock.lot.update.mockResolvedValue({} as never)
    const r = await createLease("society-1", validLeaseInput)
    expect(r.success).toBe(true)
    expect(prismaMock.society.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nextLeaseNumber: 6 }) })
    )
  })

  it("billingTerm undefined → ?? 'A_ECHOIR' (ligne 102 right), isThirdPartyManaged true → ?? false left (ligne 115)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lot.findMany.mockResolvedValue([{ id: VALID_CUID, buildingId: "b1" }] as never)
    prismaMock.tenant.findFirst.mockResolvedValue(buildTenantPhysique({ id: VALID_CUID2 }) as never)
    prismaMock.leaseLot.findMany.mockResolvedValue([])
    prismaMock.society.findUnique.mockResolvedValue({
      leasePrefix: "BAIL",
      nextLeaseNumber: 3,
      leaseNumberYear: new Date().getFullYear(),
    } as never)
    prismaMock.society.update.mockResolvedValue({} as never)
    prismaMock.lease.create.mockResolvedValue({ id: "lease-branch" } as never)
    prismaMock.lot.updateMany.mockResolvedValue({ count: 1 } as never)
    prismaMock.lot.update.mockResolvedValue({} as never)
    const input = { ...validLeaseInput, billingTerm: undefined, isThirdPartyManaged: true } as unknown as typeof validLeaseInput
    const r = await createLease("society-1", input)
    expect(r.success).toBe(true)
    expect(prismaMock.lease.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ billingTerm: "A_ECHOIR", isThirdPartyManaged: true }),
      })
    )
  })
})

describe("updateLease", () => {
  it("erreur si non authentifie", async () => {
    mockUnauthenticated()
    const r = await updateLease("society-1", { id: VALID_CUID })
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })
  it("erreur si bail introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue(null)
    const r = await updateLease("society-1", { id: VALID_CUID, status: "RESILIE" })
    expect(r.success).toBe(false)
    expect(r.error).toBe("Bail introuvable")
  })
  it("resiliation met tous les lots en VACANT", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue({ id: VALID_CUID, societyId: "society-1", lotId: "lot-1", status: "EN_COURS" } as never)
    prismaMock.leaseLot.findMany.mockResolvedValue([{ lotId: "lot-1" }, { lotId: "lot-2" }] as never)
    prismaMock.lot.updateMany.mockResolvedValue({ count: 2 } as never)
    prismaMock.lease.update.mockResolvedValue({} as never)
    const r = await updateLease("society-1", { id: VALID_CUID, status: "RESILIE" })
    expect(r.success).toBe(true)
    expect(prismaMock.lot.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ["lot-1", "lot-2"] } },
      data: expect.objectContaining({ status: "VACANT", currentRent: null })
    }))
  })
  it("ne touche pas les lots si deja resilie", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue({ id: VALID_CUID, societyId: "society-1", lotId: "lot-1", status: "RESILIE" } as never)
    prismaMock.lease.update.mockResolvedValue({} as never)
    const r = await updateLease("society-1", { id: VALID_CUID, status: "RESILIE" })
    expect(r.success).toBe(true)
    expect(prismaMock.lot.updateMany).not.toHaveBeenCalled()
  })
  it("met a jour le loyer", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue({ id: VALID_CUID, societyId: "society-1", lotId: "lot-1", status: "EN_COURS" } as never)
    prismaMock.lease.update.mockResolvedValue({} as never)
    const r = await updateLease("society-1", { id: VALID_CUID, currentRentHT: 2000 })
    expect(r.success).toBe(true)
    expect(prismaMock.lease.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: VALID_CUID },
      data: expect.objectContaining({ currentRentHT: 2000 })
    }))
  })
  it("erreur Zod si id n'est pas un CUID valide pour updateLease", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await updateLease("society-1", { id: "not-a-cuid" })
    expect(r.success).toBe(false)
  })
  it("erreur si role LECTURE pour updateLease (min GESTIONNAIRE requis)", async () => {
    mockAuthSession(UserRole.LECTURE)
    const r = await updateLease("society-1", { id: VALID_CUID, status: "RESILIE" })
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/insuffisantes|refus/i)
  })
  it("retourne une erreur générique si la BDD échoue dans updateLease", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockRejectedValue(new Error("DB connection lost"))
    const r = await updateLease("society-1", { id: VALID_CUID, status: "RESILIE" })
    expect(r).toEqual({ success: false, error: "Erreur lors de la mise à jour" })
  })

  it("met à jour entryDate, exitDate, startDate, endDate quand fournis (branches if(date) lines 198-201)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue({ id: VALID_CUID, societyId: "society-1", status: "EN_COURS" } as never)
    prismaMock.lease.update.mockResolvedValue({} as never)
    const r = await updateLease("society-1", {
      id: VALID_CUID,
      entryDate: "2024-01-15",
      exitDate: "2024-12-31",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    })
    expect(r.success).toBe(true)
    expect(prismaMock.lease.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entryDate: new Date("2024-01-15"),
          exitDate: new Date("2024-12-31"),
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-12-31"),
        }),
      })
    )
  })

  it("entryDate null et exitDate null → false branch ternaire → null (lignes 198-199)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue({ id: VALID_CUID, societyId: "society-1", status: "EN_COURS" } as never)
    prismaMock.lease.update.mockResolvedValue({} as never)
    const r = await updateLease("society-1", { id: VALID_CUID, entryDate: null, exitDate: null })
    expect(r.success).toBe(true)
    expect(prismaMock.lease.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entryDate: null, exitDate: null }),
      })
    )
  })

  it("résiliation sans lots (if(lotIds.length > 0) false branch, ligne 211)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue({ id: VALID_CUID, societyId: "society-1", status: "EN_COURS" } as never)
    prismaMock.leaseLot.findMany.mockResolvedValue([])
    prismaMock.lease.update.mockResolvedValue({} as never)
    const r = await updateLease("society-1", { id: VALID_CUID, status: "RESILIE" })
    expect(r.success).toBe(true)
    expect(prismaMock.lot.updateMany).not.toHaveBeenCalled()
  })
})

describe("deleteLease", () => {
  it("erreur si non authentifie", async () => {
    mockUnauthenticated()
    const r = await deleteLease("society-1", VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })
  it("erreur si role GESTIONNAIRE (minimum ADMIN_SOCIETE)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await deleteLease("society-1", VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Permissions insuffisantes pour cette action")
  })
  it("erreur si bail introuvable", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.lease.findFirst.mockResolvedValue(null)
    const r = await deleteLease("society-1", VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Bail introuvable")
  })
  it("erreur si bail en cours", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.lease.findFirst.mockResolvedValue({ id: VALID_CUID, status: "EN_COURS", lotId: "lot-1", leaseLots: [{ lotId: "lot-1" }] } as never)
    const r = await deleteLease("society-1", VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toContain("bail en cours")
  })
  it("archive un bail resilie avec succes", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.lease.findFirst.mockResolvedValue({ id: VALID_CUID, status: "RESILIE", lotId: "lot-1", leaseLots: [{ lotId: "lot-1" }] } as never)
    prismaMock.lease.update.mockResolvedValue({} as never)
    prismaMock.leaseLot.count.mockResolvedValue(0)
    prismaMock.lot.update.mockResolvedValue({} as never)
    const r = await deleteLease("society-1", VALID_CUID)
    expect(r.success).toBe(true)
    expect(prismaMock.lease.update).toHaveBeenCalledWith({
      where: { id: VALID_CUID },
      data: expect.objectContaining({
        deletedAt: expect.any(Date),
        deletedBy: "user-1",
        archivedReason: "Suppression utilisateur",
      }),
    })
  })
  it("remet le lot en VACANT si plus de bail actif", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.lease.findFirst.mockResolvedValue({ id: VALID_CUID, status: "RESILIE", lotId: "lot-1", leaseLots: [{ lotId: "lot-1" }] } as never)
    prismaMock.lease.update.mockResolvedValue({} as never)
    prismaMock.leaseLot.count.mockResolvedValue(0)
    prismaMock.lot.update.mockResolvedValue({} as never)
    await deleteLease("society-1", VALID_CUID)
    expect(prismaMock.lot.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "lot-1" },
      data: expect.objectContaining({ status: "VACANT" })
    }))
  })
  it("ne touche pas le lot si autres baux actifs", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.lease.findFirst.mockResolvedValue({ id: VALID_CUID, status: "RESILIE", lotId: "lot-1", leaseLots: [{ lotId: "lot-1" }] } as never)
    prismaMock.lease.update.mockResolvedValue({} as never)
    prismaMock.leaseLot.count.mockResolvedValue(1)
    await deleteLease("society-1", VALID_CUID)
    expect(prismaMock.lot.update).not.toHaveBeenCalled()
  })
  it("retourne une erreur générique si la BDD échoue dans deleteLease", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.lease.findFirst.mockRejectedValue(new Error("DB connection lost"))
    const r = await deleteLease("society-1", VALID_CUID)
    expect(r).toEqual({ success: false, error: "Erreur lors de la suppression du bail" })
  })
})

const SOCIETY_ID = "society-1";
const LEASE_ID = VALID_CUID;
const STEP_ID = "clh3x2z4k0002qh8g7z1y2v3v";

// ── getLeases ─────────────────────────────────────────────────────

describe("getLeases", () => {
  it("retourne [] si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getLeases(SOCIETY_ID);
    expect(result).toEqual([]);
  });

  it("retourne la liste des baux", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.lease.findMany.mockResolvedValue([{ id: LEASE_ID }] as never);
    const result = await getLeases(SOCIETY_ID);
    expect(result).toHaveLength(1);
  });
});

// ── getLeaseById ──────────────────────────────────────────────────

describe("getLeaseById", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getLeaseById(SOCIETY_ID, LEASE_ID);
    expect(result).toBeNull();
  });

  it("retourne le bail si trouvé", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.lease.findFirst.mockResolvedValue({ id: LEASE_ID } as never);
    const result = await getLeaseById(SOCIETY_ID, LEASE_ID);
    expect(result?.id).toBe(LEASE_ID);
  });
});

// ── getLeaseFinancialSummary ──────────────────────────────────────

describe("getLeaseFinancialSummary", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getLeaseFinancialSummary(SOCIETY_ID, LEASE_ID);
    expect(result).toBeNull();
  });

  it("calcule les totaux avec paiement partiel sur une facture impayée (ligne 538)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.invoice.findMany.mockResolvedValue([
      { id: "inv-1", totalHT: 800, totalTTC: 800, status: "EN_RETARD", payments: [{ amount: 300 }] },
    ] as never);
    const result = await getLeaseFinancialSummary(SOCIETY_ID, LEASE_ID);
    expect(result?.totalImpaye).toBe(500);
  });

  it("calcule les totaux correctement", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.invoice.findMany.mockResolvedValue([
      { id: "inv-1", totalHT: 800, totalTTC: 800, status: "EN_RETARD", payments: [] },
      { id: "inv-2", totalHT: 800, totalTTC: 800, status: "PAYE", payments: [{ amount: 800 }] },
    ] as never);

    const result = await getLeaseFinancialSummary(SOCIETY_ID, LEASE_ID);
    expect(result?.nbFactures).toBe(2);
    expect(result?.totalFactureTTC).toBe(1600);
    expect(result?.totalEncaisse).toBe(800);
    expect(result?.totalImpaye).toBe(800);
    expect(result?.nbImpayees).toBe(1);
  });
});

// ── getLeaseDocuments ─────────────────────────────────────────────

describe("getLeaseDocuments", () => {
  it("retourne [] si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getLeaseDocuments(SOCIETY_ID, LEASE_ID);
    expect(result).toEqual([]);
  });

  it("retourne les documents du bail", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.lease.findFirst.mockResolvedValue({ tenantId: "tenant-1" } as never);
    prismaMock.document.findMany.mockResolvedValue([{ id: "doc-1" }] as never);
    const result = await getLeaseDocuments(SOCIETY_ID, LEASE_ID);
    expect(result).toHaveLength(1);
    expect(prismaMock.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { leaseId: LEASE_ID },
            expect.objectContaining({
              leaseId: null,
              tenantId: "tenant-1",
              category: { in: ["bail", "avenant", "etat_des_lieux"] },
            }),
          ]),
        }),
      })
    );
  });
});

// ── createRentSteps ───────────────────────────────────────────────

describe("createRentSteps", () => {
  const validInput = {
    leaseId: LEASE_ID,
    steps: [{ label: "Palier 1", startDate: "2024-06-01", endDate: null, rentHT: 1500, chargesHT: null }],
  };

  beforeEach(() => {
    mockAuthSession(UserRole.GESTIONNAIRE);
  });

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await createRentSteps(SOCIETY_ID, validInput);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur Zod si leaseId n'est pas un CUID valide", async () => {
    const result = await createRentSteps(SOCIETY_ID, { ...validInput, leaseId: "not-a-cuid" });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si le bail est introuvable", async () => {
    prismaMock.lease.findFirst.mockResolvedValue(null);
    const result = await createRentSteps(SOCIETY_ID, validInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("retourne une erreur si un palier commence avant le bail", async () => {
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID,
      startDate: new Date("2024-07-01"),
      endDate: null,
    } as never);

    const result = await createRentSteps(SOCIETY_ID, validInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("avant le début du bail");
  });

  it("retourne une erreur si un palier commence après la fin du bail", async () => {
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-03-31"),
    } as never);
    const result = await createRentSteps(SOCIETY_ID, validInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("après la fin du bail");
  });

  it("retourne une erreur si un palier se termine après la fin du bail", async () => {
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-12-31"),
    } as never);
    const stepWithLateEnd = {
      leaseId: LEASE_ID,
      steps: [{ label: "Palier 1", startDate: "2024-03-01", endDate: "2025-02-01", rentHT: 1500, chargesHT: null }],
    };
    const result = await createRentSteps(SOCIETY_ID, stepWithLateEnd);
    expect(result.success).toBe(false);
    expect(result.error).toContain("se termine après la fin du bail");
  });

  it("crée les paliers avec succès", async () => {
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID,
      startDate: new Date("2024-01-01"),
      endDate: null,
    } as never);
    prismaMock.leaseRentStep.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.leaseRentStep.createMany.mockResolvedValue({ count: 1 });

    const result = await createRentSteps(SOCIETY_ID, validInput);
    expect(result.success).toBe(true);
    expect(result.data?.count).toBe(1);
  });

  it("trie les paliers avant validation avec 2 paliers (ligne 597)", async () => {
    prismaMock.lease.findFirst.mockResolvedValue({ id: LEASE_ID, startDate: new Date("2024-01-01"), endDate: null } as never);
    prismaMock.leaseRentStep.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.leaseRentStep.createMany.mockResolvedValue({ count: 2 });
    const result = await createRentSteps(SOCIETY_ID, {
      leaseId: LEASE_ID,
      steps: [
        { label: "Palier B", startDate: "2024-06-01", endDate: null, rentHT: 1600, chargesHT: null },
        { label: "Palier A", startDate: "2024-03-01", endDate: "2024-05-31", rentHT: 1500, chargesHT: null },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.data?.count).toBe(2);
  });

  it("retourne une erreur générique si la BDD échoue dans createRentSteps", async () => {
    prismaMock.lease.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const result = await createRentSteps(SOCIETY_ID, validInput);
    expect(result).toEqual({ success: false, error: "Erreur lors de la création des paliers" });
  });

  it("retourne une erreur si rôle insuffisant pour createRentSteps (min GESTIONNAIRE)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const result = await createRentSteps(SOCIETY_ID, validInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("crée les paliers avec endDate non-null (branche endDate ? new Date : null true arm)", async () => {
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-12-31"),
    } as never);
    prismaMock.leaseRentStep.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.leaseRentStep.createMany.mockResolvedValue({ count: 1 });

    const result = await createRentSteps(SOCIETY_ID, {
      leaseId: LEASE_ID,
      steps: [{ label: "Palier 1", startDate: "2024-03-01", endDate: "2024-09-30", rentHT: 1500, chargesHT: null }],
    });
    expect(result.success).toBe(true);
  });
});

// ── updateRentStep ────────────────────────────────────────────────

describe("updateRentStep", () => {
  const validInput = { id: STEP_ID, label: "Palier modifié", startDate: "2024-06-01", rentHT: 1600 };

  beforeEach(() => {
    mockAuthSession(UserRole.GESTIONNAIRE);
  });

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await updateRentStep(SOCIETY_ID, validInput);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur Zod si l'id n'est pas un CUID valide", async () => {
    const result = await updateRentStep(SOCIETY_ID, { ...validInput, id: "not-a-cuid" });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si le palier est introuvable", async () => {
    prismaMock.leaseRentStep.findFirst.mockResolvedValue(null);
    const result = await updateRentStep(SOCIETY_ID, validInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("retourne une erreur si la date de fin est antérieure ou égale à la date de début", async () => {
    prismaMock.leaseRentStep.findFirst.mockResolvedValue({ id: STEP_ID, leaseId: LEASE_ID } as never);
    prismaMock.lease.findFirst.mockResolvedValue({ startDate: new Date("2024-01-01"), endDate: null } as never);
    const result = await updateRentStep(SOCIETY_ID, { ...validInput, startDate: "2024-06-01", endDate: "2024-05-01" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("postérieure à la date de début");
  });

  it("retourne une erreur si la date de début est antérieure au début du bail", async () => {
    prismaMock.leaseRentStep.findFirst.mockResolvedValue({ id: STEP_ID, leaseId: LEASE_ID } as never);
    prismaMock.lease.findFirst.mockResolvedValue({ startDate: new Date("2024-06-01"), endDate: null } as never);
    const result = await updateRentStep(SOCIETY_ID, { ...validInput, startDate: "2024-01-01" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("antérieure au début du bail");
  });

  it("met à jour le palier avec succès", async () => {
    prismaMock.leaseRentStep.findFirst.mockResolvedValue({
      id: STEP_ID,
      leaseId: LEASE_ID,
    } as never);
    prismaMock.lease.findFirst.mockResolvedValue({
      startDate: new Date("2024-01-01"),
      endDate: null,
    } as never);
    prismaMock.leaseRentStep.findMany.mockResolvedValue([]);
    prismaMock.leaseRentStep.update.mockResolvedValue({ id: STEP_ID } as never);

    const result = await updateRentStep(SOCIETY_ID, validInput);
    expect(result.success).toBe(true);
  });

  it("retourne une erreur si rôle insuffisant pour updateRentStep", async () => {
    mockAuthSession(UserRole.LECTURE);
    const result = await updateRentStep(SOCIETY_ID, validInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans updateRentStep", async () => {
    prismaMock.leaseRentStep.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await updateRentStep(SOCIETY_ID, validInput);
    expect(result).toEqual({ success: false, error: "Erreur lors de la mise à jour du palier" });
  });

  it("retourne une erreur si la date de début dépasse la fin du bail", async () => {
    prismaMock.leaseRentStep.findFirst.mockResolvedValue({ id: STEP_ID, leaseId: LEASE_ID } as never);
    prismaMock.lease.findFirst.mockResolvedValue({
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-03-31"),
    } as never);
    const result = await updateRentStep(SOCIETY_ID, { id: STEP_ID, label: "Palier test", startDate: "2024-06-01", rentHT: 1500 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("postérieure à la fin du bail");
  });

  it("retourne une erreur si la date de fin du palier dépasse la fin du bail", async () => {
    prismaMock.leaseRentStep.findFirst.mockResolvedValue({ id: STEP_ID, leaseId: LEASE_ID } as never);
    prismaMock.lease.findFirst.mockResolvedValue({
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-12-31"),
    } as never);
    prismaMock.leaseRentStep.findMany.mockResolvedValue([]);
    const result = await updateRentStep(SOCIETY_ID, { id: STEP_ID, label: "Palier test", startDate: "2024-02-01", endDate: "2025-02-01", rentHT: 1500 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("dépasser la fin du bail");
  });

  it("retourne une erreur si le palier chevauche un palier existant", async () => {
    prismaMock.leaseRentStep.findFirst.mockResolvedValue({ id: STEP_ID, leaseId: LEASE_ID } as never);
    prismaMock.lease.findFirst.mockResolvedValue({ startDate: new Date("2024-01-01"), endDate: null } as never);
    prismaMock.leaseRentStep.findMany.mockResolvedValue([
      { label: "Palier A", startDate: new Date("2024-05-01"), endDate: null },
    ] as never);
    const result = await updateRentStep(SOCIETY_ID, { id: STEP_ID, label: "Palier test", startDate: "2024-06-01", rentHT: 1500 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Chevauchement");
  });

  it("détecte le chevauchement quand les deux paliers ont une date de fin (branches oEnd/newEnd truthy)", async () => {
    prismaMock.leaseRentStep.findFirst.mockResolvedValue({ id: STEP_ID, leaseId: LEASE_ID } as never);
    prismaMock.lease.findFirst.mockResolvedValue({ startDate: new Date("2024-01-01"), endDate: null } as never);
    prismaMock.leaseRentStep.findMany.mockResolvedValue([
      { label: "Palier B", startDate: new Date("2024-04-01"), endDate: new Date("2024-08-31") },
    ] as never);
    // update: startDate=2024-06-01, endDate=2024-09-30 → chevauche avec Palier B (fin: 2024-08-31)
    const result = await updateRentStep(SOCIETY_ID, { id: STEP_ID, label: "Palier test", startDate: "2024-06-01", endDate: "2024-09-30", rentHT: 1500 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Chevauchement");
  });

  it("met à jour le palier sans erreur quand bail introuvable (if(lease) false branch)", async () => {
    prismaMock.leaseRentStep.findFirst.mockResolvedValue({ id: STEP_ID, leaseId: LEASE_ID } as never);
    prismaMock.lease.findFirst.mockResolvedValue(null);
    prismaMock.leaseRentStep.update.mockResolvedValue({ id: STEP_ID } as never);
    const result = await updateRentStep(SOCIETY_ID, validInput);
    expect(result.success).toBe(true);
  });

  it("accepte la mise à jour quand le palier existant (oEnd truthy) ne chevauche pas", async () => {
    prismaMock.leaseRentStep.findFirst.mockResolvedValue({ id: STEP_ID, leaseId: LEASE_ID } as never);
    prismaMock.lease.findFirst.mockResolvedValue({ startDate: new Date("2024-01-01"), endDate: null } as never);
    // Palier C se termine avant le début du nouveau palier → pas de chevauchement
    prismaMock.leaseRentStep.findMany.mockResolvedValue([
      { label: "Palier C", startDate: new Date("2024-01-01"), endDate: new Date("2024-03-31") },
    ] as never);
    prismaMock.leaseRentStep.update.mockResolvedValue({ id: STEP_ID } as never);
    const result = await updateRentStep(SOCIETY_ID, { id: STEP_ID, label: "Palier test", startDate: "2024-06-01", rentHT: 1500 });
    expect(result.success).toBe(true);
  });

  it("met à jour le palier avec endDate non-null (branche endDate ? new Date : null true arm)", async () => {
    prismaMock.leaseRentStep.findFirst.mockResolvedValue({ id: STEP_ID, leaseId: LEASE_ID } as never);
    prismaMock.lease.findFirst.mockResolvedValue({ startDate: new Date("2024-01-01"), endDate: null } as never);
    prismaMock.leaseRentStep.findMany.mockResolvedValue([]);
    prismaMock.leaseRentStep.update.mockResolvedValue({ id: STEP_ID } as never);
    const result = await updateRentStep(SOCIETY_ID, { id: STEP_ID, label: "Palier avec fin", startDate: "2024-06-01", endDate: "2024-12-31", rentHT: 1600 });
    expect(result.success).toBe(true);
    expect(prismaMock.leaseRentStep.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ endDate: new Date("2024-12-31") }) })
    );
  });
});

// ── deleteRentStep ────────────────────────────────────────────────

describe("deleteRentStep", () => {
  beforeEach(() => {
    mockAuthSession(UserRole.GESTIONNAIRE);
  });

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await deleteRentStep(SOCIETY_ID, STEP_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si le palier est introuvable", async () => {
    prismaMock.leaseRentStep.findFirst.mockResolvedValue(null);
    const result = await deleteRentStep(SOCIETY_ID, STEP_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("supprime le palier avec succès", async () => {
    prismaMock.leaseRentStep.findFirst.mockResolvedValue({ id: STEP_ID, leaseId: LEASE_ID } as never);
    prismaMock.leaseRentStep.delete.mockResolvedValue({ id: STEP_ID } as never);

    const result = await deleteRentStep(SOCIETY_ID, STEP_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.leaseRentStep.delete).toHaveBeenCalledWith({ where: { id: STEP_ID } });
  });

  it("retourne une erreur si rôle insuffisant pour deleteRentStep", async () => {
    mockAuthSession(UserRole.LECTURE);
    const result = await deleteRentStep(SOCIETY_ID, STEP_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans deleteRentStep", async () => {
    prismaMock.leaseRentStep.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await deleteRentStep(SOCIETY_ID, STEP_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors de la suppression du palier" });
  });
});

// ── getRentSteps ──────────────────────────────────────────────────

describe("getRentSteps", () => {
  it("retourne [] si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getRentSteps(SOCIETY_ID, LEASE_ID);
    expect(result).toEqual([]);
  });

  it("retourne les paliers du bail", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.leaseRentStep.findMany.mockResolvedValue([
      { id: STEP_ID, rentHT: 1500 },
    ] as never);
    const result = await getRentSteps(SOCIETY_ID, LEASE_ID);
    expect(result).toHaveLength(1);
  });
});
