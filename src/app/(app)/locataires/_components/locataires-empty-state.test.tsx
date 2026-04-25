// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocatairesEmptyState } from "./locataires-empty-state";

describe("LocatairesEmptyState", () => {
  it("guide vers les parcours métier utiles quand aucun locataire n'existe", () => {
    render(<LocatairesEmptyState />);

    expect(screen.getByRole("heading", { name: "Aucun locataire" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Créer un locataire/i })).toHaveAttribute(
      "href",
      "/locataires/nouveau",
    );
    expect(screen.getByRole("link", { name: /Suivre les candidatures/i })).toHaveAttribute(
      "href",
      "/candidatures",
    );
    expect(screen.getByRole("link", { name: /Importer un bail signé/i })).toHaveAttribute(
      "href",
      "/baux/import",
    );
    expect(screen.getByRole("link", { name: /Créer le bail complet/i })).toHaveAttribute(
      "href",
      "/baux/nouveau/complet",
    );
  });
});
