// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImmeublesEmptyState } from "./immeubles-empty-state";

describe("ImmeublesEmptyState", () => {
  it("guide vers la creation immeuble et les parcours de structuration", () => {
    render(<ImmeublesEmptyState />);

    expect(screen.getByRole("heading", { name: "Aucun immeuble" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ajouter un immeuble/i })).toHaveAttribute(
      "href",
      "/patrimoine/immeubles/nouveau",
    );
    expect(screen.getByRole("link", { name: /Voir les lots/i })).toHaveAttribute(
      "href",
      "/patrimoine/lots",
    );
    expect(screen.getByRole("link", { name: /Créer un bail complet/i })).toHaveAttribute(
      "href",
      "/baux/nouveau/complet",
    );
  });
});
