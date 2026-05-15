import { describe, expect, it } from "vitest";

import {
  imputationForCategory,
  isNuProprietaireDefault,
  isUsufruitierDefault,
} from "./cashflow-imputation";

describe("imputationForCategory", () => {
  it("loyers → REVENU", () => {
    expect(imputationForCategory("loyers")).toBe("REVENU");
  });

  it("travaux → GROS_TRAVAUX", () => {
    expect(imputationForCategory("travaux")).toBe("GROS_TRAVAUX");
  });

  it("taxes (foncière) → TAXE_FONCIERE", () => {
    expect(imputationForCategory("taxes")).toBe("TAXE_FONCIERE");
  });

  it("charges_copro → CHARGE_COURANTE", () => {
    expect(imputationForCategory("charges_copro")).toBe("CHARGE_COURANTE");
  });

  it("honoraires → HONORAIRES_GESTION", () => {
    expect(imputationForCategory("honoraires")).toBe("HONORAIRES_GESTION");
  });

  it("remboursement_emprunt → ACQUISITION (capital)", () => {
    expect(imputationForCategory("remboursement_emprunt")).toBe("ACQUISITION");
  });

  it("interets_emprunt → CHARGE_COURANTE (usufruitier par convention)", () => {
    expect(imputationForCategory("interets_emprunt")).toBe("CHARGE_COURANTE");
  });

  it("acquisition_immeuble → ACQUISITION", () => {
    expect(imputationForCategory("acquisition_immeuble")).toBe("ACQUISITION");
  });

  it("cession_immeuble → ACQUISITION (capital du nu-propriétaire)", () => {
    expect(imputationForCategory("cession_immeuble")).toBe("ACQUISITION");
  });

  it("retourne null pour les neutres", () => {
    expect(imputationForCategory("virement_interne")).toBeNull();
    expect(imputationForCategory("apport_cca")).toBeNull();
    expect(imputationForCategory("remboursement_cca")).toBeNull();
    expect(imputationForCategory("souscription_emprunt")).toBeNull();
  });

  it("retourne null pour une catégorie inconnue", () => {
    expect(imputationForCategory("inconnue")).toBeNull();
  });
});

describe("isNuProprietaireDefault / isUsufruitierDefault", () => {
  it("travaux → nu-propriétaire", () => {
    expect(isNuProprietaireDefault("travaux")).toBe(true);
    expect(isUsufruitierDefault("travaux")).toBe(false);
  });

  it("loyers → usufruitier", () => {
    expect(isUsufruitierDefault("loyers")).toBe(true);
    expect(isNuProprietaireDefault("loyers")).toBe(false);
  });

  it("charges → usufruitier", () => {
    expect(isUsufruitierDefault("charges_copro")).toBe(true);
  });

  it("neutre → ni l'un ni l'autre", () => {
    expect(isNuProprietaireDefault("virement_interne")).toBe(false);
    expect(isUsufruitierDefault("virement_interne")).toBe(false);
  });

  it("acquisition / cession → nu-propriétaire", () => {
    expect(isNuProprietaireDefault("acquisition_immeuble")).toBe(true);
    expect(isNuProprietaireDefault("cession_immeuble")).toBe(true);
  });
});
