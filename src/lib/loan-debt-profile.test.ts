import { describe, it, expect } from "vitest";
import { buildDebtProfile } from "./loan-debt-profile";
import type { LoanForProfile } from "./loan-debt-profile";

const TODAY = new Date(2026, 4, 1); // 1er mai 2026

function d(year: number, month: number, day = 1) {
  return new Date(year, month - 1, day);
}

function makeLoan(overrides: Partial<LoanForProfile> & { id: string }): LoanForProfile {
  return {
    label: "Pret test",
    lender: "BNP",
    amount: 100_000,
    status: "EN_COURS",
    loanType: "AMORTISSABLE",
    startDate: d(2021, 1),
    endDate: d(2031, 1),
    durationMonths: 120,
    amortizationLines: [],
    ...overrides,
  };
}

describe("buildDebtProfile", () => {
  it("returns empty arrays when no loans", () => {
    expect(buildDebtProfile([], TODAY)).toEqual({ timeline: [], extinctionCurve: [] });
  });

  it("excludes COMPTE_COURANT loans from the timeline", () => {
    const loan = makeLoan({ id: "l1", loanType: "COMPTE_COURANT" });
    expect(buildDebtProfile([loan], TODAY).timeline).toHaveLength(0);
  });

  it("excludes TERMINE loans from the timeline", () => {
    const loan = makeLoan({ id: "l1", status: "TERMINE" });
    expect(buildDebtProfile([loan], TODAY).timeline).toHaveLength(0);
  });

  it("includes EN_COURS AMORTISSABLE loans in the timeline", () => {
    const loan = makeLoan({ id: "l1" });
    const { timeline } = buildDebtProfile([loan], TODAY);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].id).toBe("l1");
  });

  it("computes monthsRemaining from today to endDate", () => {
    const loan = makeLoan({ id: "l1", endDate: d(2026, 8) });
    expect(buildDebtProfile([loan], TODAY).timeline[0].monthsRemaining).toBe(3);
  });

  it("assigns urgency critical when less than 12 months remaining", () => {
    const loan = makeLoan({ id: "l1", endDate: d(2026, 8) });
    expect(buildDebtProfile([loan], TODAY).timeline[0].urgency).toBe("critical");
  });

  it("assigns urgency soon when 12 to 36 months remaining", () => {
    const loan = makeLoan({ id: "l1", endDate: d(2028, 5) });
    const item = buildDebtProfile([loan], TODAY).timeline[0];
    expect(item.monthsRemaining).toBe(24);
    expect(item.urgency).toBe("soon");
  });

  it("assigns urgency normal when more than 36 months remaining", () => {
    const loan = makeLoan({ id: "l1", endDate: d(2031, 5) });
    expect(buildDebtProfile([loan], TODAY).timeline[0].urgency).toBe("normal");
  });

  it("uses last past line remainingBalance as currentCrd", () => {
    const loan = makeLoan({
      id: "l1",
      amortizationLines: [
        { period: 64, dueDate: d(2026, 4), remainingBalance: 62_000 },
        { period: 65, dueDate: d(2026, 5), remainingBalance: 61_500 },
        { period: 66, dueDate: d(2026, 6), remainingBalance: 61_000 },
      ],
    });
    expect(buildDebtProfile([loan], TODAY).timeline[0].currentCrd).toBe(61_500);
  });

  it("uses loan amount as currentCrd when no past lines", () => {
    const loan = makeLoan({
      id: "l1",
      amount: 80_000,
      amortizationLines: [
        { period: 1, dueDate: d(2026, 6), remainingBalance: 79_500 },
      ],
    });
    expect(buildDebtProfile([loan], TODAY).timeline[0].currentCrd).toBe(80_000);
  });

  it("computes progressPct from amount and currentCrd", () => {
    const loan = makeLoan({
      id: "l1",
      amount: 100_000,
      amortizationLines: [
        { period: 65, dueDate: d(2026, 5), remainingBalance: 60_000 },
      ],
    });
    expect(buildDebtProfile([loan], TODAY).timeline[0].progressPct).toBe(40);
  });

  it("clamps progressPct to [0, 100]", () => {
    const loan = makeLoan({ id: "l1", amount: 100_000, amortizationLines: [] });
    const pct = buildDebtProfile([loan], TODAY).timeline[0].progressPct;
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);
  });

  it("extinction curve starts with current month", () => {
    const loan = makeLoan({
      id: "l1",
      endDate: d(2026, 7),
      amortizationLines: [
        { period: 65, dueDate: d(2026, 5), remainingBalance: 5_000 },
        { period: 66, dueDate: d(2026, 6), remainingBalance: 2_500 },
        { period: 67, dueDate: d(2026, 7), remainingBalance: 0 },
      ],
    });
    const { extinctionCurve } = buildDebtProfile([loan], TODAY);
    expect(extinctionCurve[0].month).toBe("2026-05");
    expect(extinctionCurve[0].totalCrd).toBe(5_000);
  });

  it("extinction curve ends at last loan end month", () => {
    const loan = makeLoan({
      id: "l1",
      endDate: d(2027, 3),
      amortizationLines: [
        { period: 65, dueDate: d(2026, 5), remainingBalance: 20_000 },
      ],
    });
    const { extinctionCurve } = buildDebtProfile([loan], TODAY);
    expect(extinctionCurve[extinctionCurve.length - 1].month).toBe("2027-03");
  });

  it("extinction curve sums CRD from multiple loans per month", () => {
    const loanA = makeLoan({
      id: "l1",
      amortizationLines: [
        { period: 65, dueDate: d(2026, 5), remainingBalance: 60_000 },
        { period: 66, dueDate: d(2026, 6), remainingBalance: 59_500 },
      ],
    });
    const loanB = makeLoan({
      id: "l2",
      amount: 50_000,
      endDate: d(2028, 1),
      amortizationLines: [
        { period: 20, dueDate: d(2026, 5), remainingBalance: 30_000 },
        { period: 21, dueDate: d(2026, 6), remainingBalance: 29_000 },
      ],
    });
    const { extinctionCurve } = buildDebtProfile([loanA, loanB], TODAY);
    expect(extinctionCurve[0].totalCrd).toBe(90_000);
    expect(extinctionCurve[1].totalCrd).toBe(88_500);
  });

  it("uses loan amount for months before first payment line", () => {
    const loan = makeLoan({
      id: "l1",
      amount: 100_000,
      startDate: d(2026, 6),
      endDate: d(2028, 6),
      amortizationLines: [
        { period: 1, dueDate: d(2026, 6), remainingBalance: 99_000 },
        { period: 2, dueDate: d(2026, 7), remainingBalance: 98_000 },
      ],
    });
    const { extinctionCurve } = buildDebtProfile([loan], TODAY);
    expect(extinctionCurve[0].totalCrd).toBe(100_000);
    expect(extinctionCurve[1].totalCrd).toBe(99_000);
  });

  it("completed loans contribute 0 after their last payment", () => {
    const shortLoan = makeLoan({
      id: "l1",
      endDate: d(2026, 7),
      amortizationLines: [
        { period: 65, dueDate: d(2026, 5), remainingBalance: 5_000 },
        { period: 66, dueDate: d(2026, 6), remainingBalance: 2_500 },
        { period: 67, dueDate: d(2026, 7), remainingBalance: 0 },
      ],
    });
    const longLoan = makeLoan({
      id: "l2",
      amount: 100_000,
      endDate: d(2028, 5),
      amortizationLines: [
        { period: 1, dueDate: d(2026, 5), remainingBalance: 98_000 },
        { period: 2, dueDate: d(2026, 6), remainingBalance: 97_000 },
        { period: 3, dueDate: d(2026, 7), remainingBalance: 96_000 },
        { period: 4, dueDate: d(2026, 8), remainingBalance: 95_000 },
      ],
    });
    const { extinctionCurve } = buildDebtProfile([shortLoan, longLoan], TODAY);
    const july = extinctionCurve.find((p) => p.month === "2026-07");
    const august = extinctionCurve.find((p) => p.month === "2026-08");
    expect(july?.totalCrd).toBe(96_000);
    expect(august?.totalCrd).toBe(95_000);
  });

  it("excludes COMPTE_COURANT from extinction curve", () => {
    const cc = makeLoan({ id: "l1", loanType: "COMPTE_COURANT" });
    const normal = makeLoan({
      id: "l2",
      endDate: d(2026, 7),
      amortizationLines: [
        { period: 65, dueDate: d(2026, 5), remainingBalance: 10_000 },
      ],
    });
    const { extinctionCurve } = buildDebtProfile([cc, normal], TODAY);
    expect(extinctionCurve[0].totalCrd).toBe(10_000);
  });
});