// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CandidaturesEmptyState } from "./candidatures-empty-state";

describe("CandidaturesEmptyState", () => {
  it("remplace le cul-de-sac par des liens vers des parcours existants", () => {
    render(<CandidaturesEmptyState />);

    expect(screen.getByRole("heading", { name: "Aucune candidature" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Ajouter une candidature/i })[0]).toHaveAttribute(
      "href",
      "/candidatures/nouvelle",
    );
    expect(screen.getByRole("link", { name: /Ouvrir le parcours/i })).toHaveAttribute(
      "href",
      "/location/mise-en-location",
    );
    expect(screen.getByRole("link", { name: /Créer le bail complet/i })).toHaveAttribute(
      "href",
      "/baux/nouveau/complet",
    );
    expect(screen.getByRole("link", { name: /Comprendre le pipeline/i })).toHaveAttribute(
      "href",
      "/aide/candidatures",
    );
  });
});
