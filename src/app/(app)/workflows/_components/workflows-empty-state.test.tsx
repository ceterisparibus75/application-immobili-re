// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkflowsEmptyState } from "./workflows-empty-state";

describe("WorkflowsEmptyState", () => {
  it("oriente vers des parcours existants au lieu d'un bouton de creation absent", () => {
    render(<WorkflowsEmptyState />);

    expect(screen.getByRole("heading", { name: "Aucun workflow" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Lire le guide workflows/i })[0]).toHaveAttribute(
      "href",
      "/aide/automatisation",
    );
    expect(screen.getByRole("link", { name: /Suivre les relances/i })).toHaveAttribute(
      "href",
      "/relances",
    );
    expect(screen.getByRole("link", { name: /Préparer les courriers/i })).toHaveAttribute(
      "href",
      "/courriers",
    );
  });
});
