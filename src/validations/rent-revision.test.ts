import { describe, it, expect } from "vitest";
import { validateRevisionSchema, rejectRevisionSchema, createManualRevisionSchema } from "./rent-revision";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";

describe("validateRevisionSchema", () => {
  it("accepte un revisionId CUID valide", () => {
    expect(validateRevisionSchema.safeParse({ revisionId: VALID_CUID }).success).toBe(true);
  });

  it("rejette un revisionId non CUID", () => {
    expect(validateRevisionSchema.safeParse({ revisionId: "bad-id" }).success).toBe(false);
  });

  it("rejette si revisionId absent", () => {
    expect(validateRevisionSchema.safeParse({}).success).toBe(false);
  });
});

describe("rejectRevisionSchema", () => {
  it("accepte un revisionId CUID valide", () => {
    expect(rejectRevisionSchema.safeParse({ revisionId: VALID_CUID }).success).toBe(true);
  });

  it("rejette un revisionId non CUID", () => {
    expect(rejectRevisionSchema.safeParse({ revisionId: "not-a-cuid" }).success).toBe(false);
  });
});

describe("createManualRevisionSchema", () => {
  const validRevision = {
    leaseId: VALID_CUID,
    effectiveDate: "2025-07-01",
    newIndexValue: 125.5,
  };

  it("accepte une révision manuelle valide", () => {
    expect(createManualRevisionSchema.safeParse(validRevision).success).toBe(true);
  });

  it("rejette un leaseId non CUID", () => {
    const result = createManualRevisionSchema.safeParse({ ...validRevision, leaseId: "bad" });
    expect(result.success).toBe(false);
  });

  it("rejette effectiveDate vide", () => {
    const result = createManualRevisionSchema.safeParse({ ...validRevision, effectiveDate: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/date d'effet est requise/);
    }
  });

  it("rejette newIndexValue négatif", () => {
    const result = createManualRevisionSchema.safeParse({ ...validRevision, newIndexValue: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/positive/);
    }
  });

  it("accepte newIndexValue = 0", () => {
    const result = createManualRevisionSchema.safeParse({ ...validRevision, newIndexValue: 0 });
    expect(result.success).toBe(true);
  });

  it("coerce newIndexValue depuis une chaîne numérique", () => {
    const result = createManualRevisionSchema.safeParse({ ...validRevision, newIndexValue: "130.25" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.newIndexValue).toBe(130.25);
  });
});
