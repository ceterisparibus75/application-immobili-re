// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeliveryProofPdfButton } from "./delivery-proof-pdf-button";

describe("DeliveryProofPdfButton", () => {
  it("ouvre l'attestation PDF de preuve d'envoi", () => {
    render(<DeliveryProofPdfButton deliveryId="delivery-1" />);

    const link = screen.getByRole("link", { name: "Preuve" });
    expect(link).toHaveAttribute("href", "/api/charges/delivery-proofs/delivery-1/pdf");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
