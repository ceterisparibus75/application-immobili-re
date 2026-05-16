import { describe, expect, it } from "vitest";

import { getActiveLeaseWhere, getLeaseOverlapWhere } from "./lease-scope";

describe("lease-scope", () => {
  it("définit le périmètre d'un bail actif à une date donnée", () => {
    const asOf = new Date("2026-05-02T10:00:00.000Z");

    // L'absence d'endDate dans le filtre est intentionnelle : les baux en
    // tacite reconduction (endDate passée mais sans exitDate enregistré)
    // restent actifs. La sortie effective est portée par `exitDate`,
    // non par `endDate`.
    expect(getActiveLeaseWhere(asOf)).toEqual({
      deletedAt: null,
      status: { in: ["EN_COURS", "RENOUVELE"] },
      startDate: { lte: asOf },
    });
  });

  it("définit le périmètre d'un bail qui chevauche un exercice financier", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const to = new Date("2026-12-31T23:59:59.000Z");

    // Le filtre OR couvre 4 cas :
    //   1. endDate dans la période, pas encore sorti
    //   2. endDate dans la période, sorti pendant la période
    //   3. statut actif (tacite reconduction), pas encore sorti
    //   4. statut actif (tacite reconduction), sorti pendant la période
    expect(getLeaseOverlapWhere(from, to)).toEqual({
      deletedAt: null,
      status: { in: ["EN_COURS", "RENOUVELE", "RESILIE", "CONTENTIEUX"] },
      startDate: { lte: to },
      OR: [
        { endDate: { gte: from }, exitDate: null },
        { endDate: { gte: from }, exitDate: { gte: from } },
        { status: { in: ["EN_COURS", "RENOUVELE"] }, exitDate: null },
        { status: { in: ["EN_COURS", "RENOUVELE"] }, exitDate: { gte: from } },
      ],
    });
  });
});
