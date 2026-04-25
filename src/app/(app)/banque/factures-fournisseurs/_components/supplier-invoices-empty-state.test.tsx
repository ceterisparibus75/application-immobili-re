// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SupplierInvoicesEmptyState } from "./supplier-invoices-empty-state";

describe("SupplierInvoicesEmptyState", () => {
  it("guide vers l'upload, la configuration email et le rattachement metier", () => {
    render(<SupplierInvoicesEmptyState />);

    expect(screen.getByRole("heading", { name: "Aucune facture fournisseur" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Uploader une facture/i })).toHaveAttribute(
      "href",
      "/banque/factures-fournisseurs/nouveau",
    );
    expect(screen.getByRole("link", { name: /Configurer l'email/i })).toHaveAttribute(
      "href",
      "/parametres/facturation",
    );
    expect(screen.getByRole("link", { name: /Voir les charges/i })).toHaveAttribute(
      "href",
      "/charges",
    );
    expect(screen.getByRole("link", { name: /Rattacher un immeuble/i })).toHaveAttribute(
      "href",
      "/patrimoine/immeubles",
    );
  });
});
