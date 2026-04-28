import { describe, expect, it } from "vitest";
import { getTenantDisplayName, getTenantMailingAddress } from "./tenant-format";

describe("tenant-format", () => {
  it("affiche une personne physique avec son prenom et son nom", () => {
    expect(getTenantDisplayName({
      entityType: "PERSONNE_PHYSIQUE",
      firstName: " Alice ",
      lastName: " Durand ",
      companyName: "Societe ignoree",
    })).toBe("Alice Durand");
  });

  it("affiche une personne morale avec sa raison sociale", () => {
    expect(getTenantDisplayName({
      entityType: "PERSONNE_MORALE",
      companyName: " BL & Associes ",
      firstName: null,
      lastName: null,
    })).toBe("BL & Associes");
  });

  it("utilise l'adresse de siege pour une personne morale", () => {
    expect(getTenantMailingAddress({
      entityType: "PERSONNE_MORALE",
      companyAddress: " 3 bis rue des Archives ",
      personalAddress: "Adresse personnelle",
    })).toBe("3 bis rue des Archives");
  });

  it("garde un fallback vide pour les documents quand l'identite est absente", () => {
    expect(getTenantDisplayName({ firstName: null, lastName: null }, "")).toBe("");
  });
});
