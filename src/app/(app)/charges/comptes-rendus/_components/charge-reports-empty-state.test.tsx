// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChargeReportsEmptyState } from "./charge-reports-empty-state";

describe("ChargeReportsEmptyState", () => {
  it("guide vers la generation et les prerequis de regularisation", () => {
    render(<ChargeReportsEmptyState generateAction={<button type="button">Générer les comptes rendus</button>} />);

    expect(screen.getByRole("heading", { name: "Aucun compte rendu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Générer les comptes rendus" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Saisir les charges/i })).toHaveAttribute(
      "href",
      "/charges",
    );
    expect(screen.getByRole("link", { name: /Contrôler les catégories/i })).toHaveAttribute(
      "href",
      "/charges/bibliotheque",
    );
  });
});
