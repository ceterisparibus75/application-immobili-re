import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import { createAuditLog } from "@/lib/audit";
import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { getAccountReviewBoard, updateAccountReview } from "./account-review";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const FISCAL_YEAR_ID = "clh3x2z4k0001qh8g7z1y2v3u";
const ACCOUNT_ID = "clh3x2z4k0002qh8g7z1y2v3v";

describe("getAccountReviewBoard", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();

    const result = await getAccountReviewBoard(SOCIETY_ID, FISCAL_YEAR_ID);

    expect(result.success).toBe(false);
  });

  it("construit le tableau de révision avec soldes et statuts", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue({
      id: FISCAL_YEAR_ID,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
    } as never);
    prismaMock.accountingAccount.findMany.mockResolvedValue([
      { id: ACCOUNT_ID, code: "411000", label: "Locataires", type: "4" },
      { id: "acc-706", code: "706100", label: "Loyers", type: "7" },
    ] as never);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      { accountId: ACCOUNT_ID, debit: 1200, credit: 0 },
      { accountId: "acc-706", debit: 0, credit: 1200 },
    ] as never);
    prismaMock.accountReview.findMany.mockResolvedValue([
      {
        accountId: ACCOUNT_ID,
        status: "REVIEWED",
        note: "OK",
        reviewedAt: new Date("2026-02-01"),
        reviewedById: "user-1",
      },
    ] as never);

    const result = await getAccountReviewBoard(SOCIETY_ID, FISCAL_YEAR_ID);

    expect(result.success).toBe(true);
    expect(result.data?.stats).toMatchObject({
      total: 2,
      todo: 1,
      reviewed: 1,
      completionRate: 50,
    });
    expect(result.data?.rows[0]).toMatchObject({
      accountId: ACCOUNT_ID,
      cycle: "Tiers",
      balance: 1200,
      status: "REVIEWED",
      note: "OK",
    });
    expect(result.data?.cycleStats).toEqual([
      expect.objectContaining({ cycle: "Tiers", total: 1, reviewed: 1, completionRate: 100 }),
      expect.objectContaining({ cycle: "Produits", total: 1, todo: 1, completionRate: 0 }),
    ]);
    expect(result.data?.cycleChecklist).toEqual([
      expect.objectContaining({
        cycle: "Tiers",
        status: "REVIEWED",
        items: expect.arrayContaining(["Comptes tiers lettrés ou justifiés"]),
      }),
      expect.objectContaining({
        cycle: "Produits",
        status: "TODO",
        items: expect.arrayContaining(["Loyers, refacturations et avoirs cadrés"]),
      }),
    ]);
  });

  it("distingue les comptes justifiés des comptes revus dans les statistiques", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue({
      id: FISCAL_YEAR_ID,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
    } as never);
    prismaMock.accountingAccount.findMany.mockResolvedValue([
      { id: ACCOUNT_ID, code: "411000", label: "Locataires", type: "4" },
      { id: "acc-512", code: "512000", label: "Banque", type: "5" },
    ] as never);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      { accountId: ACCOUNT_ID, debit: 1200, credit: 0 },
      { accountId: "acc-512", debit: 0, credit: 1200 },
    ] as never);
    prismaMock.accountReview.findMany.mockResolvedValue([
      {
        accountId: ACCOUNT_ID,
        status: "JUSTIFIED",
        note: "Solde justifié, en attente de supervision",
        reviewedAt: null,
        reviewedById: null,
      },
      {
        accountId: "acc-512",
        status: "REVIEWED",
        note: "OK",
        reviewedAt: new Date("2026-02-01"),
        reviewedById: "user-1",
      },
    ] as never);

    const result = await getAccountReviewBoard(SOCIETY_ID, FISCAL_YEAR_ID);

    expect(result.success).toBe(true);
    expect(result.data?.stats).toMatchObject({
      total: 2,
      justified: 1,
      reviewed: 1,
      completionRate: 50,
    });
    expect(result.data?.cycleStats).toEqual([
      expect.objectContaining({ cycle: "Trésorerie", reviewed: 1, completionRate: 100 }),
      expect.objectContaining({ cycle: "Tiers", justified: 1, reviewed: 0, completionRate: 0 }),
    ]);
    expect(result.data?.cycleChecklist).toEqual([
      expect.objectContaining({ cycle: "Tiers", status: "JUSTIFIED" }),
      expect.objectContaining({ cycle: "Trésorerie", status: "REVIEWED" }),
    ]);
  });
});

describe("updateAccountReview", () => {
  it("crée ou met à jour une revue de compte", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue({ id: FISCAL_YEAR_ID } as never);
    prismaMock.accountingAccount.findFirst.mockResolvedValue({ id: ACCOUNT_ID } as never);
    prismaMock.accountReview.upsert.mockResolvedValue({ id: "review-1" } as never);

    const result = await updateAccountReview(SOCIETY_ID, {
      fiscalYearId: FISCAL_YEAR_ID,
      accountId: ACCOUNT_ID,
      status: "REVIEWED",
      note: "Compte justifié",
    });

    expect(result.success).toBe(true);
    expect(prismaMock.accountReview.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "REVIEWED",
          note: "Compte justifié",
          reviewedById: "user-1",
        }),
      })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "AccountReview",
        entityId: ACCOUNT_ID,
      })
    );
  });

  it("retourne une erreur si le compte n'appartient pas à la société", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue({ id: FISCAL_YEAR_ID } as never);
    prismaMock.accountingAccount.findFirst.mockResolvedValue(null);

    const result = await updateAccountReview(SOCIETY_ID, {
      fiscalYearId: FISCAL_YEAR_ID,
      accountId: ACCOUNT_ID,
      status: "ISSUE",
      note: "À contrôler",
    });

    expect(result).toEqual({ success: false, error: "Compte introuvable" });
  });

  it("accepte le statut justifié sans renseigner reviewedAt", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue({ id: FISCAL_YEAR_ID } as never);
    prismaMock.accountingAccount.findFirst.mockResolvedValue({ id: ACCOUNT_ID } as never);
    prismaMock.accountReview.upsert.mockResolvedValue({ id: "review-1" } as never);

    const result = await updateAccountReview(SOCIETY_ID, {
      fiscalYearId: FISCAL_YEAR_ID,
      accountId: ACCOUNT_ID,
      status: "JUSTIFIED" as never,
      note: "Justificatif contrôlé",
    });

    expect(result.success).toBe(true);
    expect(prismaMock.accountReview.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "JUSTIFIED",
          reviewedAt: null,
          reviewedById: null,
        }),
      })
    );
  });
});
