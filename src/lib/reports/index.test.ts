import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

const generatorMocks = vi.hoisted(() => ({
  generateSituationLocative: vi.fn(),
  generateCompteRenduGestion: vi.fn(),
  generateRentabiliteLot: vi.fn(),
  generateEtatImpayes: vi.fn(),
  generateRecapChargesLocataire: vi.fn(),
  generateSuiviTravaux: vi.fn(),
  generateBalanceAgee: vi.fn(),
  generateSuiviMensuel: vi.fn(),
  generateVacanceLocative: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("./generators/situation-locative", () => ({
  generateSituationLocative: generatorMocks.generateSituationLocative,
}));
vi.mock("./generators/compte-rendu-gestion", () => ({
  generateCompteRenduGestion: generatorMocks.generateCompteRenduGestion,
}));
vi.mock("./generators/rentabilite-lot", () => ({
  generateRentabiliteLot: generatorMocks.generateRentabiliteLot,
}));
vi.mock("./generators/etat-impayes", () => ({
  generateEtatImpayes: generatorMocks.generateEtatImpayes,
}));
vi.mock("./generators/recap-charges-locataire", () => ({
  generateRecapChargesLocataire: generatorMocks.generateRecapChargesLocataire,
}));
vi.mock("./generators/suivi-travaux", () => ({
  generateSuiviTravaux: generatorMocks.generateSuiviTravaux,
}));
vi.mock("./generators/balance-agee", () => ({
  generateBalanceAgee: generatorMocks.generateBalanceAgee,
}));
vi.mock("./generators/suivi-mensuel", () => ({
  generateSuiviMensuel: generatorMocks.generateSuiviMensuel,
}));
vi.mock("./generators/vacance-locative", () => ({
  generateVacanceLocative: generatorMocks.generateVacanceLocative,
}));

import { generateConsolidatedReport, getFrequencyLabel, getReportLabel } from "./consolidated";
import { generateReport } from "./index";

describe("generateReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.society.findUnique.mockResolvedValue({
      name: "Ma Société",
      siret: "12345678901234",
      addressLine1: "1 rue de Paris",
      city: "Paris",
      postalCode: "75001",
    } as never);

    const okResult = {
      buffer: Buffer.from("pdf"),
      filename: "rapport.pdf",
      contentType: "application/pdf",
    };

    Object.values(generatorMocks).forEach((mock) => {
      mock.mockResolvedValue(okResult);
    });
  });

  it("injecte les données société manquantes avant de dispatcher", async () => {
    await generateReport({
      societyId: "society-1",
      type: "SITUATION_LOCATIVE",
      format: "pdf",
    });

    expect(prismaMock.society.findUnique).toHaveBeenCalledWith({
      where: { id: "society-1" },
      select: {
        name: true,
        siret: true,
        addressLine1: true,
        city: true,
        postalCode: true,
      },
    });
    expect(generatorMocks.generateSituationLocative).toHaveBeenCalledWith(
      expect.objectContaining({
        societyId: "society-1",
        society: expect.objectContaining({
          name: "Ma Société",
          city: "Paris",
        }),
      })
    );
  });

  it("n'écrase pas la société déjà fournie", async () => {
    await generateReport({
      societyId: "society-1",
      type: "BALANCE_AGEE",
      format: "pdf",
      society: { name: "Brand custom" },
    });

    expect(prismaMock.society.findUnique).not.toHaveBeenCalled();
    expect(generatorMocks.generateBalanceAgee).toHaveBeenCalledWith(
      expect.objectContaining({
        society: { name: "Brand custom" },
      })
    );
  });

  it("dispatch vers chaque générateur selon le type (lignes 31-38)", async () => {
    const types = [
      ["RENTABILITE_LOT", generatorMocks.generateRentabiliteLot],
      ["ETAT_IMPAYES", generatorMocks.generateEtatImpayes],
      ["RECAP_CHARGES_LOCATAIRE", generatorMocks.generateRecapChargesLocataire],
      ["SUIVI_TRAVAUX", generatorMocks.generateSuiviTravaux],
      ["SUIVI_MENSUEL", generatorMocks.generateSuiviMensuel],
      ["VACANCE_LOCATIVE", generatorMocks.generateVacanceLocative],
    ] as const;

    for (const [type, mock] of types) {
      mock.mockClear();
      await generateReport({ societyId: "society-1", type: type as never, format: "pdf" });
      expect(mock).toHaveBeenCalledOnce();
    }
  });

  it("masque les erreurs internes du générateur par un message stable", async () => {
    generatorMocks.generateCompteRenduGestion.mockRejectedValue(new Error("boom"));

    await expect(
      generateReport({
        societyId: "society-1",
        type: "COMPTE_RENDU_GESTION",
        year: 2026,
        format: "pdf",
      })
    ).rejects.toThrow("Erreur lors de la generation du rapport. Veuillez reessayer.");
  });
});

describe("generateConsolidatedReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.society.findUnique.mockResolvedValue(null);
  });

  it("fusionne les PDF disponibles et ignore les rapports en erreur", async () => {
    generatorMocks.generateSituationLocative.mockResolvedValue({
      buffer: Buffer.from(
        "%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
      ),
      filename: "a.pdf",
      contentType: "application/pdf",
    });
    generatorMocks.generateBalanceAgee.mockRejectedValue(new Error("failed"));

    const result = await generateConsolidatedReport("society-1", [
      "SITUATION_LOCATIVE",
      "BALANCE_AGEE",
    ]);

    expect(result.filename).toMatch(/^rapport-consolide-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(result.contentType).toBe("application/pdf");
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it("échoue si aucun rapport n'a pu être généré", async () => {
    generatorMocks.generateSituationLocative.mockRejectedValue(new Error("failed"));
    generatorMocks.generateBalanceAgee.mockRejectedValue(new Error("failed"));

    await expect(
      generateConsolidatedReport("society-1", ["SITUATION_LOCATIVE", "BALANCE_AGEE"])
    ).rejects.toThrow("Aucun rapport n'a pu être généré");
  });
});

describe("report labels", () => {
  it("retourne un libellé lisible pour un type connu", () => {
    expect(getReportLabel("SITUATION_LOCATIVE")).toBe("Situation locative");
  });

  it("retourne le type brut si le libellé n'existe pas", () => {
    expect(getReportLabel("INCONNU")).toBe("INCONNU");
  });

  it("retourne un libellé lisible pour une fréquence connue", () => {
    expect(getFrequencyLabel("TRIMESTRIEL")).toBe("Trimestriel");
  });
});
