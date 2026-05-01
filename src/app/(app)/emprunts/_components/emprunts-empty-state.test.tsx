// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmpruntsEmptyState } from "./emprunts-empty-state";

describe("EmpruntsEmptyState", () => {
  it("relie le financement aux parcours patrimoine, banque et cash-flow", () => {
    render(<EmpruntsEmptyState />);

    expect(screen.getByRole("heading", { name: "Aucun emprunt" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Nouvel emprunt/i })).toHaveAttribute(
      "href",
      "/emprunts/nouveau",
    );
    expect(screen.getByRole("link", { name: /Rattacher au patrimoine/i })).toHaveAttribute(
      "href",
      "/patrimoine/immeubles",
    );
    expect(screen.getByRole("link", { name: /Connecter la banque/i })).toHaveAttribute("href", "/banque");
    expect(screen.getByRole("link", { name: /Voir le cash-flow/i })).toHaveAttribute(
      "href",
      "/cashflow",
    );
  });
});

