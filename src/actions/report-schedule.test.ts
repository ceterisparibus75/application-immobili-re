import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";

const { revalidatePath, createAuditLog, computeNextRunAt } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  computeNextRunAt: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/audit", () => ({ createAuditLog }));
vi.mock("@/lib/reports/consolidated", () => ({ computeNextRunAt }));

import {
  createReportSchedule,
  deleteReportSchedule,
  getReportSchedules,
  toggleReportSchedule,
  updateReportSchedule,
} from "./report-schedule";

describe("report schedule actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    computeNextRunAt.mockReturnValue(new Date("2026-05-01T08:00:00.000Z"));
  });

  describe("getReportSchedules", () => {
    it("retourne une erreur si non authentifié", async () => {
      mockUnauthenticated();

      const result = await getReportSchedules("society-1");

      expect(result).toEqual({ success: false, error: "Non authentifié" });
    });

    it("retourne les planifications de la société", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      prismaMock.reportSchedule.findMany.mockResolvedValue([
        {
          id: "schedule-1",
          name: "Reporting mensuel",
          frequency: "MENSUEL",
          reportTypes: ["SITUATION_LOCATIVE"],
          recipients: ["alice@example.com"],
          isActive: true,
          lastSentAt: null,
          nextRunAt: new Date("2026-05-01T08:00:00.000Z"),
          createdAt: new Date("2026-04-20T00:00:00.000Z"),
          createdBy: { name: "Test User", email: "test@example.com" },
        },
      ] as never);

      const result = await getReportSchedules("society-1");

      expect(result.success).toBe(true);
      expect(result.data?.schedules).toHaveLength(1);
      expect(prismaMock.reportSchedule.findMany).toHaveBeenCalledWith({
        where: { societyId: "society-1" },
        include: { createdBy: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("createReportSchedule", () => {
    it("retourne une erreur de validation si le payload est invalide", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);

      const result = await createReportSchedule("society-1", {
        name: "A",
        frequency: "MENSUEL",
        reportTypes: [],
        recipients: [],
      } as never);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Le nom doit contenir au moins 2 caractères");
      expect(result.error).toContain("Sélectionnez au moins un type de rapport");
      expect(result.error).toContain("Ajoutez au moins un destinataire");
    });

    it("crée une planification, calcule nextRunAt et audite l'action", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      prismaMock.reportSchedule.create.mockResolvedValue({
        id: "schedule-1",
        name: "Reporting mensuel",
        frequency: "MENSUEL",
        recipients: ["alice@example.com"],
      } as never);

      const result = await createReportSchedule("society-1", {
        name: "Reporting mensuel",
        frequency: "MENSUEL",
        reportTypes: ["SITUATION_LOCATIVE", "BALANCE_AGEE"],
        recipients: ["alice@example.com"],
      });

      expect(result).toEqual({ success: true, data: { id: "schedule-1" } });
      expect(computeNextRunAt).toHaveBeenCalledWith("MENSUEL");
      expect(prismaMock.reportSchedule.create).toHaveBeenCalledWith({
        data: {
          societyId: "society-1",
          createdById: "user-1",
          name: "Reporting mensuel",
          frequency: "MENSUEL",
          reportTypes: ["SITUATION_LOCATIVE", "BALANCE_AGEE"],
          recipients: ["alice@example.com"],
          nextRunAt: new Date("2026-05-01T08:00:00.000Z"),
        },
      });
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CREATE",
          entity: "ReportSchedule",
          entityId: "schedule-1",
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/rapports/planification");
    });
  });

  describe("updateReportSchedule", () => {
    it("retourne une erreur si non authentifié", async () => {
      mockUnauthenticated();
      const result = await updateReportSchedule("society-1", { id: "cm8m6m6m6000008l2a1bcdefg" });
      expect(result).toEqual({ success: false, error: "Non authentifié" });
    });

    it("recalcule nextRunAt si la fréquence change", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);

      const result = await updateReportSchedule("society-1", {
        id: "cm8m6m6m6000008l2a1bcdefg",
        frequency: "TRIMESTRIEL",
        recipients: ["alice@example.com"],
      });

      expect(result).toEqual({ success: true });
      expect(computeNextRunAt).toHaveBeenCalledWith("TRIMESTRIEL");
      expect(prismaMock.reportSchedule.update).toHaveBeenCalledWith({
        where: { id: "cm8m6m6m6000008l2a1bcdefg", societyId: "society-1" },
        data: {
          frequency: "TRIMESTRIEL",
          recipients: ["alice@example.com"],
          nextRunAt: new Date("2026-05-01T08:00:00.000Z"),
        },
      });
    });
  });

  describe("deleteReportSchedule", () => {
    it("retourne une erreur si non authentifié", async () => {
      mockUnauthenticated();
      const result = await deleteReportSchedule("society-1", "schedule-1");
      expect(result).toEqual({ success: false, error: "Non authentifié" });
    });

    it("supprime une planification et écrit l'audit", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);

      const result = await deleteReportSchedule("society-1", "schedule-1");

      expect(result).toEqual({ success: true });
      expect(prismaMock.reportSchedule.delete).toHaveBeenCalledWith({
        where: { id: "schedule-1", societyId: "society-1" },
      });
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "DELETE",
          entity: "ReportSchedule",
          entityId: "schedule-1",
        })
      );
    });
  });

  describe("toggleReportSchedule", () => {
    it("désactive une planification via updateReportSchedule", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);

      const result = await toggleReportSchedule("society-1", "cm8m6m6m6000008l2a1bcdefg", false);

      expect(result).toEqual({ success: true });
      expect(prismaMock.reportSchedule.update).toHaveBeenCalledWith({
        where: { id: "cm8m6m6m6000008l2a1bcdefg", societyId: "society-1" },
        data: {
          isActive: false,
        },
      });
    });
  });
});
