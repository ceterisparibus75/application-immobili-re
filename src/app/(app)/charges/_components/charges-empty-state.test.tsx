// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChargesEmptyState } from "./charges-empty-state";

describe("ChargesEmptyState", () => {
  it("guide vers la saisie et les parcours de regularisation", () => {
    render(<ChargesEmptyState hasBuildings />);

    expect(screen.getByRole("heading", { name: "Aucune charge" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Nouvelle charge/i })).toHaveAttribute(
      "href",
      "/charges/nouvelle",
    );
    expect(screen.queryByRole("link", { name: /Créer un immeuble/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voir la bibliothèque/i })).toHaveAttribute(
      "href",
      "/charges/bibliotheque",
    );
    expect(screen.getByRole("link", { name: /Préparer les régularisations/i })).toHaveAttribute(
      "href",
      "/charges/comptes-rendus",
    );
  });

  it("propose de creer un immeuble quand aucune structure n'existe", () => {
    render(<ChargesEmptyState hasBuildings={false} />);

    expect(screen.getByRole("link", { name: /Créer un immeuble/i })).toHaveAttribute(
      "href",
      "/patrimoine/immeubles/nouveau",
    );
  });
});
