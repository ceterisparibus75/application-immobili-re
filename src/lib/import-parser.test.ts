import { describe, it, expect, vi } from "vitest";

// ── Mock ExcelJS ─────────────────────────────────────────────────────────────

const excelMocks = vi.hoisted(() => {
  const worksheet = {
    rowCount: 0,
    getRow: vi.fn(),
  };
  const workbook = {
    xlsx: { load: vi.fn().mockResolvedValue(undefined) },
    csv: { read: vi.fn().mockResolvedValue(undefined) },
    worksheets: [worksheet],
  };
  function Workbook() {
    return workbook;
  }
  return { worksheet, workbook, Workbook };
});

vi.mock("exceljs", () => ({
  default: { Workbook: excelMocks.Workbook },
}));

import { parseImportFile } from "./import-parser";

function makeRow(cells: string[]) {
  return {
    eachCell: (opts: unknown, fn: (cell: { text: string }, colNumber: number) => void) => {
      cells.forEach((text, idx) => fn({ text }, idx + 1));
    },
    getCell: (colIndex: number) => ({ text: cells[colIndex - 1] ?? "" }),
  };
}

describe("parseImportFile", () => {
  describe("XLSX", () => {
    it("retourne headers et rows depuis un fichier Excel valide", async () => {
      excelMocks.worksheet.rowCount = 3;
      excelMocks.worksheet.getRow.mockImplementation((n: number) => {
        if (n === 1) return makeRow(["nom", "prenom", "email"]);
        if (n === 2) return makeRow(["Martin", "Alice", "alice@example.com"]);
        if (n === 3) return makeRow(["Dupont", "Bob", "bob@example.com"]);
        return makeRow([]);
      });

      const buffer = Buffer.from("dummy");
      const result = await parseImportFile(buffer, "import.xlsx");

      expect(result.headers).toEqual(["nom", "prenom", "email"]);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({ nom: "Martin", prenom: "Alice", email: "alice@example.com" });
      expect(result.rows[1]).toEqual({ nom: "Dupont", prenom: "Bob", email: "bob@example.com" });
    });

    it("ignore les lignes entièrement vides", async () => {
      excelMocks.worksheet.rowCount = 3;
      excelMocks.worksheet.getRow.mockImplementation((n: number) => {
        if (n === 1) return makeRow(["nom", "email"]);
        if (n === 2) return makeRow(["", ""]);
        if (n === 3) return makeRow(["Martin", "martin@example.com"]);
        return makeRow([]);
      });

      const buffer = Buffer.from("dummy");
      const result = await parseImportFile(buffer, "data.xlsx");

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].nom).toBe("Martin");
    });

    it("retourne headers et rows vides si feuille vide", async () => {
      excelMocks.worksheet.rowCount = 0;

      const buffer = Buffer.from("dummy");
      const result = await parseImportFile(buffer, "empty.xlsx");

      expect(result.headers).toEqual([]);
      expect(result.rows).toEqual([]);
    });

    it("élimine les colonnes d'en-tête vides en fin", async () => {
      excelMocks.worksheet.rowCount = 2;
      excelMocks.worksheet.getRow.mockImplementation((n: number) => {
        if (n === 1) return makeRow(["nom", "prenom", "", ""]);
        if (n === 2) return makeRow(["Martin", "Alice", "", ""]);
        return makeRow([]);
      });

      const buffer = Buffer.from("dummy");
      const result = await parseImportFile(buffer, "file.xlsx");

      expect(result.headers).toEqual(["nom", "prenom"]);
    });

    it("accepte l'extension .xls", async () => {
      excelMocks.worksheet.rowCount = 2;
      excelMocks.worksheet.getRow.mockImplementation((n: number) => {
        if (n === 1) return makeRow(["ref"]);
        if (n === 2) return makeRow(["LOT-001"]);
        return makeRow([]);
      });

      const result = await parseImportFile(Buffer.from("x"), "old.xls");
      expect(result.headers).toEqual(["ref"]);
    });
  });

  describe("CSV (détection de délimiteur)", () => {
    it("parse un CSV avec point-virgule", async () => {
      excelMocks.worksheet.rowCount = 2;
      excelMocks.worksheet.getRow.mockImplementation((n: number) => {
        if (n === 1) return makeRow(["nom", "email"]);
        if (n === 2) return makeRow(["Martin", "martin@test.com"]);
        return makeRow([]);
      });

      const csv = "nom;email\nMartin;martin@test.com";
      const result = await parseImportFile(Buffer.from(csv), "data.csv");

      expect(result.headers).toEqual(["nom", "email"]);
      expect(result.rows).toHaveLength(1);
    });

    it("parse un CSV avec virgule", async () => {
      excelMocks.worksheet.rowCount = 2;
      excelMocks.worksheet.getRow.mockImplementation((n: number) => {
        if (n === 1) return makeRow(["nom", "prenom"]);
        if (n === 2) return makeRow(["Dupont", "Jean"]);
        return makeRow([]);
      });

      const csv = "nom,prenom\nDupont,Jean";
      const result = await parseImportFile(Buffer.from(csv), "data.csv");
      expect(result.headers).toEqual(["nom", "prenom"]);
    });

    it("parse un CSV avec tabulation", async () => {
      excelMocks.worksheet.rowCount = 2;
      excelMocks.worksheet.getRow.mockImplementation((n: number) => {
        if (n === 1) return makeRow(["a", "b"]);
        if (n === 2) return makeRow(["1", "2"]);
        return makeRow([]);
      });

      const csv = "a\tb\n1\t2";
      const result = await parseImportFile(Buffer.from(csv), "data.csv");
      expect(result.headers).toEqual(["a", "b"]);
    });

    it("supprime le BOM UTF-8 si présent", async () => {
      excelMocks.worksheet.rowCount = 2;
      excelMocks.worksheet.getRow.mockImplementation((n: number) => {
        if (n === 1) return makeRow(["nom"]);
        if (n === 2) return makeRow(["Martin"]);
        return makeRow([]);
      });

      const withBom = Buffer.from("﻿nom\nMartin", "utf-8");
      const result = await parseImportFile(withBom, "bom.csv");
      expect(result.headers).toEqual(["nom"]);
    });
  });
});
