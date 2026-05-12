import { describe, it, expect } from "vitest";
import {
  Decimal,
  toMoney,
  decimalToNumber,
  decimalToString,
  roundMoney,
  roundPercent,
  addMoney,
  subMoney,
  mulMoney,
  divMoney,
  sumMoney,
  moneyEquals,
  moneyApproxEquals,
  isZero,
  isPositive,
  isNegative,
  formatMoney,
} from "./money";

describe("toMoney — conversion robuste", () => {
  it("convertit un number en Decimal", () => {
    const d = toMoney(1234.56);
    expect(d).toBeInstanceOf(Decimal);
    expect(d?.toString()).toBe("1234.56");
  });

  it("convertit un string avec virgule française", () => {
    expect(toMoney("1 234,56")?.toString()).toBe("1234.56");
    expect(toMoney("  1234,56 ")?.toString()).toBe("1234.56");
  });

  it("convertit un string avec point", () => {
    expect(toMoney("1234.56")?.toString()).toBe("1234.56");
  });

  it("passe à travers si déjà un Decimal", () => {
    const input = new Decimal("99.99");
    expect(toMoney(input)).toBe(input);
  });

  it("retourne null pour null / undefined / string vide", () => {
    expect(toMoney(null)).toBeNull();
    expect(toMoney(undefined)).toBeNull();
    expect(toMoney("")).toBeNull();
    expect(toMoney("   ")).toBeNull();
  });

  it("rejette NaN / Infinity", () => {
    expect(() => toMoney(Number.NaN)).toThrow(/invalid number/);
    expect(() => toMoney(Number.POSITIVE_INFINITY)).toThrow(/invalid number/);
  });
});

describe("decimalToNumber / decimalToString — frontière sérialisation", () => {
  it("decimalToNumber convertit pour Recharts", () => {
    expect(decimalToNumber(new Decimal("123.45"))).toBe(123.45);
    expect(decimalToNumber(null)).toBe(0);
    expect(decimalToNumber(undefined)).toBe(0);
  });

  it("decimalToString preserve la précision JSON", () => {
    expect(decimalToString(new Decimal("123.45"))).toBe("123.45");
    expect(decimalToString(new Decimal("0.1"))).toBe("0.10");
    expect(decimalToString(null)).toBe("0");
  });
});

describe("roundMoney — banker's rounding", () => {
  it("arrondit à 2 décimales", () => {
    expect(roundMoney(new Decimal("1.234")).toString()).toBe("1.23");
    expect(roundMoney(new Decimal("1.236")).toString()).toBe("1.24");
  });

  it("utilise ROUND_HALF_EVEN sur les .5", () => {
    // 1.225 → 1.22 (arrondir vers le pair)
    expect(roundMoney(new Decimal("1.225")).toString()).toBe("1.22");
    // 1.235 → 1.24 (arrondir vers le pair)
    expect(roundMoney(new Decimal("1.235")).toString()).toBe("1.24");
  });

  it("roundPercent garde 4 décimales", () => {
    expect(roundPercent(new Decimal("0.123456")).toString()).toBe("0.1235");
  });
});

describe("Arithmétique sans perte de précision", () => {
  it("addMoney évite 0.1 + 0.2 = 0.30000000000000004", () => {
    expect(addMoney(new Decimal("0.1"), new Decimal("0.2")).toString()).toBe("0.3");
  });

  it("subMoney soustrait à l'euro près", () => {
    expect(subMoney(new Decimal("100"), new Decimal("33.33")).toString()).toBe("66.67");
  });

  it("mulMoney accepte un factor number (taux TVA)", () => {
    // 1000 HT × 1.20 = 1200 TTC
    expect(mulMoney(new Decimal("1000"), 1.2).toString()).toBe("1200");
    // 100 × 0.196 = 19.60 → 19.60
    expect(mulMoney(new Decimal("100"), 0.196).toString()).toBe("19.6");
  });

  it("divMoney pour pourcentages", () => {
    // 1200 / 1.2 = 1000
    expect(divMoney(new Decimal("1200"), 1.2).toString()).toBe("1000");
  });

  it("sumMoney sur tableau", () => {
    const values = [new Decimal("100"), new Decimal("200.50"), new Decimal("0.01")];
    expect(sumMoney(values).toString()).toBe("300.51");
  });

  it("sumMoney ignore null/undefined", () => {
    const values = [new Decimal("100"), null, new Decimal("50"), undefined];
    expect(sumMoney(values).toString()).toBe("150");
  });

  it("sumMoney sur tableau vide → 0", () => {
    expect(sumMoney([]).toString()).toBe("0");
    expect(sumMoney([null, undefined]).toString()).toBe("0");
  });
});

