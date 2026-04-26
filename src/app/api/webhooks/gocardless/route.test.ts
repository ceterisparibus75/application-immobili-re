import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

vi.mock("@/lib/env", () => ({ env: process.env }));

import { POST } from "./route";

const WEBHOOK_SECRET = "gc_webhook_secret";

function sign(rawBody: string) {
  return createHmac("sha256", WEBHOOK_SECRET).update(Buffer.from(rawBody)).digest("hex");
}

function webhookRequest(payload: unknown, signature?: string) {
  const rawBody = JSON.stringify(payload);
  return new Request("http://localhost/api/webhooks/gocardless", {
    method: "POST",
    body: rawBody,
    headers: { "webhook-signature": signature ?? sign(rawBody) },
  }) as never;
}

describe("POST /api/webhooks/gocardless", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOCARDLESS_PAYMENTS_WEBHOOK_SECRET = WEBHOOK_SECRET;
    prismaMock.sepaMandate.findFirst.mockResolvedValue(null);
    prismaMock.sepaMandate.update.mockResolvedValue({} as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.invoice.update.mockResolvedValue({} as never);
    prismaMock.society.findUnique.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({} as never);
  });

  it("retourne 500 si le secret webhook n'est pas configure", async () => {
    delete process.env.GOCARDLESS_PAYMENTS_WEBHOOK_SECRET;

    const response = await POST(webhookRequest({ events: [] }, "signature"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Webhook secret manquant" });
  });

  it("retourne 401 si la signature est invalide", async () => {
    const response = await POST(webhookRequest({ events: [] }, "bad-signature"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Signature invalide" });
  });

  it("met a jour le statut d'un mandat SEPA", async () => {
    prismaMock.sepaMandate.findFirst.mockResolvedValue({
      id: "mandate-1",
      gocardlessId: "MD0001",
      status: "SUBMITTED",
    } as never);

    const response = await POST(
      webhookRequest({
        events: [
          {
            id: "EV001",
            resource_type: "mandates",
            action: "active",
            links: { mandate: "MD0001" },
          },
        ],
      })
    );

    expect(response.status).toBe(200);
    expect(prismaMock.sepaMandate.update).toHaveBeenCalledWith({
      where: { id: "mandate-1" },
      data: { status: "ACTIVE" },
    });
  });

  it("confirme un paiement SEPA, marque la facture payee et notifie le gestionnaire", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: "invoice-1",
      societyId: "soc-1",
      invoiceNumber: "FAC-2026-0001",
      sepaPaymentId: "PM0001",
    } as never);
    prismaMock.society.findUnique.mockResolvedValue({
      userSocieties: [{ userId: "user-1" }],
    } as never);

    const response = await POST(
      webhookRequest({
        events: [
          {
            id: "EV002",
            resource_type: "payments",
            action: "confirmed",
            links: { payment: "PM0001" },
          },
        ],
      })
    );

    expect(response.status).toBe(200);
    expect(prismaMock.invoice.update).toHaveBeenCalledWith({
      where: { id: "invoice-1" },
      data: { sepaStatus: "CONFIRMED", status: "PAYE" },
    });
    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        societyId: "soc-1",
        type: "PAYMENT_RECEIVED",
        link: "/facturation/invoice-1",
      }),
    });
  });
});
