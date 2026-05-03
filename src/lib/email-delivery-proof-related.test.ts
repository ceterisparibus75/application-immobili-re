import { describe, expect, it } from "vitest";
import { buildRelatedEmailDeliveryProofWhere } from "./email-delivery-proof-related";

describe("email delivery proof related query", () => {
  it("relie les preuves par facture et par entité en excluant la preuve courante", () => {
    expect(
      buildRelatedEmailDeliveryProofWhere({
        societyId: "soc-1",
        currentProofId: "proof-1",
        invoiceId: "invoice-1",
        entityType: "INVOICE",
        entityId: "invoice-1",
      }),
    ).toEqual({
      societyId: "soc-1",
      id: { not: "proof-1" },
      OR: [{ invoiceId: "invoice-1" }, { entityType: "INVOICE", entityId: "invoice-1" }],
    });
  });

  it("retourne une clause impossible si aucune clé de rattachement n'existe", () => {
    expect(
      buildRelatedEmailDeliveryProofWhere({
        societyId: "soc-1",
        currentProofId: "proof-1",
        invoiceId: null,
        entityType: "LETTER",
        entityId: null,
      }),
    ).toEqual({
      societyId: "soc-1",
      id: "__no_related_email_delivery_proof__",
    });
  });
});