describe("Comparaisons monétaires", () => {
  it("moneyEquals: égalité après arrondi à 2 décimales", () => {
    expect(moneyEquals(new Decimal("1.005"), new Decimal("1.00"))).toBe(true); // 1.005 → 1.00
    expect(moneyEquals(new Decimal("100.00"), new Decimal("100"))).toBe(true);
    expect(moneyEquals(new Decimal("100.01"), new Decimal("100"))).toBe(false);
  });

  it("moneyApproxEquals tolère 0.01 par défaut", () => {
    expect(moneyApproxEquals(new Decimal("100.00"), new Decimal("100.005"))).toBe(true);
    expect(moneyApproxEquals(new Decimal("100"), new Decimal("100.02"))).toBe(false);
  });

  it("moneyApproxEquals tolérance custom", () => {
    expect(moneyApproxEquals(new Decimal("100"), new Decimal("105"), 5)).toBe(true);
    expect(moneyApproxEquals(new Decimal("100"), new Decimal("105"), 4.99)).toBe(false);
  });

  it("isZero / isPositive / isNegative", () => {
    expect(isZero(new Decimal("0"))).toBe(true);
    expect(isZero(new Decimal("0.001"))).toBe(true); // arrondi à 0.00
    expect(isZero(new Decimal("0.01"))).toBe(false);

    expect(isPositive(new Decimal("0.01"))).toBe(true);
    expect(isPositive(new Decimal("0"))).toBe(false);
    expect(isPositive(new Decimal("-0.01"))).toBe(false);

    expect(isNegative(new Decimal("-0.01"))).toBe(true);
    expect(isNegative(new Decimal("0"))).toBe(false);
  });
});

describe("formatMoney — locale française", () => {
  it("formate un Decimal en EUR", () => {
    expect(formatMoney(new Decimal("1234.56"))).toMatch(/1\s?234,56\s*€/);
  });

  it("accepte un number directement", () => {
    expect(formatMoney(1234.56)).toMatch(/1\s?234,56\s*€/);
  });

  it("accepte un string", () => {
    expect(formatMoney("1234,56")).toMatch(/1\s?234,56\s*€/);
  });

  it("null / undefined → 0,00 €", () => {
    expect(formatMoney(null)).toMatch(/^0,00\s*€$/);
    expect(formatMoney(undefined)).toMatch(/^0,00\s*€$/);
  });
});

describe("Scénarios métier — invariants comptables", () => {
  it("Total TTC = somme des lignes (pas d'erreur de centime)", () => {
    // 3 lignes de loyer + charges : HT × TVA → TTC
    const lines = [
      { ht: new Decimal("1000"), vat: 0.2 },    // 1200
      { ht: new Decimal("123.45"), vat: 0.2 },  // 148.14
      { ht: new Decimal("0.10"), vat: 0.2 },    // 0.12
    ];
    const totals = lines.map((l) => mulMoney(l.ht, 1 + l.vat));
    const totalTTC = sumMoney(totals);
    expect(totalTTC.toString()).toBe("1348.26");
  });

  it("Equilibre débit/crédit sur écriture comptable", () => {
    // Loyer 1500 HT, TVA 20%, soit 1800 TTC :
    //   411 Clients     debit  1800
    //   706 Loyers HT   credit 1500
    //   44571 TVA col.  credit  300
    const debit = sumMoney([new Decimal("1800")]);
    const credit = sumMoney([new Decimal("1500"), new Decimal("300")]);
    expect(moneyEquals(debit, credit)).toBe(true);
  });

  it("Acompte fractionné : 3 versements de 333.33 cumulent à 999.99", () => {
    const payments = [new Decimal("333.33"), new Decimal("333.33"), new Decimal("333.33")];
    const paid = sumMoney(payments);
    expect(paid.toString()).toBe("999.99");
    // Diff vs 1000 = 0.01 → tolérance 0.001 trop stricte
    expect(moneyApproxEquals(paid, new Decimal("1000"), 0.001)).toBe(false);
    // Tolérance 0.01 inclut l'écart de centime
    expect(moneyApproxEquals(paid, new Decimal("1000"), 0.01)).toBe(true);
  });
});
