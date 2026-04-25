import { describe, expect, it } from "vitest";

import { getFinancesGuidance, getLocationGuidance } from "./module-guidance";

describe("module guidance", () => {
  it("guide un démarrage locatif sans locataire ni bail", () => {
    const steps = getLocationGuidance({
      activeLeases: 0,
      activeTenants: 0,
      lateInvoices: 0,
      openTickets: 0,
    });

    expect(steps).toEqual([
      expect.objectContaining({
        title: "Ajouter le premier locataire",
        href: "/locataires/nouveau",
      }),
      expect.objectContaining({
        title: "Créer ou importer un bail",
        href: "/baux/nouveau",
      }),
    ]);
  });

  it("priorise les points locatifs à traiter quand le portefeuille est actif", () => {
    const steps = getLocationGuidance({
      activeLeases: 4,
      activeTenants: 3,
      lateInvoices: 2,
      openTickets: 1,
    });

    expect(steps.map((step) => step.title)).toEqual([
      "Générer les appels de loyers",
      "Traiter les impayés",
      "Répondre aux demandes",
    ]);
  });

  it("guide un démarrage financier sans compte bancaire", () => {
    const steps = getFinancesGuidance({
      bankAccounts: 0,
      draftEntries: 0,
      unpaidInvoices: 0,
    });

    expect(steps.map((step) => step.href)).toEqual([
      "/banque/nouveau-compte",
      "/banque/connexion",
      "/comptabilite/nouvelle-ecriture",
    ]);
  });

  it("priorise le rapprochement, les brouillons et les encaissements", () => {
    const steps = getFinancesGuidance({
      bankAccounts: 2,
      draftEntries: 5,
      unpaidInvoices: 4,
    });

    expect(steps.map((step) => step.title)).toEqual([
      "Rapprocher les mouvements",
      "Valider les écritures brouillon",
      "Suivre les factures à encaisser",
    ]);
  });
});
