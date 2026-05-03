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

describe("GET /api/email-delivery-proofs/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveSocietyRouteContext.mockResolvedValue({ societyId: "soc-1", userId: "user-1" });
    prismaMock.emailDeliveryProof.findMany.mockResolvedValue([
      {
        id: "proof-1",
        createdAt: new Date("2026-05-04T10:00:00.000Z"),
        status: "DELIVERED",
        entityType: "INVOICE",
        entityId: "invoice-1",
        recipientEmail: "contact@mtg-groupe.fr",
        recipientName: "MTG Groupe",
        subject: "Facture mai 2026",
        provider: "resend",
        providerMessageId: "resend-1",
        sentAt: new Date("2026-05-04T10:00:00.000Z"),
        deliveredAt: new Date("2026-05-04T10:01:00.000Z"),
        bouncedAt: null,
        complainedAt: null,
        deliveryDelayedAt: null,
        htmlSha256: "html-hash",
        attachmentSha256: "pdf-hash",
        attachmentStoragePath: "documents/invoice.pdf",
        _count: { events: 1 },
      },
    ] as never);
  });

  it("exporte les preuves filtrées en CSV", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/email-delivery-proofs/export?status=DELIVERED&type=INVOICE&q=contact%40mtg-groupe.fr&from=2026-05-01&to=2026-05-31",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toContain("preuves-envoi-email");
    expect(prismaMock.emailDeliveryProof.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          societyId: "soc-1",
          status: "DELIVERED",
          entityType: "INVOICE",
          createdAt: expect.objectContaining({
            gte: new Date("2026-05-01T00:00:00.000Z"),
            lte: new Date("2026-05-31T23:59:59.999Z"),
          }),
        }),
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    );

    const csv = await response.text();
    expect(csv).toContain("Statut,Type,Destinataire email");
    expect(csv).toContain("DELIVERED,INVOICE,contact@mtg-groupe.fr");
    expect(csv).toContain("pdf-hash");
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        societyId: "soc-1",
        userId: "user-1",
        action: "EXPORT",
        entity: "EmailDeliveryProof",
      }),
    );
  });

  it("retourne la réponse d'authentification si l'accès société échoue", async () => {
    requireActiveSocietyRouteContext.mockResolvedValue(NextResponse.json({ error: "Non authentifié" }, { status: 401 }));

    const response = await GET(new NextRequest("http://localhost/api/email-delivery-proofs/export"));

    expect(response.status).toBe(401);
  });
});
