import { describe, it, expect } from "vitest";
import {
  generateReportSchema,
  createReportScheduleSchema,
  updateReportScheduleSchema,
  REPORT_TYPES,
  REPORT_FREQUENCIES,
  CONSOLIDABLE_REPORT_TYPES,
} from "./report";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";

describe("REPORT_TYPES", () => {
  it("contient 10 types de rapports", () => {
    expect(REPORT_TYPES).toHaveLength(10);
    expect(REPORT_TYPES).toContain("SITUATION_LOCATIVE");
    expect(REPORT_TYPES).toContain("BALANCE_AGEE");
  });
});

describe("generateReportSchema", () => {
  it("accepte un rapport SITUATION_LOCATIVE sans année", () => {
    const result = generateReportSchema.safeParse({ type: "SITUATION_LOCATIVE" });
    expect(result.success).toBe(true);
  });

  it("format vaut 'pdf' par défaut", () => {
    const result = generateReportSchema.safeParse({ type: "SITUATION_LOCATIVE" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.format).toBe("pdf");
  });

  it("rejette xlsx pour un rapport PDF uniquement", () => {
    const result = generateReportSchema.safeParse({ type: "SITUATION_LOCATIVE", format: "xlsx" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("PDF"))).toBe(true);
    }
  });

  it("accepte xlsx pour les rapports Excel uniquement", () => {
    const result = generateReportSchema.safeParse({ type: "SUIVI_TRAVAUX", year: 2026, format: "xlsx" });
    expect(result.success).toBe(true);
  });

  it("rejette pdf pour les rapports Excel uniquement", () => {
    const result = generateReportSchema.safeParse({ type: "RENTABILITE_LOT", year: 2026, format: "pdf" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("Excel"))).toBe(true);
    }
  });

  it("accepte les deux formats pour ETAT_IMPAYES", () => {
    expect(generateReportSchema.safeParse({ type: "ETAT_IMPAYES", format: "pdf" }).success).toBe(true);
    expect(generateReportSchema.safeParse({ type: "ETAT_IMPAYES", format: "xlsx" }).success).toBe(true);
  });

  it("rejette un type de rapport invalide", () => {
    const result = generateReportSchema.safeParse({ type: "BILAN_ANNUEL" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Type de rapport invalide/);
    }
  });

  it("rejette un format invalide", () => {
    const result = generateReportSchema.safeParse({ type: "SITUATION_LOCATIVE", format: "csv" });
    expect(result.success).toBe(false);
  });

  // ── superRefine : RECAP_CHARGES_LOCATAIRE nécessite tenantId ──────────────

  it("rejette RECAP_CHARGES_LOCATAIRE sans tenantId", () => {
    const result = generateReportSchema.safeParse({
      type: "RECAP_CHARGES_LOCATAIRE",
      year: 2025,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs.some((m) => m.includes("locataire"))).toBe(true);
    }
  });

  it("accepte RECAP_CHARGES_LOCATAIRE avec tenantId et year", () => {
    const result = generateReportSchema.safeParse({
      type: "RECAP_CHARGES_LOCATAIRE",
      year: 2025,
      tenantId: VALID_CUID,
    });
    expect(result.success).toBe(true);
  });

  // ── superRefine : rapports annuels nécessitent year ───────────────────────

  it("rejette COMPTE_RENDU_GESTION sans year", () => {
    const result = generateReportSchema.safeParse({ type: "COMPTE_RENDU_GESTION" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs.some((m) => m.includes("année est requise"))).toBe(true);
    }
  });

  it("rejette RENTABILITE_LOT sans year", () => {
    const result = generateReportSchema.safeParse({ type: "RENTABILITE_LOT", format: "xlsx" });
    expect(result.success).toBe(false);
  });

  it("rejette SUIVI_MENSUEL sans year", () => {
    const result = generateReportSchema.safeParse({ type: "SUIVI_MENSUEL" });
    expect(result.success).toBe(false);
  });

  it("accepte COMPTE_RENDU_GESTION avec year", () => {
    const result = generateReportSchema.safeParse({ type: "COMPTE_RENDU_GESTION", year: 2025 });
    expect(result.success).toBe(true);
  });

  it("rejette year < 2000", () => {
    const result = generateReportSchema.safeParse({ type: "SITUATION_LOCATIVE", year: 1999 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/2000/);
    }
  });

  it("rejette year > 2100", () => {
    const result = generateReportSchema.safeParse({ type: "SITUATION_LOCATIVE", year: 2101 });
    expect(result.success).toBe(false);
  });

  it("accepte ETAT_IMPAYES sans year (non dans yearRequired)", () => {
    const result = generateReportSchema.safeParse({ type: "ETAT_IMPAYES" });
    expect(result.success).toBe(true);
  });

  it("accepte VACANCE_LOCATIVE sans year", () => {
    const result = generateReportSchema.safeParse({ type: "VACANCE_LOCATIVE" });
    expect(result.success).toBe(true);
  });
});

describe("createReportScheduleSchema", () => {
  const validSchedule = {
    name: "Rapport mensuel SCI",
    frequency: "MENSUEL" as const,
    reportTypes: ["SITUATION_LOCATIVE" as const],
    recipients: ["admin@example.com"],
  };

  it("accepte une planification valide", () => {
    expect(createReportScheduleSchema.safeParse(validSchedule).success).toBe(true);
  });

  it("accepte toutes les fréquences valides", () => {
    for (const frequency of REPORT_FREQUENCIES) {
      expect(createReportScheduleSchema.safeParse({ ...validSchedule, frequency }).success).toBe(true);
    }
  });

  it("rejette une fréquence invalide", () => {
    const result = createReportScheduleSchema.safeParse({ ...validSchedule, frequency: "QUOTIDIEN" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Fréquence invalide/);
    }
  });

  it("rejette un nom trop court (< 2 chars)", () => {
    const result = createReportScheduleSchema.safeParse({ ...validSchedule, name: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/2 caractères/);
    }
  });

  it("rejette reportTypes vide", () => {
    const result = createReportScheduleSchema.safeParse({ ...validSchedule, reportTypes: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/au moins un type de rapport/);
    }
  });

  it("rejette recipients vide", () => {
    const result = createReportScheduleSchema.safeParse({ ...validSchedule, recipients: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/au moins un destinataire/);
    }
  });

  it("rejette un email destinataire invalide", () => {
    const result = createReportScheduleSchema.safeParse({ ...validSchedule, recipients: ["bad@"] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/email invalide/i);
    }
  });

  it("rejette un type de rapport non consolidable", () => {
    // SUIVI_TRAVAUX n'est pas dans CONSOLIDABLE_REPORT_TYPES
    const result = createReportScheduleSchema.safeParse({
      ...validSchedule,
      reportTypes: ["SUIVI_TRAVAUX" as never],
    });
    expect(result.success).toBe(false);
  });
});

describe("updateReportScheduleSchema", () => {
  it("accepte une mise à jour partielle avec id", () => {
    expect(updateReportScheduleSchema.safeParse({ id: VALID_CUID, isActive: false }).success).toBe(true);
  });

  it("rejette si id absent", () => {
    expect(updateReportScheduleSchema.safeParse({ isActive: false }).success).toBe(false);
  });

  it("accepte id seul (partial)", () => {
    expect(updateReportScheduleSchema.safeParse({ id: VALID_CUID }).success).toBe(true);
  });
});
