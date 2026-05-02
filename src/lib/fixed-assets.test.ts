import { describe, expect, it } from "vitest";
import { buildLinearDepreciationSchedule } from "./fixed-assets";

describe("buildLinearDepreciationSchedule", () => {
  it("génère des dotations annuelles proratisées au mois de mise en service", () => {
    const schedule = buildLinearDepreciationSchedule({
      depreciableBase: 12000,
      serviceStartDate: new Date("2026-03-15T00:00:00.000Z"),
      durationMonths: 24,
    });

    expect(schedule).toHaveLength(3);
    expect(schedule.map((line) => ({ year: line.fiscalYear, amount: line.amount }))).toEqual([
      { year: 2026, amount: 5000 },
      { year: 2027, amount: 6000 },
      { year: 2028, amount: 1000 },
    ]);
    expect(schedule.at(-1)?.accumulatedAmount).toBe(12000);
    expect(schedule.at(-1)?.netBookValue).toBe(0);
  });

  it("déduit la valeur résiduelle de la base à amortir", () => {
    const schedule = buildLinearDepreciationSchedule({
      depreciableBase: 10000,
      residualValue: 1000,
      serviceStartDate: new Date("2026-01-01T00:00:00.000Z"),
      durationMonths: 12,
    });

    expect(schedule).toHaveLength(1);
    expect(schedule[0].amount).toBe(9000);
    expect(schedule[0].netBookValue).toBe(1000);
  });
});
