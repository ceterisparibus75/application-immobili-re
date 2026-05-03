import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { prismaMock } from "@/test/mocks/prisma";

const { requireActiveSocietyRouteContext, generateEmailDeliveryProofPdfBuffer } = vi.hoisted(() => ({
  requireActiveSocietyRouteContext: vi.fn(),
  generateEmailDeliveryProofPdfBuffer: vi.fn().mockResolvedValue(Buffer.from("generic-proof-pdf")),
}));

vi.mock("@/lib/api-society", () => ({ requireActiveSocietyRouteContext }));
vi.mock("@/lib/email-delivery-proof-pdf", () => ({ generateEmailDeliveryProofPdfBuffer }));

import { GET } from "./route";

describe("GET /api/email-delivery-proofs/[id]/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveSocietyRouteContext.mockResolvedValue({ societyId: "soc-1", userId: "user-1" });
    prismaMock.emailDeliveryProof.findFirst.mockResolvedValue({
      id: "proof-1",
      societyId: "soc-1",
      entityType: "INVOICE",
      recipientName: "Jean Dupont",
      recipientEmail: "jean@example.test",
      subject: "Facture 2026",
      createdAt: new Date("2026-05-04T10:00:00.000Z"),
      deliveredAt: new Date("2026-05-04T10:01:00.000Z"),
      status: "DELIVERED",
      society: { name: "SCI Test", email: "contact@example.test", siret: "12345678900012" },
      sentBy: { name: "Gestionnaire", email: "gestionnaire@example.test" },
      events: [],
    } as never);
  });

  it("génère une attestation PDF de preuve d'envoi générique", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/email-delivery-proofs/proof-1/pdf"),
      { params: Promise.resolve({ id: "proof-1" }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("preuve-envoi-email");
    expect(prismaMock.emailDeliveryProof.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "proof-1", societyId: "soc-1" } })
    );
    expect(generateEmailDeliveryProofPdfBuffer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "proof-1", status: "DELIVERED" })
    );
    expect(await response.text()).toBe("generic-proof-pdf");
  });

  it("retourne la réponse d'authentification si l'accès société échoue", async () => {
    requireActiveSocietyRouteContext.mockResolvedValue(NextResponse.json({ error: "Non authentifié" }, { status: 401 }));

    const response = await GET(
      new NextRequest("http://localhost/api/email-delivery-proofs/proof-1/pdf"),
      { params: Promise.resolve({ id: "proof-1" }) }
    );

    expect(response.status).toBe(401);
  });
});
