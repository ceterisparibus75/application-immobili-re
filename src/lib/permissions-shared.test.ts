import { describe, it, expect } from "vitest";
import {
  MODULES,
  MODULE_LABELS,
  DISPLAY_MODULES,
  getDefaultPermissions,
} from "./permissions-shared";

describe("MODULES", () => {
  it("contient au moins 16 modules", () => {
    expect(MODULES.length).toBeGreaterThanOrEqual(16);
  });

  it("contient les modules métier clés", () => {
    expect(MODULES).toContain("patrimoine");
    expect(MODULES).toContain("baux");
    expect(MODULES).toContain("facturation");
    expect(MODULES).toContain("comptabilite");
  });

  it("contient les modules internes", () => {
    expect(MODULES).toContain("rapports");
    expect(MODULES).toContain("rgpd");
    expect(MODULES).toContain("administration");
  });
});

describe("MODULE_LABELS", () => {
  it("a un label pour chaque module", () => {
    for (const mod of MODULES) {
      expect(MODULE_LABELS[mod]).toBeTruthy();
    }
  });
});

describe("DISPLAY_MODULES", () => {
  it("ne contient pas les modules internes", () => {
    expect(DISPLAY_MODULES).not.toContain("rapports");
    expect(DISPLAY_MODULES).not.toContain("rgpd");
    expect(DISPLAY_MODULES).not.toContain("administration");
  });

  it("contient les modules métier visibles", () => {
    expect(DISPLAY_MODULES).toContain("patrimoine");
    expect(DISPLAY_MODULES).toContain("facturation");
    expect(DISPLAY_MODULES).toContain("dashboard");
  });
});

describe("getDefaultPermissions", () => {
  describe("SUPER_ADMIN", () => {
    const perms = getDefaultPermissions("SUPER_ADMIN");

    it("a tous les droits sur patrimoine", () => {
      expect(perms.patrimoine).toContain("read");
      expect(perms.patrimoine).toContain("write");
      expect(perms.patrimoine).toContain("delete");
    });

    it("a tous les droits sur utilisateurs", () => {
      expect(perms.utilisateurs).toContain("read");
      expect(perms.utilisateurs).toContain("write");
      expect(perms.utilisateurs).toContain("delete");
    });

    it("a lecture seule sur dashboard", () => {
      expect(perms.dashboard).toEqual(["read"]);
    });

    it("couvre tous les modules", () => {
      for (const mod of MODULES) {
        expect(perms[mod]).toBeDefined();
      }
    });
  });

  describe("ADMIN_SOCIETE", () => {
    const perms = getDefaultPermissions("ADMIN_SOCIETE");

    it("a read-write (pas delete) sur parametres", () => {
      expect(perms.parametres).toContain("read");
      expect(perms.parametres).toContain("write");
      expect(perms.parametres).not.toContain("delete");
    });

    it("a tous les droits sur baux", () => {
      expect(perms.baux).toContain("read");
      expect(perms.baux).toContain("write");
      expect(perms.baux).toContain("delete");
    });
  });

  describe("GESTIONNAIRE", () => {
    const perms = getDefaultPermissions("GESTIONNAIRE");

    it("n'a pas accès à utilisateurs", () => {
      expect(perms.utilisateurs).toHaveLength(0);
    });

    it("n'a pas accès à parametres", () => {
      expect(perms.parametres).toHaveLength(0);
    });

    it("a read-write sur facturation", () => {
      expect(perms.facturation).toContain("read");
      expect(perms.facturation).toContain("write");
      expect(perms.facturation).not.toContain("delete");
    });

    it("a lecture seule sur comptabilite", () => {
      expect(perms.comptabilite).toEqual(["read"]);
    });
  });

  describe("COMPTABLE", () => {
    const perms = getDefaultPermissions("COMPTABLE");

    it("a read-write sur facturation", () => {
      expect(perms.facturation).toContain("read");
      expect(perms.facturation).toContain("write");
    });

    it("a lecture seule sur patrimoine", () => {
      expect(perms.patrimoine).toEqual(["read"]);
    });

    it("n'a pas accès à rgpd", () => {
      expect(perms.rgpd).toHaveLength(0);
    });
  });

  describe("LECTURE", () => {
    const perms = getDefaultPermissions("LECTURE");

    it("n'a que lecture sur tous les modules métier", () => {
      const metierModules = ["patrimoine", "baux", "locataires", "facturation", "comptabilite", "banque"] as const;
      for (const mod of metierModules) {
        expect(perms[mod]).toEqual(["read"]);
      }
    });

    it("n'a pas accès à utilisateurs", () => {
      expect(perms.utilisateurs).toHaveLength(0);
    });
  });

  describe("rôle inconnu (fallback LECTURE)", () => {
    const perms = getDefaultPermissions("INCONNU");

    it("traite un rôle inconnu comme LECTURE", () => {
      expect(perms.patrimoine).toEqual(["read"]);
      expect(perms.utilisateurs).toHaveLength(0);
    });
  });
});
