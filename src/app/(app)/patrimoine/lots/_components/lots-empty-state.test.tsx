// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LotsEmptyState } from "./lots-empty-state";

describe("LotsEmptyState", () => {
  it("oriente vers la structuration du patrimoine et du bail complet", () => {
    render(<LotsEmptyState />);

    expect(screen.getByRole("heading", { name: "Aucun lot" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Créer un immeuble/i })).toHaveAttribute(
      "href",
      "/patrimoine/immeubles/nouveau",
    );
    expect(screen.getByRole("link", { name: /Voir les immeubles/i })).toHaveAttribute(
      "href",
      "/patrimoine/immeubles",
    );
    expect(screen.getByRole("link", { name: /Créer un bail complet/i })).toHaveAttribute(
      "href",
      "/baux/nouveau/complet",
    );
  });
});
