import { describe, expect, it } from "vitest";
import { buildChargeReportPresentation } from "./charge-report-presentation";

describe("buildChargeReportPresentation", () => {
  it("expose la période d'occupation, le prorata et les catégories normalisées", () => {
    const presentation = buildChargeReportPresentation(
      {
        prorataDays: 184,
        occupancyStart: "2024-07-01",
        occupancyEnd: "2024-12-31",
        totalRecoverableAllocated: 603.28,
        categories: [
          {
            categoryName: "Entretien",
            nature: "RECUPERABLE",
            totalAmount: 1200,
            recoverableAmount: 1200,
            allocationMethod: "TANTIEME",
            allocationRate: 100,
            tenantShare: 603.28,
          },
        ],
      },
      new Date("2024-01-01"),
      new Date("2024-12-31")
    );

    expect(presentation.hasPartialOccupancy).toBe(true);
    expect(presentation.occupancyStart).toEqual(new Date(2024, 6, 1));
    expect(presentation.occupancyEnd).toEqual(new Date(2024, 11, 31));
    expect(presentation.prorataDays).toBe(184);
    expect(presentation.allocatedCharges).toBe(603.28);
    expect(presentation.categories).toEqual([
      {
        categoryName: "Entretien",
        nature: "RECUPERABLE",
        totalAmount: 1200,
        recoverableAmount: 1200,
        allocationMethod: "TANTIEME",
        allocationRate: 100,
        tenantShare: 603.28,
      },
    ]);
  });

  it("normalise les anciennes lignes label/amount/recoverable", () => {
    const presentation = buildChargeReportPresentation(
      {
        categories: [
          {
            label: "Eau",
            amount: 900,
            recoverable: 450,
          },
        ],
      },
      new Date("2024-01-01"),
      new Date("2024-12-31")
    );

    expect(presentation.allocatedCharges).toBe(450);
    expect(presentation.categories[0]).toMatchObject({
      categoryName: "Eau",
      totalAmount: 900,
      recoverableAmount: 450,
      tenantShare: 450,
    });
  });

  it("retourne une présentation vide si details est absent", () => {
    const presentation = buildChargeReportPresentation(null, new Date("2024-01-01"), new Date("2024-12-31"));

    expect(presentation.hasPartialOccupancy).toBe(false);
    expect(presentation.categories).toEqual([]);
    expect(presentation.allocatedCharges).toBeNull();
  });
});
