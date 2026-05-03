import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { prismaMock } from "@/test/mocks/prisma";

const { requireActiveSocietyRouteContext, generateChargeStatementDeliveryProofPdfBuffer } = vi.hoisted(() => ({
  requireActiveSocietyRouteContext: vi.fn(),
  generateChargeStatementDeliveryProofPdfBuffer: vi.fn().mockResolvedValue(Buffer.from("proof-pdf")),
}));

vi.mock("@/lib/api-society", () => ({ requireActiveSocietyRouteContext }));
vi.mock("@/lib/charge-statement-delivery-proof-pdf", () => ({
  generateChargeStatementDeliveryProofPdfBuffer,
}));

import { GET } from "./route";

describe("GET /api/charges/delivery-proofs/[id]/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveSocietyRouteContext.mockResolvedValue({ societyId: "soc-1", userId: "user-1" });
    prismaMock.chargeStatementDelivery.findFirst.mockResolvedValue({
      id: "delivery-1",
      societyId: "soc-1",
      fiscalYear: 2026,
      recipientName: "Jean Dupont",
      recipientEmail: "jean@example.test",
      createdAt: new Date("2026-05-03T10:00:00.000Z"),
      deliveredAt: new Date("2026-05-03T10:01:00.000Z"),
      status: "DELIVERED",
    } as never);
  });

  it("génère une attestation PDF de preuve d'envoi", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/charges/delivery-proofs/delivery-1/pdf"),
      { params: Promise.resolve({ id: "delivery-1" }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("preuve-envoi-decompte_2026");
    expect(prismaMock.chargeStatementDelivery.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "delivery-1", societyId: "soc-1" } })
    );
    expect(generateChargeStatementDeliveryProofPdfBuffer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "delivery-1", status: "DELIVERED" })
    );
    expect(await response.text()).toBe("proof-pdf");
  });

  it("retourne la réponse d'authentification si l'accès société échoue", async () => {
    requireActiveSocietyRouteContext.mockResolvedValue(NextResponse.json({ error: "Non authentifié" }, { status: 401 }));

    const response = await GET(
      new NextRequest("http://localhost/api/charges/delivery-proofs/delivery-1/pdf"),
      { params: Promise.resolve({ id: "delivery-1" }) }
    );

    expect(response.status).toBe(401);
  });
});
