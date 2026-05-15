import { describe, it, expect } from "vitest";
import {
  ageAt,
  allocateAmount,
  article669Fraction,
  computeArticle669Values,
  defaultBeneficiaryFor,
  getOwnershipAt,
  snapshotOwnership,
  validateOwnership,
  type OwnershipShare,
} from "./ownership";

const D = (iso: string) => new Date(iso);

const pp = (proprietaireId: string, share = 1, startDate = D("2020-01-01"), endDate: Date | null = null): OwnershipShare => ({
  proprietaireId,
  type: "PLEINE_PROPRIETE",
  share,
  startDate,
  endDate,
});

const us = (proprietaireId: string, share = 1, startDate = D("2020-01-01"), endDate: Date | null = null): OwnershipShare => ({
  proprietaireId,
  type: "USUFRUIT",
  share,
  startDate,
  endDate,
});

const np = (proprietaireId: string, share = 1, startDate = D("2020-01-01"), endDate: Date | null = null): OwnershipShare => ({
  proprietaireId,
  type: "NUE_PROPRIETE",
  share,
  startDate,
  endDate,
});

describe("getOwnershipAt", () => {
  it("retourne les parts actives à une date donnée", () => {
    const ownerships: OwnershipShare[] = [
      pp("alice", 1, D("2020-01-01"), D("2024-06-01")),
      us("bob", 1, D("2024-06-01"), null),
      np("alice", 1, D("2024-06-01"), null),
    ];

    expect(getOwnershipAt(ownerships, D("2022-01-01"))).toHaveLength(1);
    expect(getOwnershipAt(ownerships, D("2022-01-01"))[0].type).toBe("PLEINE_PROPRIETE");

    const after = getOwnershipAt(ownerships, D("2025-01-01"));
    expect(after).toHaveLength(2);
    expect(after.map((o) => o.type).sort()).toEqual(["NUE_PROPRIETE", "USUFRUIT"]);
  });

  it("exclut les parts dont endDate est exactement à la date (fin exclusive)", () => {
    const ownerships = [pp("alice", 1, D("2020-01-01"), D("2024-06-01"))];
    expect(getOwnershipAt(ownerships, D("2024-06-01"))).toHaveLength(0);
  });

  it("inclut les parts dont startDate est exactement à la date (début inclusif)", () => {
    const ownerships = [pp("alice", 1, D("2024-06-01"), null)];
    expect(getOwnershipAt(ownerships, D("2024-06-01"))).toHaveLength(1);
  });
});

describe("snapshotOwnership", () => {
  it("détecte le démembrement", () => {
    const snap = snapshotOwnership([us("bob"), np("alice")], D("2025-01-01"));
    expect(snap.isDismembered).toBe(true);
    expect(snap.usufruit).toHaveLength(1);
    expect(snap.nuePropriete).toHaveLength(1);
    expect(snap.full).toHaveLength(0);
  });

  it("détecte la pleine propriété simple", () => {
    const snap = snapshotOwnership([pp("alice")], D("2025-01-01"));
    expect(snap.isDismembered).toBe(false);
    expect(snap.full).toHaveLength(1);
  });
});

describe("validateOwnership", () => {
  it("accepte une pleine propriété en indivision 50/50", () => {
    const issues = validateOwnership([pp("alice", 0.5), pp("bob", 0.5)], D("2025-01-01"));
    expect(issues).toEqual([]);
  });

  it("rejette une pleine propriété qui ne somme pas à 1", () => {
    const issues = validateOwnership([pp("alice", 0.4), pp("bob", 0.5)], D("2025-01-01"));
    expect(issues.some((i) => i.code === "TOTAL_PLEINE_PROPRIETE_NOT_ONE")).toBe(true);
  });

  it("rejette le mélange PP + démembrement", () => {
    const issues = validateOwnership([pp("alice", 1), us("bob", 1), np("alice", 1)], D("2025-01-01"));
    expect(issues.some((i) => i.code === "MIXED_PP_AND_DEMEMBREMENT")).toBe(true);
  });

  it("rejette un usufruit sans nue-propriété", () => {
    const issues = validateOwnership([us("bob", 1)], D("2025-01-01"));
    expect(issues.some((i) => i.code === "NUE_PROPRIETE_WITHOUT_USUFRUIT")).toBe(true);
  });

  it("rejette une nue-propriété sans usufruit", () => {
    const issues = validateOwnership([np("alice", 1)], D("2025-01-01"));
    expect(issues.some((i) => i.code === "USUFRUIT_WITHOUT_NUE_PROPRIETE")).toBe(true);
  });

  it("rejette une part hors plage [0,1]", () => {
    const issues = validateOwnership([pp("alice", 1.5)], D("2025-01-01"));
    expect(issues.some((i) => i.code === "SHARE_OUT_OF_RANGE")).toBe(true);
  });

  it("accepte un démembrement complet avec indivision sur l'US", () => {
    const issues = validateOwnership(
      [us("bob", 0.5), us("carol", 0.5), np("alice", 1)],
      D("2025-01-01"),
    );
    expect(issues).toEqual([]);
  });
});

describe("defaultBeneficiaryFor", () => {
  it("alloue les revenus à l'usufruitier", () => {
    expect(defaultBeneficiaryFor("REVENU")).toBe("USUFRUITIER");
  });

  it("alloue les gros travaux (art. 606) au nu-propriétaire", () => {
    expect(defaultBeneficiaryFor("GROS_TRAVAUX")).toBe("NU_PROPRIETAIRE");
  });

  it("alloue les charges courantes à l'usufruitier", () => {
    expect(defaultBeneficiaryFor("CHARGE_COURANTE")).toBe("USUFRUITIER");
  });

  it("alloue les indemnités d'assurance capital au nu-propriétaire", () => {
    expect(defaultBeneficiaryFor("INDEMNITE_ASSURANCE_CAPITAL")).toBe("NU_PROPRIETAIRE");
  });
});

