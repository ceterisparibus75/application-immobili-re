import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserRole } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import {
  createOwnership,
  deleteOwnership,
  endOwnership,
  getLotOwnerships,
  splitLotToUsufruct,
  updateOwnership,
} from "./lot-ownership";

const SOCIETY_ID = "society-1";
const LOT_ID = "cm8m6m6m6000008l2a1bcdef1";
const PROPRIETAIRE_USUFRUITIER = "cm8m6m6m6000008l2a1bcdef2";
const PROPRIETAIRE_NU = "cm8m6m6m6000008l2a1bcdef3";
const OWNERSHIP_ID = "cm8m6m6m6000008l2a1bcdef4";

function mockLotBelongsToSociety() {
  prismaMock.lot.findFirst.mockResolvedValue({ id: LOT_ID, buildingId: "building-1" } as never);
}

function mockProprietaireBelongsToSociety() {
  prismaMock.proprietaire.findFirst.mockResolvedValue({ id: PROPRIETAIRE_USUFRUITIER } as never);
}

describe("lot-ownership actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLotOwnerships", () => {
    it("requiert une session", async () => {
      mockUnauthenticated();
      await expect(getLotOwnerships(SOCIETY_ID, LOT_ID)).rejects.toThrow();
    });

    it("retourne la liste filtrée par société et lot", async () => {
      mockAuthSession(UserRole.LECTURE);
      prismaMock.lotOwnership.findMany.mockResolvedValue([] as never);

      await getLotOwnerships(SOCIETY_ID, LOT_ID);

      expect(prismaMock.lotOwnership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { societyId: SOCIETY_ID, lotId: LOT_ID },
        }),
      );
    });
  });

  describe("createOwnership", () => {
    it("retourne une erreur si non authentifié", async () => {
      mockUnauthenticated();
      const result = await createOwnership(SOCIETY_ID, {
        lotId: LOT_ID,
        proprietaireId: PROPRIETAIRE_USUFRUITIER,
        type: "PLEINE_PROPRIETE",
        share: 1,
        startDate: "2026-01-01",
      });
      expect(result.success).toBe(false);
    });

    it("rejette une part hors plage", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      const result = await createOwnership(SOCIETY_ID, {
        lotId: LOT_ID,
        proprietaireId: PROPRIETAIRE_USUFRUITIER,
        type: "PLEINE_PROPRIETE",
        share: 1.5,
        startDate: "2026-01-01",
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/quote-part/i);
    });

    it("rejette un lot d'une autre société", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      prismaMock.lot.findFirst.mockResolvedValue(null);

      const result = await createOwnership(SOCIETY_ID, {
        lotId: LOT_ID,
        proprietaireId: PROPRIETAIRE_USUFRUITIER,
        type: "PLEINE_PROPRIETE",
        share: 1,
        startDate: "2026-01-01",
      });
      expect(result).toEqual({ success: false, error: "Lot introuvable" });
    });

    it("crée la quote-part et écrit un audit log", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      mockLotBelongsToSociety();
      mockProprietaireBelongsToSociety();
      prismaMock.lotOwnership.create.mockResolvedValue({ id: OWNERSHIP_ID } as never);

      const result = await createOwnership(SOCIETY_ID, {
        lotId: LOT_ID,
        proprietaireId: PROPRIETAIRE_USUFRUITIER,
        type: "USUFRUIT",
        share: 1,
        startDate: "2026-01-01",
        isViager: true,
        usufruitierBirthDate: "1960-06-15",
      });

      expect(result).toEqual({ success: true, data: { id: OWNERSHIP_ID } });
      expect(prismaMock.lotOwnership.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          societyId: SOCIETY_ID,
          lotId: LOT_ID,
          type: "USUFRUIT",
          share: 1,
          startDate: new Date("2026-01-01"),
          isViager: true,
          usufruitierBirthDate: new Date("1960-06-15"),
        }),
      });
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CREATE",
          entity: "LotOwnership",
          entityId: OWNERSHIP_ID,
        }),
      );
    });
  });

  describe("splitLotToUsufruct", () => {
    it("rejette si la somme des US ≠ 1", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      const result = await splitLotToUsufruct(SOCIETY_ID, {
        lotId: LOT_ID,
        startDate: "2026-06-01",
        usufruit: [{ proprietaireId: PROPRIETAIRE_USUFRUITIER, share: 0.5 }],
        nuePropriete: [{ proprietaireId: PROPRIETAIRE_NU, share: 1 }],
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/usufruit/i);
    });

    it("rejette si la somme des NP ≠ 1", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      const result = await splitLotToUsufruct(SOCIETY_ID, {
        lotId: LOT_ID,
        startDate: "2026-06-01",
        usufruit: [{ proprietaireId: PROPRIETAIRE_USUFRUITIER, share: 1 }],
        nuePropriete: [{ proprietaireId: PROPRIETAIRE_NU, share: 0.7 }],
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/nue-propri/i);
    });

    it("ferme la PP active et crée US + NP en transaction", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      mockLotBelongsToSociety();
      prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "any" } as never);

      const txMock = {
        lotOwnership: {
          findMany: vi.fn().mockResolvedValue([{ id: "pp-1" }]),
          update: vi.fn().mockResolvedValue({}),
          create: vi.fn().mockResolvedValue({ id: "new" }),
        },
      };
      prismaMock.$transaction.mockImplementation(async (fn) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (fn as any)(txMock as any),
      );

      const result = await splitLotToUsufruct(SOCIETY_ID, {
        lotId: LOT_ID,
        startDate: "2026-06-01",
        usufruit: [{ proprietaireId: PROPRIETAIRE_USUFRUITIER, share: 1, isViager: true }],
        nuePropriete: [{ proprietaireId: PROPRIETAIRE_NU, share: 1 }],
      });

      expect(result).toEqual({ success: true, data: { created: 2 } });
      expect(txMock.lotOwnership.update).toHaveBeenCalledWith({
        where: { id: "pp-1" },
        data: { endDate: new Date("2026-06-01") },
      });
      expect(txMock.lotOwnership.create).toHaveBeenCalledTimes(2);
    });

    it("erreur si aucune PP active à démembrer", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      mockLotBelongsToSociety();
      prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "any" } as never);

      const txMock = {
        lotOwnership: {
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn(),
          create: vi.fn(),
        },
      };
      prismaMock.$transaction.mockImplementation(async (fn) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (fn as any)(txMock as any),
      );

      const result = await splitLotToUsufruct(SOCIETY_ID, {
        lotId: LOT_ID,
        startDate: "2026-06-01",
        usufruit: [{ proprietaireId: PROPRIETAIRE_USUFRUITIER, share: 1 }],
        nuePropriete: [{ proprietaireId: PROPRIETAIRE_NU, share: 1 }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Aucune pleine propri/);
    });
  });

  describe("updateOwnership / endOwnership / deleteOwnership", () => {
    it("update modifie la part et logue", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      prismaMock.lotOwnership.findFirst.mockResolvedValue({
        id: OWNERSHIP_ID,
        lotId: LOT_ID,
        lot: { buildingId: "building-1" },
      } as never);
      prismaMock.lotOwnership.update.mockResolvedValue({} as never);

      const result = await updateOwnership(SOCIETY_ID, {
        id: OWNERSHIP_ID,
        share: 0.5,
      });

      expect(result).toEqual({ success: true });
      expect(prismaMock.lotOwnership.update).toHaveBeenCalledWith({
        where: { id: OWNERSHIP_ID },
        data: expect.objectContaining({ share: 0.5 }),
      });
    });

    it("endOwnership rejette si endDate <= startDate", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      prismaMock.lotOwnership.findFirst.mockResolvedValue({
        id: OWNERSHIP_ID,
        lotId: LOT_ID,
        startDate: new Date("2026-06-01"),
        notes: null,
        lot: { buildingId: "building-1" },
      } as never);

      const result = await endOwnership(SOCIETY_ID, {
        id: OWNERSHIP_ID,
        endDate: "2025-01-01",
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/postérieure/i);
    });

    it("endOwnership pose la date de fin", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      prismaMock.lotOwnership.findFirst.mockResolvedValue({
        id: OWNERSHIP_ID,
        lotId: LOT_ID,
        startDate: new Date("2020-01-01"),
        notes: null,
        lot: { buildingId: "building-1" },
      } as never);
      prismaMock.lotOwnership.update.mockResolvedValue({} as never);

      const result = await endOwnership(SOCIETY_ID, {
        id: OWNERSHIP_ID,
        endDate: "2026-06-01",
        notes: "Décès usufruitier",
      });

      expect(result).toEqual({ success: true });
      expect(prismaMock.lotOwnership.update).toHaveBeenCalledWith({
        where: { id: OWNERSHIP_ID },
        data: { endDate: new Date("2026-06-01"), notes: "Décès usufruitier" },
      });
    });

    it("delete supprime et logue", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      prismaMock.lotOwnership.findFirst.mockResolvedValue({
        id: OWNERSHIP_ID,
        lotId: LOT_ID,
        lot: { buildingId: "building-1" },
      } as never);
      prismaMock.lotOwnership.delete.mockResolvedValue({} as never);

      const result = await deleteOwnership(SOCIETY_ID, OWNERSHIP_ID);

      expect(result).toEqual({ success: true });
      expect(prismaMock.lotOwnership.delete).toHaveBeenCalledWith({ where: { id: OWNERSHIP_ID } });
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "DELETE", entityId: OWNERSHIP_ID }),
      );
    });
  });
});
