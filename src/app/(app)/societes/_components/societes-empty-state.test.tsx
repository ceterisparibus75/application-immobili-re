// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SocietesEmptyState } from "./societes-empty-state";

describe("SocietesEmptyState", () => {
  it("guide le premier demarrage autour de la creation de societe", () => {
    render(<SocietesEmptyState />);

    expect(screen.getByRole("heading", { name: "Aucune société" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Créer une société/i })).toHaveAttribute(
      "href",
      "/societes/nouvelle",
    );
    expect(screen.getByRole("link", { name: /Guide de démarrage/i })).toHaveAttribute(
      "href",
      "/aide/demarrage",
    );
    expect(screen.getByRole("link", { name: /Vue propriétaire/i })).toHaveAttribute(
      "href",
      "/proprietaire",
    );
  });
});
