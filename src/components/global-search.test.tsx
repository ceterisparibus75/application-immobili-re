// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalSearch } from "./global-search";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("GlobalSearch", () => {
  beforeEach(() => {
    push.mockClear();
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    } as Response);
  });

  it("ouvre directement la modale quand initiallyOpen est vrai", () => {
    render(<GlobalSearch initiallyOpen />);

    expect(screen.getByPlaceholderText(/rechercher immeubles/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importer un document" })).toBeInTheDocument();
  });

  it("expose les hubs et actions métier récents", () => {
    render(<GlobalSearch initiallyOpen />);

    expect(screen.getByRole("button", { name: /Ouvrir Location/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ouvrir Finances/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importer un bail PDF/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ajouter un compte bancaire/i })).toBeInTheDocument();
  });

  it("propose les filtres métier étendus", () => {
    render(<GlobalSearch initiallyOpen />);

    expect(screen.getByRole("button", { name: "Compte bancaire" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Charge" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Facture fournisseur" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ticket" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rapport planifié" })).toBeInTheDocument();
  });

  it("filtre les actions rapides depuis la saisie", () => {
    render(<GlobalSearch initiallyOpen />);

    fireEvent.change(screen.getByPlaceholderText(/rechercher immeubles/i), { target: { value: "banque" } });

    expect(screen.getByText("Actions correspondantes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ajouter un compte bancaire/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Créer un bail/i })).not.toBeInTheDocument();
  });

  it("trouve les parcours métier avancés avec des mots-clés naturels", () => {
    render(<GlobalSearch initiallyOpen />);

    fireEvent.change(screen.getByPlaceholderText(/rechercher immeubles/i), { target: { value: "revision" } });

    expect(screen.getByRole("button", { name: /Voir les révisions de loyer/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ajouter un compte bancaire/i })).not.toBeInTheDocument();
  });

  it("expose les actions moins fréquentes quand elles correspondent à la recherche", () => {
    render(<GlobalSearch initiallyOpen />);

    fireEvent.change(screen.getByPlaceholderText(/rechercher immeubles/i), { target: { value: "candidature" } });

    expect(screen.getByRole("button", { name: /Suivre les candidatures/i })).toBeInTheDocument();
  });

  it("navigue vers une action rapide", () => {
    const onClose = vi.fn();
    render(<GlobalSearch initiallyOpen onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /Ouvrir Finances/i }));

    expect(push).toHaveBeenCalledWith("/finances");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("notifie la fermeture de la modale", () => {
    const onClose = vi.fn();
    render(<GlobalSearch initiallyOpen onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
