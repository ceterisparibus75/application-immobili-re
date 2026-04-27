import { describe, expect, it } from "vitest";
import { buildStorageFileName, sanitizeStorageSegment } from "./storage-path";

describe("storage-path", () => {
  it("retire les accents et caracteres non compatibles des segments", () => {
    expect(sanitizeStorageSegment("BL Associés")).toBe("BL_Associes");
    expect(sanitizeStorageSegment("41 Rue de Paris / étage 2")).toBe("41_Rue_de_Paris_etage_2");
  });

  it("construit un nom de fichier PDF compatible Supabase Storage", () => {
    expect(
      buildStorageFileName(
        ["AJHOLD-2026-0005", "41 Rue de Paris", "BL Associés"],
        "pdf"
      )
    ).toBe("AJHOLD-2026-0005_41_Rue_de_Paris_BL_Associes.pdf");
  });

  it("utilise un fallback si tous les segments sont vides", () => {
    expect(buildStorageFileName(["", null], ".pdf", "quittance")).toBe("quittance.pdf");
  });
});
