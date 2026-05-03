import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import { createEmailDeliveryProof, applyResendDeliveryEvent } from "./email-delivery-proof";

describe("email-delivery-proof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.emailDeliveryProof.create.mockResolvedValue({ id: "proof-1" } as never);
    prismaMock.emailDeliveryProof.findMany.mockResolvedValue([{ id: "proof-1" }] as never);
  });

  it("crée une preuve d'envoi avec empreintes HTML et pièce jointe", async () => {
    const proof = await createEmailDeliveryProof({
      societyId: "soc-1",
      sentById: "user-1",
      entityType: "INVOICE",
      entityId: "invoice-1",
      invoiceId: "invoice-1",
      tenantId: "tenant-1",
      recipientEmail: "tenant@example.test",
      recipientName: "Jean Dupont",
      subject: "Facture F-2026-001",
      html: "<p>Bonjour</p>",
      providerMessageId: "email-123",
      attachments: [{ filename: "facture.pdf", content: Buffer.from("pdf") }],
      evidence: { route: "invoice.send-email" },
    });

    expect(proof.id).toBe("proof-1");
    expect(prismaMock.emailDeliveryProof.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        societyId: "soc-1",
        sentById: "user-1",
        entityType: "INVOICE",
        entityId: "invoice-1",
        invoiceId: "invoice-1",
        recipientEmail: "tenant@example.test",
        subject: "Facture F-2026-001",
        provider: "resend",
        providerMessageId: "email-123",
        status: "SENT",
        htmlSnapshot: "<p>Bonjour</p>",
        htmlSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        attachmentFileName: "facture.pdf",
        attachmentSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        attachmentSizeBytes: 3,
      }),
    });
  });

  it("applique un événement Resend livré et historise le payload", async () => {
    const result = await applyResendDeliveryEvent({
      providerEventId: "evt-1",
      event: {
        type: "email.delivered",
        created_at: "2026-05-04T08:00:00.000Z",
        data: { email_id: "email-123" },
      },
    });

    expect(result).toEqual({ matched: 1 });
    expect(prismaMock.emailDeliveryProof.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["proof-1"] } },
      data: expect.objectContaining({
        status: "DELIVERED",
        deliveredAt: new Date("2026-05-04T08:00:00.000Z"),
        lastEventAt: new Date("2026-05-04T08:00:00.000Z"),
        lastEventType: "email.delivered",
      }),
    });
    expect(prismaMock.emailDeliveryEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          proofId: "proof-1",
          providerEventId: "evt-1",
          eventType: "email.delivered",
          occurredAt: new Date("2026-05-04T08:00:00.000Z"),
        }),
      ],
      skipDuplicates: true,
    });
  });
});
