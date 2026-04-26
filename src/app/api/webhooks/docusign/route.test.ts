import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import { POST } from "./route";

const WEBHOOK_SECRET = "docusign_webhook_secret";

function sign(rawBody: string) {
  return createHmac("sha256", WEBHOOK_SECRET).update(Buffer.from(rawBody)).digest("base64");
}

function webhookRequest(payload: unknown, signature?: string) {
  const rawBody = JSON.stringify(payload);
  return rawRequest(rawBody, signature ?? sign(rawBody));
}

function rawRequest(rawBody: string, signature: string) {
  return new Request("http://localhost/api/webhooks/docusign", {
    method: "POST",
    body: rawBody,
    headers: { "X-DocuSign-Signature-1": signature },
  }) as never;
}

describe("POST /api/webhooks/docusign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DOCUSIGN_WEBHOOK_SECRET = WEBHOOK_SECRET;
    prismaMock.signatureRequest.findUnique.mockResolvedValue(null);
    prismaMock.signatureRequest.update.mockResolvedValue({} as never);
    prismaMock.auditLog.create.mockResolvedValue({} as never);
  });

  it("retourne 401 si la signature est absente ou invalide", async () => {
    const missingSignature = await POST(
      new Request("http://localhost/api/webhooks/docusign", {
        method: "POST",
        body: "{}",
      }) as never
    );
    expect(missingSignature.status).toBe(401);

    const invalidSignature = await POST(webhookRequest({}, "bad-signature"));
    expect(invalidSignature.status).toBe(401);
  });

  it("retourne 400 si le JSON est invalide apres validation de signature", async () => {
    const rawBody = "{bad-json";
    const response = await POST(rawRequest(rawBody, sign(rawBody)));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid JSON" });
  });

  it("ignore proprement une enveloppe inconnue", async () => {
    const response = await POST(
      webhookRequest({
        data: {
          envelopeSummary: {
            envelopeId: "env-unknown",
            status: "completed",
          },
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(prismaMock.signatureRequest.update).not.toHaveBeenCalled();
  });

  it("marque une demande comme signee et ecrit l'audit", async () => {
    prismaMock.signatureRequest.findUnique.mockResolvedValue({
      id: "signature-1",
      societyId: "soc-1",
      envelopeId: "env-1",
    } as never);

    const response = await POST(
      webhookRequest({
        data: {
          envelopeSummary: {
            envelopeId: "env-1",
            status: "completed",
            completedDateTime: "2026-04-26T10:00:00.000Z",
          },
        },
      })
    );

    expect(response.status).toBe(200);
    expect(prismaMock.signatureRequest.update).toHaveBeenCalledWith({
      where: { envelopeId: "env-1" },
      data: {
        status: "COMPLETED",
        signedAt: new Date("2026-04-26T10:00:00.000Z"),
      },
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        societyId: "soc-1",
        userId: undefined,
        action: "UPDATE",
        entity: "SignatureRequest",
        entityId: "signature-1",
        details: { envelopeId: "env-1", status: "COMPLETED" },
      }),
    });
  });
});
