import { describe, expect, it } from "vitest";

import { getActiveLeaseWhere, getLeaseOverlapWhere } from "./lease-scope";

describe("lease-scope", () => {
  it("définit le périmètre d'un bail actif à une date donnée", () => {
    const asOf = new Date("2026-05-02T10:00:00.000Z");

    expect(getActiveLeaseWhere(asOf)).toEqual({
      deletedAt: null,
      status: { in: ["EN_COURS", "RENOUVELE"] },
      startDate: { lte: asOf },
      endDate: { gte: asOf },
      OR: [
        { exitDate: null },
        { exitDate: { gte: asOf } },
      ],
    });
  });

  it("définit le périmètre d'un bail qui chevauche un exercice financier", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const to = new Date("2026-12-31T23:59:59.000Z");

    expect(getLeaseOverlapWhere(from, to)).toEqual({
      deletedAt: null,
      status: { in: ["EN_COURS", "RENOUVELE", "RESILIE", "CONTENTIEUX"] },
      startDate: { lte: to },
      endDate: { gte: from },
      OR: [
        { exitDate: null },
        { exitDate: { gte: from } },
      ],
    });
  });
});
