import { describe, expect, it } from "vitest";
import { buildEmailDeliveryProofWhere, normalizeEmailDeliveryProofFilters } from "./email-delivery-proof-filters";

describe("email delivery proof filters", () => {
  it("normalise les filtres supportés et ignore les valeurs invalides", () => {
    expect(
      normalizeEmailDeliveryProofFilters({
        status: "BOUNCED",
        type: "INVOICE",
        q: "  facture avril  ",
        from: "2026-01-01",
        to: "2026-01-31",
      }),
    ).toEqual({
      status: "BOUNCED",
      entityType: "INVOICE",
      query: "facture avril",
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-01-31T23:59:59.999Z"),
    });

    expect(
      normalizeEmailDeliveryProofFilters({
        status: "UNKNOWN",
        type: "BAD_TYPE",
        q: "ab",
        from: "not-a-date",
        to: "",
      }),
    ).toEqual({});
  });

  it("construit une clause Prisma scopée par société avec recherche multi-champs", () => {
    expect(
      buildEmailDeliveryProofWhere("society-1", {
        status: "FAILED",
        entityType: "LETTER",
        query: "contact@mtg-groupe.fr",
        from: new Date("2026-02-01T00:00:00.000Z"),
        to: new Date("2026-02-28T23:59:59.999Z"),
      }),
    ).toEqual({
      societyId: "society-1",
      status: "FAILED",
      entityType: "LETTER",
      createdAt: {
        gte: new Date("2026-02-01T00:00:00.000Z"),
        lte: new Date("2026-02-28T23:59:59.999Z"),
      },
      OR: [
        { recipientEmail: { contains: "contact@mtg-groupe.fr", mode: "insensitive" } },
        { recipientName: { contains: "contact@mtg-groupe.fr", mode: "insensitive" } },
        { subject: { contains: "contact@mtg-groupe.fr", mode: "insensitive" } },
        { providerMessageId: { contains: "contact@mtg-groupe.fr", mode: "insensitive" } },
        { entityId: { contains: "contact@mtg-groupe.fr", mode: "insensitive" } },
      ],
    });
  });
});
