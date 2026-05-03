import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { prismaMock } from "@/test/mocks/prisma";

const { requireActiveSocietyRouteContext, createAuditLog } = vi.hoisted(() => ({
  requireActiveSocietyRouteContext: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/api-society", () => ({ requireActiveSocietyRouteContext }));
vi.mock("@/lib/audit", () => ({ createAuditLog }));

import { GET } from "./route";

describe("GET /api/email-delivery-proofs/[id]/json", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveSocietyRouteContext.mockResolvedValue({ societyId: "soc-1", userId: "user-1" });
    prismaMock.emailDeliveryProof.findFirst.mockResolvedValue({
      id: "proof-1",
      societyId: "soc-1",
      entityType: "INVOICE",
      recipientEmail: "contact@mtg-groupe.fr",
      recipientName: "MTG Groupe",
      subject: "Facture mai 2026",
      status: "DELIVERED",
      createdAt: new Date("2026-05-04T10:00:00.000Z"),
      providerMessageId: "resend-1",
      htmlSha256: "html-hash",
      attachmentSha256: "pdf-hash",
      events: [
        {
          id: "event-1",
          eventType: "email.delivered",
          occurredAt: new Date("2026-05-04T10:01:00.000Z"),
          payload: { _mygestia: { payloadSha256: "a".repeat(64) } },
        },
      ],
      society: { name: "SCI Test", email: "contact@example.test", siret: "12345678900012" },
      sentBy: { name: "Gestionnaire", email: "gestionnaire@example.test" },
    } as never);
  });

  it("exporte une preuve complète en JSON scellable", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/email-delivery-proofs/proof-1/json"),
      { params: Promise.resolve({ id: "proof-1" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toContain("preuve-envoi-email_proof-1");
    expect(prismaMock.emailDeliveryProof.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "proof-1", societyId: "soc-1" } }),
    );

    const exported = await response.json();
    expect(exported.schemaVersion).toBe("email-delivery-proof-export-v1");
    expect(exported.exportSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(exported.proof.id).toBe("proof-1");
    expect(exported.proof.events[0].payload._mygestia.payloadSha256).toBe("a".repeat(64));
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        societyId: "soc-1",
        userId: "user-1",
        action: "EXPORT",
        entity: "EmailDeliveryProof",
        entityId: "proof-1",
      }),
    );
  });

  it("retourne 404 si la preuve n'appartient pas à la société active", async () => {
    prismaMock.emailDeliveryProof.findFirst.mockResolvedValue(null);

    const response = await GET(
      new NextRequest("http://localhost/api/email-delivery-proofs/proof-1/json"),
      { params: Promise.resolve({ id: "proof-1" }) },
    );

    expect(response.status).toBe(404);
  });

  it("retourne la réponse d'authentification si l'accès société échoue", async () => {
    requireActiveSocietyRouteContext.mockResolvedValue(NextResponse.json({ error: "Non authentifié" }, { status: 401 }));

    const response = await GET(
      new NextRequest("http://localhost/api/email-delivery-proofs/proof-1/json"),
      { params: Promise.resolve({ id: "proof-1" }) },
    );

    expect(response.status).toBe(401);
  });
});
