// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmailDeliveryProofsCard } from "./email-delivery-proofs-card";

describe("EmailDeliveryProofsCard", () => {
  it("affiche l'historique des preuves et le lien d'attestation PDF", () => {
    render(
      <EmailDeliveryProofsCard
        proofs={[
          {
            id: "proof-1",
            createdAt: new Date("2026-05-04T10:00:00.000Z"),
            status: "DELIVERED",
            recipientEmail: "locataire@example.test",
            subject: "Facture 2026",
            providerMessageId: "email-123",
            deliveredAt: new Date("2026-05-04T10:01:00.000Z"),
            bouncedAt: null,
            complainedAt: null,
            deliveryDelayedAt: null,
            htmlSha256: "abc123",
            attachmentSha256: "def456",
            eventsCount: 2,
          },
        ]}
      />
    );

    expect(screen.getByText("Preuves d'envoi")).toBeInTheDocument();
    expect(screen.getByText("Livré")).toBeInTheDocument();
    expect(screen.getByText("locataire@example.test")).toBeInTheDocument();
    expect(screen.getByText(/email-123/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Attestation PDF" })).toHaveAttribute(
      "href",
      "/api/email-delivery-proofs/proof-1/pdf"
    );
  });

  it("affiche un état vide si aucun envoi n'est historisé", () => {
    render(<EmailDeliveryProofsCard proofs={[]} />);

    expect(screen.getByText("Aucun envoi historisé pour cette facture.")).toBeInTheDocument();
  });
});
