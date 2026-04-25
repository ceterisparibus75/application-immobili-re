// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContactsEmptyState } from "./contacts-empty-state";

describe("ContactsEmptyState", () => {
  it("guide vers la creation, la synchronisation et les donnees liees", () => {
    render(<ContactsEmptyState syncAction={<button type="button">Synchroniser les locataires</button>} />);

    expect(screen.getByRole("heading", { name: "Aucun contact" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Synchroniser les locataires" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ajouter un contact/i })).toHaveAttribute(
      "href",
      "/contacts/nouveau",
    );
    expect(screen.getByRole("link", { name: /Vérifier les locataires/i })).toHaveAttribute(
      "href",
      "/locataires",
    );
    expect(screen.getByRole("link", { name: /Voir le patrimoine/i })).toHaveAttribute(
      "href",
      "/patrimoine/immeubles",
    );
  });
});
