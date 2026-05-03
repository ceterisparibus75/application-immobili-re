import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { prismaMock } from "@/test/mocks/prisma";

const { requireActiveSocietyRouteContext, generateChargeStatementPdfBuffer } = vi.hoisted(() => ({
  requireActiveSocietyRouteContext: vi.fn(),
  generateChargeStatementPdfBuffer: vi.fn().mockResolvedValue(Buffer.from("pdf-content")),
}));

vi.mock("@/lib/api-society", () => ({ requireActiveSocietyRouteContext }));
vi.mock("@/lib/charge-statement-pdf", () => ({ generateChargeStatementPdfBuffer }));

import { GET } from "./route";

const regularization = {
  id: "reg-1",
  societyId: "soc-1",
  fiscalYear: 2026,
  periodStart: new Date("2026-01-01"),
  periodEnd: new Date("2026-12-31"),
  totalCharges: 1200,
  totalProvisions: 1000,
  balance: 200,
  details: {
    occupancyStart: "2026-04-01",
    occupancyEnd: "2026-12-31",
    prorataDays: 275,
    categories: [{ categoryName: "Eau", tenantShare: 200 }],
  },
  lease: {
    startDate: new Date("2026-04-01"),
    endDate: null,
    tenant: {
      entityType: "PERSONNE_PHYSIQUE",
      firstName: "Jean",
      lastName: "Dupont",
      companyName: null,
    },
    lot: {
      number: "A-203",
      building: { name: "Immeuble Test" },
    },
  },
  society: {
    name: "SCI Test",
    addressLine1: "1 rue Test",
    postalCode: "75001",
    city: "Paris",
    email: "contact@test.fr",
  },
};

describe("GET /api/charges/regularizations/[id]/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveSocietyRouteContext.mockResolvedValue({ societyId: "soc-1", userId: "user-1" });
    prismaMock.chargeRegularization.findFirst.mockResolvedValue(regularization as never);
  });

  it("génère le PDF d'un décompte de charges de la société active", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/charges/regularizations/reg-1/pdf"),
      { params: Promise.resolve({ id: "reg-1" }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("decompte-charges_2026_Jean_Dupont.pdf");
    expect(prismaMock.chargeRegularization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "reg-1", societyId: "soc-1" } })
    );
    expect(generateChargeStatementPdfBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        fiscalYear: 2026,
        tenantName: "Jean Dupont",
        occupancyStart: "2026-04-01",
        prorataDays: 275,
      })
    );
    expect(await response.text()).toBe("pdf-content");
  });

  it("retourne la réponse d'authentification si l'accès société échoue", async () => {
    requireActiveSocietyRouteContext.mockResolvedValue(NextResponse.json({ error: "Non authentifié" }, { status: 401 }));

    const response = await GET(
      new NextRequest("http://localhost/api/charges/regularizations/reg-1/pdf"),
      { params: Promise.resolve({ id: "reg-1" }) }
    );

    expect(response.status).toBe(401);
  });
});
