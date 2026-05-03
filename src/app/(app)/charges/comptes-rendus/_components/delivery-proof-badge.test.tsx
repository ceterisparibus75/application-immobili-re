// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeliveryProofBadge } from "./delivery-proof-badge";

describe("DeliveryProofBadge", () => {
  it("affiche la date de preuve d'envoi du décompte", () => {
    render(<DeliveryProofBadge sentAt={new Date("2026-05-03T12:00:00.000Z")} />);

    expect(screen.getByText("Preuve d'envoi 03/05/2026")).toBeInTheDocument();
  });
});
