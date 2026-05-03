import { describe, expect, it } from "vitest";
import { buildEmailDeliveryProofStatusSummary } from "./email-delivery-proof-status-summary";

describe("email delivery proof status summary", () => {
  it("retourne tous les statuts avec les compteurs et le niveau de risque", () => {
    expect(
      buildEmailDeliveryProofStatusSummary([
        { status: "DELIVERED", _count: { _all: 12 } },
        { status: "FAILED", _count: { _all: 2 } },
        { status: "BOUNCED", _count: { _all: 1 } },
      ]),
    ).toEqual([
      { status: "DELIVERED", label: "Livré", count: 12, tone: "success" },
      { status: "SENT", label: "Envoyé", count: 0, tone: "neutral" },
      { status: "DELIVERY_DELAYED", label: "Retardé", count: 0, tone: "warning" },
      { status: "BOUNCED", label: "Rejeté", count: 1, tone: "danger" },
      { status: "COMPLAINED", label: "Plainte", count: 0, tone: "danger" },
      { status: "FAILED", label: "Échec", count: 2, tone: "danger" },
    ]);
  });
});