describe("allocateAmount — pleine propriété", () => {
  it("alloue tout au propriétaire unique", () => {
    const result = allocateAmount(1000, "REVENU", [pp("alice")], D("2025-01-01"));
    expect(result).toEqual([
      { proprietaireId: "alice", role: "PLEIN_PROPRIETAIRE", amount: 1000, share: 1 },
    ]);
  });

  it("ventile au prorata en indivision", () => {
    const result = allocateAmount(1000, "REVENU", [pp("alice", 0.6), pp("bob", 0.4)], D("2025-01-01"));
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.proprietaireId === "alice")?.amount).toBe(600);
    expect(result.find((r) => r.proprietaireId === "bob")?.amount).toBe(400);
  });
});

describe("allocateAmount — démembrement", () => {
  const split: OwnershipShare[] = [us("bob"), np("alice")];

  it("envoie les loyers à l'usufruitier", () => {
    const result = allocateAmount(1200, "REVENU", split, D("2025-01-01"));
    expect(result).toEqual([
      { proprietaireId: "bob", role: "USUFRUITIER", amount: 1200, share: 1 },
    ]);
  });

  it("envoie les gros travaux au nu-propriétaire", () => {
    const result = allocateAmount(15000, "GROS_TRAVAUX", split, D("2025-01-01"));
    expect(result).toEqual([
      { proprietaireId: "alice", role: "NU_PROPRIETAIRE", amount: 15000, share: 1 },
    ]);
  });

  it("envoie taxe foncière et charges courantes à l'usufruitier", () => {
    expect(allocateAmount(800, "TAXE_FONCIERE", split, D("2025-01-01"))[0].role).toBe("USUFRUITIER");
    expect(allocateAmount(150, "CHARGE_COURANTE", split, D("2025-01-01"))[0].role).toBe("USUFRUITIER");
  });

  it("applique une convention 70/30 entre US et NP", () => {
    const result = allocateAmount(10000, "GROS_TRAVAUX", split, D("2025-01-01"), {
      conventionnelSplit: { usufruitier: 0.7, nuProprietaire: 0.3 },
    });
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.role === "USUFRUITIER")?.amount).toBe(7000);
    expect(result.find((r) => r.role === "NU_PROPRIETAIRE")?.amount).toBe(3000);
  });

  it("rejette une convention dont la somme ≠ 1", () => {
    expect(() =>
      allocateAmount(1000, "REVENU", split, D("2025-01-01"), {
        conventionnelSplit: { usufruitier: 0.6, nuProprietaire: 0.3 },
      }),
    ).toThrow(/somme/i);
  });

  it("supporte une indivision côté usufruit (50/50)", () => {
    const result = allocateAmount(
      1000,
      "REVENU",
      [us("bob", 0.5), us("carol", 0.5), np("alice")],
      D("2025-01-01"),
    );
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.proprietaireId === "bob")?.amount).toBe(500);
    expect(result.find((r) => r.proprietaireId === "carol")?.amount).toBe(500);
  });

  it("permet d'overrider le bénéficiaire via forceRole", () => {
    const result = allocateAmount(1000, "REVENU", split, D("2025-01-01"), { forceRole: "NU_PROPRIETAIRE" });
    expect(result[0].role).toBe("NU_PROPRIETAIRE");
    expect(result[0].proprietaireId).toBe("alice");
  });
});

describe("article669Fraction", () => {
  it("renvoie 90% pour un usufruitier ≤ 20 ans", () => {
    expect(article669Fraction(15)).toBe(0.9);
    expect(article669Fraction(20)).toBe(0.9);
  });

  it("renvoie 70% pour 21–30 ans (borne haute incluse)", () => {
    expect(article669Fraction(21)).toBe(0.8);
    expect(article669Fraction(30)).toBe(0.8);
  });

  it("renvoie 40% pour 61–70 ans", () => {
    expect(article669Fraction(65)).toBe(0.4);
    expect(article669Fraction(70)).toBe(0.4);
  });

  it("renvoie 10% au-delà de 90 ans", () => {
    expect(article669Fraction(95)).toBe(0.1);
    expect(article669Fraction(120)).toBe(0.1);
  });

  it("rejette un âge négatif", () => {
    expect(() => article669Fraction(-1)).toThrow();
  });
});

describe("computeArticle669Values", () => {
  it("partage 300k€ entre US 40% et NP 60% pour 65 ans", () => {
    const v = computeArticle669Values(300000, 65);
    expect(v.usufruitFraction).toBe(0.4);
    expect(v.nuePropertyFraction).toBeCloseTo(0.6, 10);
    expect(v.usufruitValue).toBe(120000);
    expect(v.nuePropertyValue).toBe(180000);
  });

  it("conserve la somme = valeur en pleine propriété", () => {
    const v = computeArticle669Values(123456, 55);
    expect(v.usufruitValue + v.nuePropertyValue).toBeCloseTo(123456, 1);
  });
});

describe("ageAt", () => {
  it("renvoie l'âge atteint à la date donnée", () => {
    expect(ageAt(D("1960-06-15"), D("2025-06-14"))).toBe(64);
    expect(ageAt(D("1960-06-15"), D("2025-06-15"))).toBe(65);
    expect(ageAt(D("1960-06-15"), D("2025-12-31"))).toBe(65);
  });
});
