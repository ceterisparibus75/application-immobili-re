import { describe, it, expect } from "vitest";
import {
  statementLineSchema,
  createStatementSchema,
  updateStatementSchema,
  recordStatementPaymentSchema,
  reconcileStatementSchema,
} from "./third-party-statement";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";
const VALID_CUID_2 = "clh3x2z4k0001qh8g7z1y2v3u";

const validLine = {
  lineType: "CHARGE" as const,
  label: "Frais de gestion",
  amount: 120,
};

const baseStatement = {
  type: "APPEL_FONDS" as const,
  buildingId: VALID_CUID,
  thirdPartyName: "Syndic Leblanc",
  periodStart: "2025-01-01",
  periodEnd: "2025-01-31",
  receivedDate: "2025-02-01",
  totalAmount: 1200,
  lines: [validLine],
};

describe("statementLineSchema", () => {
  it("accepte une ligne valide", () => {
    expect(statementLineSchema.safeParse(validLine).success).toBe(true);
  });

  it("rejette label vide", () => {
    const result = statementLineSchema.safeParse({ ...validLine, label: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Libellé requis/);
    }
  });

  it("accepte tous les lineType valides", () => {
    for (const lineType of ["CHARGE", "ENCAISSEMENT", "DEDUCTION", "HONORAIRES"]) {
      expect(statementLineSchema.safeParse({ ...validLine, lineType }).success).toBe(true);
    }
  });

  it("rejette un lineType invalide", () => {
    const result = statementLineSchema.safeParse({ ...validLine, lineType: "REMBOURSEMENT" });
    expect(result.success).toBe(false);
  });

  it("rejette recoverableRate > 100", () => {
    const result = statementLineSchema.safeParse({ ...validLine, recoverableRate: 101 });
    expect(result.success).toBe(false);
  });

  it("rejette recoverableRate < 0", () => {
    const result = statementLineSchema.safeParse({ ...validLine, recoverableRate: -1 });
    expect(result.success).toBe(false);
  });
});

describe("createStatementSchema", () => {
  // ── APPEL_FONDS nécessite buildingId ────────────────────────────────────

  it("accepte un APPEL_FONDS valide", () => {
    expect(createStatementSchema.safeParse(baseStatement).success).toBe(true);
  });

  it("rejette APPEL_FONDS sans buildingId", () => {
    const { buildingId: _, ...withoutBuilding } = baseStatement;
    const result = createStatementSchema.safeParse(withoutBuilding);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Immeuble requis/);
    }
  });

  it("rejette DECOMPTE_CHARGES sans buildingId", () => {
    const { buildingId: _, ...withoutBuilding } = { ...baseStatement, type: "DECOMPTE_CHARGES" as const };
    const result = createStatementSchema.safeParse(withoutBuilding);
    expect(result.success).toBe(false);
  });

  // ── DECOMPTE_GESTION nécessite leaseId ─────────────────────────────────

  it("accepte DECOMPTE_GESTION avec leaseId", () => {
    const result = createStatementSchema.safeParse({
      ...baseStatement,
      type: "DECOMPTE_GESTION",
      buildingId: undefined,
      leaseId: VALID_CUID,
    });
    expect(result.success).toBe(true);
  });

  it("accepte DECOMPTE_GESTION avec leaseIds[]", () => {
    const result = createStatementSchema.safeParse({
      ...baseStatement,
      type: "DECOMPTE_GESTION",
      buildingId: undefined,
      leaseIds: [VALID_CUID],
    });
    expect(result.success).toBe(true);
  });

  it("rejette DECOMPTE_GESTION sans aucun bail", () => {
    const result = createStatementSchema.safeParse({
      ...baseStatement,
      type: "DECOMPTE_GESTION",
      buildingId: undefined,
    });
    expect(result.success).toBe(false);
  });

  // ── Champs communs ────────────────────────────────────────────────────

  it("rejette thirdPartyName vide", () => {
    const result = createStatementSchema.safeParse({ ...baseStatement, thirdPartyName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Nom du tiers requis/);
    }
  });

  it("rejette periodStart vide", () => {
    const result = createStatementSchema.safeParse({ ...baseStatement, periodStart: "" });
    expect(result.success).toBe(false);
  });

  it("rejette lines vide (au moins 1 requise)", () => {
    const result = createStatementSchema.safeParse({ ...baseStatement, lines: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Au moins une ligne/);
    }
  });

  it("accepte plusieurs lignes", () => {
    const result = createStatementSchema.safeParse({
      ...baseStatement,
      lines: [validLine, { lineType: "HONORAIRES", label: "Honoraires syndic", amount: 200 }],
    });
    expect(result.success).toBe(true);
  });
});

describe("recordStatementPaymentSchema", () => {
  const validPayment = {
    statementId: VALID_CUID,
    amount: 500,
    paidAt: "2025-02-15",
  };

  it("accepte un paiement valide", () => {
    expect(recordStatementPaymentSchema.safeParse(validPayment).success).toBe(true);
  });

  it("rejette un montant négatif", () => {
    const result = recordStatementPaymentSchema.safeParse({ ...validPayment, amount: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Montant requis/);
    }
  });

  it("rejette paidAt vide", () => {
    const result = recordStatementPaymentSchema.safeParse({ ...validPayment, paidAt: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Date requise/);
    }
  });

  it("accepte reference optionnel", () => {
    const result = recordStatementPaymentSchema.safeParse({ ...validPayment, reference: "VIR-001" });
    expect(result.success).toBe(true);
  });
});

describe("reconcileStatementSchema", () => {
  it("accepte des IDs valides", () => {
    expect(reconcileStatementSchema.safeParse({ statementId: VALID_CUID, transactionId: VALID_CUID_2 }).success).toBe(true);
  });

  it("rejette si statementId non CUID", () => {
    expect(reconcileStatementSchema.safeParse({ statementId: "bad", transactionId: VALID_CUID_2 }).success).toBe(false);
  });

  it("rejette si transactionId non CUID", () => {
    expect(reconcileStatementSchema.safeParse({ statementId: VALID_CUID, transactionId: "bad" }).success).toBe(false);
  });
});
