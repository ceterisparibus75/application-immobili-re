import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { requireActiveSocietyRouteContext, createAuditLog } = vi.hoisted(() => ({
  requireActiveSocietyRouteContext: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/api-society", () => ({
  requireActiveSocietyRouteContext,
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog,
}));

import { prismaMock } from "@/test/mocks/prisma";
import { POST } from "./route";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const USER_ID = "clh3x2z4k0001qh8g7z1y2v3u";
const FISCAL_YEAR_ID = "clh3x2z4k0002qh8g7z1y2v3v";
const ENTRY_ID = "clh3x2z4k0003qh8g7z1y2v3w";
const ACCOUNT_ID_1 = "clh3x2z4k0004qh8g7z1y2v3x";
const ACCOUNT_ID_2 = "clh3x2z4k0005qh8g7z1y2v3y";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/comptabilite/entries", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const validBody = {
  journalType: "VENTES",
  entryDate: "2025-01-15",
  label: "Facture loyer",
  piece: "FAC-001",
  lines: [
    { accountId: ACCOUNT_ID_1, debit: 1200, credit: 0, label: "Client" },
    { accountId: ACCOUNT_ID_2, debit: 0, credit: 1200, label: "Loyer" },
  ],
};

describe("POST /api/comptabilite/entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveSocietyRouteContext.mockResolvedValue({
      societyId: SOCIETY_ID,
      userId: USER_ID,
    });
    createAuditLog.mockResolvedValue(undefined);
    prismaMock.accountingAccount.findMany.mockResolvedValue([
      { id: ACCOUNT_ID_1 },
      { id: ACCOUNT_ID_2 },
    ] as never);
    prismaMock.fiscalYear.findFirst.mockResolvedValue({
      id: FISCAL_YEAR_ID,
      isClosed: false,
    } as never);
    prismaMock.journalEntry.create.mockResolvedValue({ id: ENTRY_ID } as never);
  });

  it("propage la réponse de contexte si l'utilisateur n'est pas autorisé", async () => {
    requireActiveSocietyRouteContext.mockResolvedValue(
      NextResponse.json({ error: "Non autorisé" }, { status: 403 })
    );

    const response = await POST(makeRequest(validBody) as never);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Non autorisé" });
  });

  it("crée une écriture scopée société et journalise l'audit", async () => {
    const response = await POST(makeRequest(validBody) as never);

    expect(response.status).toBe(201);
    expect(prismaMock.accountingAccount.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [ACCOUNT_ID_1, ACCOUNT_ID_2] },
        societyId: SOCIETY_ID,
        isActive: true,
      },
      select: { id: true },
    });
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          societyId: SOCIETY_ID,
          fiscalYearId: FISCAL_YEAR_ID,
          isValidated: false,
        }),
      })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        societyId: SOCIETY_ID,
        userId: USER_ID,
        action: "CREATE",
        entity: "JournalEntry",
        entityId: ENTRY_ID,
      })
    );
  });

  it("accepte les codes de journaux comptables modernes", async () => {
    const response = await POST(makeRequest({ ...validBody, journalType: "BQUE" }) as never);

    expect(response.status).toBe(201);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          journalType: "BQUE",
          status: "BROUILLON",
        }),
      })
    );
  });

  it("refuse une ligne avec débit et crédit simultanés", async () => {
    const response = await POST(
      makeRequest({
        ...validBody,
        lines: [
          { accountId: ACCOUNT_ID_1, debit: 1200, credit: 1200, label: "Client" },
          { accountId: ACCOUNT_ID_2, debit: 300, credit: 300, label: "Loyer" },
        ],
      }) as never
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Chaque ligne doit renseigner un débit ou un crédit, pas les deux",
    });
    expect(prismaMock.journalEntry.create).not.toHaveBeenCalled();
  });

  it("refuse une écriture dont un compte n'appartient pas à la société", async () => {
    prismaMock.accountingAccount.findMany.mockResolvedValue([{ id: ACCOUNT_ID_1 }] as never);

    const response = await POST(makeRequest(validBody) as never);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Un ou plusieurs comptes sont invalides pour cette société",
    });
    expect(prismaMock.journalEntry.create).not.toHaveBeenCalled();
  });

  it("refuse une écriture dans un exercice clôturé", async () => {
    prismaMock.fiscalYear.findFirst.mockResolvedValue({
      id: FISCAL_YEAR_ID,
      isClosed: true,
    } as never);

    const response = await POST(makeRequest(validBody) as never);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Impossible de créer une écriture dans un exercice clôturé",
    });
    expect(prismaMock.journalEntry.create).not.toHaveBeenCalled();
  });

  it("refuse une écriture sans exercice fiscal couvrant la date", async () => {
    prismaMock.fiscalYear.findFirst.mockResolvedValue(null);

    const response = await POST(makeRequest(validBody) as never);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Aucun exercice fiscal ouvert ne couvre cette date",
    });
    expect(prismaMock.journalEntry.create).not.toHaveBeenCalled();
  });
});
