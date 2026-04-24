import { describe, it, expect } from "vitest";
import {
  LEGAL_FORMS,
  LEGAL_FORM_LABELS,
  TAX_REGIMES,
  VAT_REGIMES,
  USER_ROLES,
  FISCAL_REGIMES,
  FISCAL_REGIME_LABELS,
  ITEMS_PER_PAGE,
  BUILDING_TYPES,
  LOT_TYPES,
  LOT_STATUSES,
  DIAGNOSTIC_TYPES,
} from "./constants";

describe("LEGAL_FORMS", () => {
  it("contient 9 formes juridiques", () => {
    expect(LEGAL_FORMS).toHaveLength(9);
  });

  it("contient PERSONNE_PHYSIQUE", () => {
    expect(LEGAL_FORMS.some((f) => f.value === "PERSONNE_PHYSIQUE")).toBe(true);
  });

  it("chaque forme a value et label", () => {
    for (const form of LEGAL_FORMS) {
      expect(form.value).toBeTruthy();
      expect(form.label).toBeTruthy();
    }
  });
});

describe("LEGAL_FORM_LABELS", () => {
  it("contient une clé pour chaque forme légale", () => {
    for (const form of LEGAL_FORMS) {
      expect(LEGAL_FORM_LABELS[form.value]).toBeTruthy();
    }
  });
});

describe("TAX_REGIMES", () => {
  it("contient IS et IR", () => {
    const values = TAX_REGIMES.map((r) => r.value);
    expect(values).toContain("IS");
    expect(values).toContain("IR");
  });
});

describe("VAT_REGIMES", () => {
  it("contient TVA et FRANCHISE", () => {
    const values = VAT_REGIMES.map((r) => r.value);
    expect(values).toContain("TVA");
    expect(values).toContain("FRANCHISE");
  });
});

describe("USER_ROLES", () => {
  it("contient 5 rôles", () => {
    expect(USER_ROLES).toHaveLength(5);
  });

  it("contient SUPER_ADMIN et LECTURE", () => {
    const values = USER_ROLES.map((r) => r.value);
    expect(values).toContain("SUPER_ADMIN");
    expect(values).toContain("LECTURE");
  });
});

describe("FISCAL_REGIMES", () => {
  it("contient 6 régimes", () => {
    expect(FISCAL_REGIMES).toHaveLength(6);
  });

  it("contient LMNP_MICRO_BIC", () => {
    expect(FISCAL_REGIMES.some((r) => r.value === "LMNP_MICRO_BIC")).toBe(true);
  });
});

describe("FISCAL_REGIME_LABELS", () => {
  it("contient une clé pour chaque régime fiscal", () => {
    for (const regime of FISCAL_REGIMES) {
      expect(FISCAL_REGIME_LABELS[regime.value]).toBeTruthy();
    }
  });
});

describe("ITEMS_PER_PAGE", () => {
  it("vaut 25", () => {
    expect(ITEMS_PER_PAGE).toBe(25);
  });
});

describe("BUILDING_TYPES", () => {
  it("contient BUREAU, COMMERCE, MIXTE, ENTREPOT", () => {
    const values = BUILDING_TYPES.map((t) => t.value);
    expect(values).toContain("BUREAU");
    expect(values).toContain("COMMERCE");
    expect(values).toContain("MIXTE");
    expect(values).toContain("ENTREPOT");
  });
});

describe("LOT_TYPES", () => {
  it("contient 9 types de lot", () => {
    expect(LOT_TYPES).toHaveLength(9);
  });

  it("contient APPARTEMENT et PARKING", () => {
    const values = LOT_TYPES.map((t) => t.value);
    expect(values).toContain("APPARTEMENT");
    expect(values).toContain("PARKING");
  });
});

describe("LOT_STATUSES", () => {
  it("contient VACANT, OCCUPE, EN_TRAVAUX, RESERVE", () => {
    const values = LOT_STATUSES.map((s) => s.value);
    expect(values).toContain("VACANT");
    expect(values).toContain("OCCUPE");
    expect(values).toContain("EN_TRAVAUX");
    expect(values).toContain("RESERVE");
  });
});

describe("DIAGNOSTIC_TYPES", () => {
  it("contient 9 types", () => {
    expect(DIAGNOSTIC_TYPES).toHaveLength(9);
  });

  it("contient DPE et AMIANTE", () => {
    const values = DIAGNOSTIC_TYPES.map((t) => t.value);
    expect(values).toContain("DPE");
    expect(values).toContain("AMIANTE");
  });
});
