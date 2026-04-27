import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

// Anthropic SDK — mocké comme classe pour supporter new Anthropic(...)
const anthropicCreateMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    content: [{ type: "text", text: JSON.stringify({
      immeuble: { name: "Immeuble Test", addressLine1: "1 rue Test", city: "Paris", postalCode: "75001", buildingType: "BUREAU" },
      lot: { number: "A1", lotType: "BUREAUX", area: 50 },
      locataire: { entityType: "PERSONNE_MORALE", companyName: "ACME SAS", email: "contact@acme.fr" },
      bail: { leaseType: "COMMERCIAL_369", startDate: "2026-01-01", durationMonths: 108, baseRentHT: 2000, depositAmount: 4000, paymentFrequency: "MENSUEL", vatApplicable: true, vatRate: 20, rentFreeMonths: 0, entryFee: 0 },
    }) }],
  })
);

const MOCK_EXTRACTED_JSON = JSON.stringify({
  immeuble: { name: "Immeuble Test", addressLine1: "1 rue Test", city: "Paris", postalCode: "75001", buildingType: "BUREAU" },
  lot: { number: "A1", lotType: "BUREAUX", area: 50 },
  locataire: { entityType: "PERSONNE_MORALE", companyName: "ACME SAS", email: "contact@acme.fr" },
  bail: { leaseType: "COMMERCIAL_369", startDate: "2026-01-01", durationMonths: 108, baseRentHT: 2000, depositAmount: 4000, paymentFrequency: "MENSUEL", vatApplicable: true, vatRate: 20, rentFreeMonths: 0, entryFee: 0 },
});

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: anthropicCreateMock };
  },
}));

// Env — mocké pour contrôler ANTHROPIC_API_KEY
vi.mock("@/lib/env", () => ({
  env: {
    ANTHROPIC_API_KEY: "sk-ant-test",
    EMAIL_FROM: "test@test.com",
    NEXT_PUBLIC_APP_NAME: "MyGestia",
  },
}));

// active-society — pour analyzePdfAction
vi.mock("@/lib/active-society", () => ({
  getOptionalAccessibleActiveSocietyId: vi.fn().mockResolvedValue("society-1"),
}));

// import-parser — pour parseImportFileAction
vi.mock("@/lib/import-parser", () => ({
  parseImportFile: vi.fn().mockResolvedValue({
    headers: ["nom", "prenom", "email"],
    rows: [{ nom: "Dupont", prenom: "Jean", email: "jean.dupont@example.com" }],
  }),
}));

import {
  importEntities,
  importFromPdf,
  analyzePdfAction,
  parseImportFileAction,
  type ImportInput,
} from "./import";
import { env } from "@/lib/env";
import { createAuditLog } from "@/lib/audit";
import { getOptionalAccessibleActiveSocietyId } from "@/lib/active-society";
import { checkSubscriptionActive, checkLotLimit } from "@/lib/plan-limits";

const SOCIETY_ID = "society-1";
const BUILDING_ID = "cbuilding01";
const LOT_ID = "clot0123456";
const TENANT_ID = "ctenant0123";
const LEASE_ID = "clease01234";

// Helpers FormData
const makeFile = (type: string, name: string, size = 100): File =>
  Object.assign(new Blob(["x".repeat(size)], { type }), {
    name,
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(size)),
  }) as unknown as File;

const makeFormData = (file: File | null, key = "file"): FormData => {
  return { get: (k: string) => (k === key ? file : null) } as unknown as FormData;
};

// ─── importEntities ───────────────────────────────────────────────────────────

describe("importEntities — locataires", () => {
  const validRow = { nom: "Dupont", prenom: "Marie", email: "marie.dupont@example.com" };

  beforeEach(() => {
    prismaMock.tenant.create.mockResolvedValue({ id: TENANT_ID } as never);
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await importEntities(SOCIETY_ID, "tenants", [validRow]);
    expect(r.success).toBe(false);
  });

  it("erreur si role insuffisant (min GESTIONNAIRE requis)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await importEntities(SOCIETY_ID, "tenants", [validRow]);
    expect(r.success).toBe(false);
  });

  it("erreur si aucune donnée fournie", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await importEntities(SOCIETY_ID, "tenants", []);
    expect(r.success).toBe(false);
  });

  it("importe les locataires valides", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await importEntities(SOCIETY_ID, "tenants", [validRow]);
    expect(r.success).toBe(true);
    expect(r.data?.imported).toBe(1);
    expect(r.data?.errors).toHaveLength(0);
    expect(prismaMock.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          societyId: SOCIETY_ID,
          lastName: "Dupont",
          firstName: "Marie",
          email: "marie.dupont@example.com",
        }),
      })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE", entity: "BulkImport" })
    );
  });

  it("importe les locataires avec des colonnes françaises courantes", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await importEntities(SOCIETY_ID, "tenants", [{
      Nom: "Bernard",
      "Prénom": "Lucie",
      Email: "lucie.bernard@example.com",
      "Téléphone": "0601020304",
    }]);

    expect(r.success).toBe(true);
    expect(r.data?.imported).toBe(1);
    expect(prismaMock.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastName: "Bernard",
          firstName: "Lucie",
          email: "lucie.bernard@example.com",
          phone: "0601020304",
        }),
      })
    );
  });

  it("collecte les erreurs de validation sans interrompre le traitement", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const rows = [
      { nom: "Dupont", prenom: "Marie", email: "marie.dupont@example.com" },
      { nom: "", prenom: "Jean", email: "pas-un-email" }, // invalide
      { nom: "Martin", prenom: "Pierre", email: "pierre.martin@example.com" },
    ];

    const r = await importEntities(SOCIETY_ID, "tenants", rows);
    expect(r.success).toBe(true);
    // 2 lignes valides importées, 1 erreur de validation
    expect(r.data?.imported).toBe(2);
    expect(r.data?.errors).toHaveLength(1);
    expect(r.data?.errors[0].row).toBe(3); // ligne 2 du fichier = index 1 + 2
  });

  it("collecte l'erreur DB si tenant.create échoue (catch inner ligne 561)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.tenant.create.mockRejectedValue(new Error("DB insert failed"));
    const r = await importEntities(SOCIETY_ID, "tenants", [{ nom: "Dupont", prenom: "Marie", email: "marie.dupont@example.com" }]);
    expect(r.success).toBe(true);
    expect(r.data?.imported).toBe(0);
    expect(r.data?.errors).toHaveLength(1);
    expect(r.data?.errors[0].message).toContain("DB insert failed");
  });
});

describe("importEntities — immeubles", () => {
  const validRow = {
    name: "Immeuble Haussmann",
    address: "12 boulevard Haussmann",
    postalCode: "75008",
    city: "Paris",
    type: "BUREAU",
  };

  beforeEach(() => {
    prismaMock.building.create.mockResolvedValue({ id: BUILDING_ID } as never);
  });

  it("importe les immeubles valides", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await importEntities(SOCIETY_ID, "buildings", [validRow]);
    expect(r.success).toBe(true);
    expect(r.data?.imported).toBe(1);
    expect(prismaMock.building.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          societyId: SOCIETY_ID,
          name: "Immeuble Haussmann",
          buildingType: "BUREAU",
        }),
      })
    );
  });

  it("importe les immeubles avec des intitulés Excel français", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await importEntities(SOCIETY_ID, "buildings", [{
      Nom: "Résidence Victor Hugo",
      Adresse: "45 avenue Victor Hugo",
      "Code postal": "69006",
      Ville: "Lyon",
      Type: "MIXTE",
    }]);

    expect(r.success).toBe(true);
    expect(r.data?.imported).toBe(1);
    expect(prismaMock.building.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Résidence Victor Hugo",
          addressLine1: "45 avenue Victor Hugo",
          postalCode: "69006",
          city: "Lyon",
          buildingType: "MIXTE",
        }),
      })
    );
  });

  it("erreur si code postal invalide (pas 5 chiffres)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await importEntities(SOCIETY_ID, "buildings", [{ ...validRow, postalCode: "750" }]);
    expect(r.success).toBe(true);
    expect(r.data?.imported).toBe(0);
    expect(r.data?.errors).toHaveLength(1);
  });

  it("collecte l'erreur DB si building.create échoue (catch inner ligne 590)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.building.create.mockRejectedValue(new Error("DB insert failed"));
    const r = await importEntities(SOCIETY_ID, "buildings", [validRow]);
    expect(r.success).toBe(true);
    expect(r.data?.imported).toBe(0);
    expect(r.data?.errors).toHaveLength(1);
    expect(r.data?.errors[0].message).toContain("DB insert failed");
  });
});

describe("importEntities — lots", () => {
  const validRow = {
    reference: "A1",
    type: "BUREAUX",
    surface: "50",
    buildingId: BUILDING_ID,
  };

  beforeEach(() => {
    prismaMock.building.findFirst.mockResolvedValue({ id: BUILDING_ID } as never);
    prismaMock.lot.create.mockResolvedValue({ id: LOT_ID } as never);
  });

  it("vérifie que l'immeuble appartient à la société", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.building.findFirst.mockResolvedValue(null); // immeuble non trouvé

    const r = await importEntities(SOCIETY_ID, "lots", [validRow]);
    expect(r.success).toBe(true);
    expect(r.data?.imported).toBe(0);
    expect(r.data?.errors[0].message).toContain("Immeuble introuvable");
  });

  it("importe les lots valides", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await importEntities(SOCIETY_ID, "lots", [validRow]);
    expect(r.success).toBe(true);
    expect(r.data?.imported).toBe(1);
  });

  it("importe les lots avec des colonnes de tableur françaises", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await importEntities(SOCIETY_ID, "lots", [{
      "Numéro lot": "B2",
      "Type lot": "APPARTEMENT",
      "Surface m²": "72",
      "Étage": "1",
      "ID immeuble": BUILDING_ID,
    }]);

    expect(r.success).toBe(true);
    expect(r.data?.imported).toBe(1);
    expect(prismaMock.lot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          number: "B2",
          lotType: "APPARTEMENT",
          area: 72,
          floor: "1",
        }),
      })
    );
  });

  it("résout l'immeuble par nom pour importer des lots sans identifiant technique", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.building.findFirst.mockResolvedValue({ id: BUILDING_ID } as never);

    const r = await importEntities(SOCIETY_ID, "lots", [{
      "Numéro lot": "C3",
      "Type lot": "BUREAUX",
      "Surface m²": "64",
      Immeuble: "Résidence Victor Hugo",
    }]);

    expect(r.success).toBe(true);
    expect(r.data?.imported).toBe(1);
    expect(prismaMock.building.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          societyId: SOCIETY_ID,
          name: expect.objectContaining({ equals: "Résidence Victor Hugo", mode: "insensitive" }),
        }),
      })
    );
    expect(prismaMock.lot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ buildingId: BUILDING_ID, number: "C3" }),
      })
    );
  });

  it("collecte les erreurs Zod pour les lots invalides (référence vide)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const rows = [
      validRow,
      { reference: "", type: "BUREAUX", surface: "50", buildingId: BUILDING_ID },
    ];
    prismaMock.lot.create.mockResolvedValue({ id: LOT_ID } as never);
    const r = await importEntities(SOCIETY_ID, "lots", rows);
    expect(r.success).toBe(true);
    expect(r.data?.imported).toBe(1);
    expect(r.data?.errors).toHaveLength(1);
  });

  it("collecte les erreurs d'insertion lot quand prisma.lot.create échoue", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.lot.create.mockRejectedValue(new Error("Unique constraint failed"));
    const r = await importEntities(SOCIETY_ID, "lots", [validRow]);
    expect(r.success).toBe(true);
    expect(r.data?.imported).toBe(0);
    expect(r.data?.errors).toHaveLength(1);
    expect(r.data?.errors[0].message).toContain("Unique constraint");
  });

  it("retourne une erreur générique si building.findFirst échoue dans importEntities (lots)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.building.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const r = await importEntities(SOCIETY_ID, "lots", [validRow]);
    expect(r).toEqual({ success: false, error: "Erreur lors de l'import en masse" });
  });
});

// ─── importFromPdf ────────────────────────────────────────────────────────────

const buildImportInput = (): ImportInput => ({
  building: {
    name: "Immeuble Test",
    addressLine1: "1 rue Test",
    city: "Paris",
    postalCode: "75001",
    buildingType: "BUREAU",
  },
  lot: {
    number: "A1",
    lotType: "BUREAUX",
    area: 50,
  },
  tenant: {
    entityType: "PERSONNE_MORALE",
    companyName: "ACME SAS",
    email: "contact@acme.fr",
  },
  lease: {
    leaseType: "COMMERCIAL_369",
    startDate: "2026-01-01",
    durationMonths: 108,
    baseRentHT: 2000,
    depositAmount: 4000,
    paymentFrequency: "MENSUEL",
    vatApplicable: true,
    vatRate: 20,
    rentFreeMonths: 0,
    entryFee: 0,
  },
});

describe("importFromPdf", () => {
  beforeEach(() => {
    // Mock transaction callback — exécute le callback avec prismaMock comme tx
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.building.create.mockResolvedValue({ id: BUILDING_ID } as never);
    prismaMock.lot.findFirst.mockResolvedValue(null); // pas de lot existant avec ce numéro
    prismaMock.lot.create.mockResolvedValue({ id: LOT_ID } as never);
    prismaMock.tenant.create.mockResolvedValue({ id: TENANT_ID } as never);
    prismaMock.leaseLot.findFirst.mockResolvedValue(null); // pas de bail actif
    prismaMock.lease.create.mockResolvedValue({ id: LEASE_ID } as never);
    prismaMock.leaseLot.createMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.lot.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.lot.update.mockResolvedValue({} as never);
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await importFromPdf(SOCIETY_ID, buildImportInput());
    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("erreur si role insuffisant (min GESTIONNAIRE requis)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await importFromPdf(SOCIETY_ID, buildImportInput());
    expect(r.success).toBe(false);
  });

  it("retourne une erreur générique si la BDD lève une valeur non-Error (lignes 328-329)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.$transaction.mockRejectedValueOnce("string error" as unknown as Error);
    const r = await importFromPdf(SOCIETY_ID, buildImportInput());
    expect(r).toEqual({ success: false, error: "Erreur lors de l'import" });
  });

  it("importe le bail complet dans une transaction et crée un audit log", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await importFromPdf(SOCIETY_ID, buildImportInput());
    expect(r.success).toBe(true);
    expect(r.data?.leaseId).toBe(LEASE_ID);
    expect(r.data?.buildingId).toBe(BUILDING_ID);
    expect(r.data?.tenantId).toBe(TENANT_ID);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE", entity: "Import" })
    );
  });

  it("erreur si un bail actif existe déjà sur ce lot", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.leaseLot.findFirst.mockResolvedValue({ id: "cll01234567" } as never);

    const r = await importFromPdf(SOCIETY_ID, buildImportInput());
    expect(r.success).toBe(false);
    expect(r.error).toBe("Ce lot a déjà un bail actif");
  });

  it("erreur si le numéro de lot existe déjà dans cet immeuble", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.lot.findFirst.mockResolvedValue({ id: "cother012345" } as never);

    const r = await importFromPdf(SOCIETY_ID, buildImportInput());
    expect(r.success).toBe(false);
    expect(r.error).toContain('Le lot "A1" existe déjà');
  });
});

// ─── analyzePdfAction ─────────────────────────────────────────────────────────

describe("analyzePdfAction", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await analyzePdfAction(makeFormData(makeFile("application/pdf", "bail.pdf")));
    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("erreur si aucun fichier fourni", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await analyzePdfAction(makeFormData(null));
    expect(r.success).toBe(false);
    expect(r.error).toBe("Aucun fichier fourni");
  });

  it("erreur si fichier n'est pas un PDF", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await analyzePdfAction(makeFormData(makeFile("image/png", "image.png")));
    expect(r.success).toBe(false);
    expect(r.error).toBe("Seuls les fichiers PDF sont acceptés");
  });

  it("extrait et retourne les données du PDF via l'IA", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await analyzePdfAction(makeFormData(makeFile("application/pdf", "bail.pdf")));
    expect(r.success).toBe(true);
    // Le mock retourne un JSON avec un objet "immeuble"
    expect(r.data).toHaveProperty("immeuble");
    expect(r.data).toHaveProperty("bail");
  });
});

// ─── parseImportFileAction ────────────────────────────────────────────────────

describe("parseImportFileAction", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await parseImportFileAction(makeFormData(makeFile("text/csv", "locataires.csv")));
    expect(r.success).toBe(false);
  });

  it("erreur si aucun fichier fourni", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await parseImportFileAction(makeFormData(null));
    expect(r.success).toBe(false);
    expect(r.error).toBe("Aucun fichier fourni");
  });

  it("erreur si format non supporté", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await parseImportFileAction(makeFormData(makeFile("application/pdf", "bail.pdf")));
    expect(r.success).toBe(false);
    expect(r.error).toContain("Format non supporte");
  });

  it("parse et retourne les colonnes + lignes du CSV", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await parseImportFileAction(makeFormData(makeFile("text/csv", "locataires.csv")));
    expect(r.success).toBe(true);
    expect(r.data?.headers).toEqual(["nom", "prenom", "email"]);
    expect(r.data?.rows).toHaveLength(1);
    expect(r.data?.rows[0]).toMatchObject({ email: "jean.dupont@example.com" });
  });
});


// ─── importFromPdf — branches existingId ─────────────────────────────────────

describe("importFromPdf — branches existingId", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.lot.findFirst.mockResolvedValue(null);
    prismaMock.lot.create.mockResolvedValue({ id: LOT_ID } as never);
    prismaMock.tenant.create.mockResolvedValue({ id: TENANT_ID } as never);
    prismaMock.leaseLot.findFirst.mockResolvedValue(null);
    prismaMock.lease.create.mockResolvedValue({ id: LEASE_ID } as never);
    prismaMock.leaseLot.createMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.lot.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.lot.update.mockResolvedValue({} as never);
  });

  it("erreur si l'immeuble existant est introuvable dans cette societe (lignes 133-134)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.building.findFirst.mockResolvedValue(null);
    const input = {
      building: {
        existingId: BUILDING_ID,
        name: "Imm", addressLine1: "1 rue", city: "Paris", postalCode: "75001", buildingType: "BUREAU" as const,
      },
      lot: { number: "A1", lotType: "BUREAUX" as const, area: 50 },
      tenant: { entityType: "PERSONNE_MORALE" as const, companyName: "ACME", email: "a@a.fr" },
      lease: {
        leaseType: "COMMERCIAL_369" as const,
        startDate: "2026-01-01", durationMonths: 108, baseRentHT: 1000, depositAmount: 2000,
        paymentFrequency: "MENSUEL" as const, vatApplicable: true, vatRate: 20, rentFreeMonths: 0, entryFee: 0,
      },
    };
    const r = await importFromPdf(SOCIETY_ID, input);
    expect(r.success).toBe(false);
    expect(r.error).toContain("Immeuble introuvable");
  });

  it("erreur si le lot existant est introuvable dans cet immeuble (lignes 141,144-145)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.building.create.mockResolvedValue({ id: BUILDING_ID } as never);
    prismaMock.lot.findFirst.mockResolvedValue(null);
    const input = {
      building: {
        name: "Imm", addressLine1: "1 rue", city: "Paris", postalCode: "75001", buildingType: "BUREAU" as const,
      },
      lot: { existingId: LOT_ID, number: "A1", lotType: "BUREAUX" as const, area: 50 },
      tenant: { entityType: "PERSONNE_MORALE" as const, companyName: "ACME", email: "a@a.fr" },
      lease: {
        leaseType: "COMMERCIAL_369" as const,
        startDate: "2026-01-01", durationMonths: 108, baseRentHT: 1000, depositAmount: 2000,
        paymentFrequency: "MENSUEL" as const, vatApplicable: true, vatRate: 20, rentFreeMonths: 0, entryFee: 0,
      },
    };
    const r = await importFromPdf(SOCIETY_ID, input);
    expect(r.success).toBe(false);
    expect(r.error).toContain("Lot introuvable");
  });

  it("erreur si un lot secondaire est introuvable (lignes 168,171,179-180)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.building.create.mockResolvedValue({ id: BUILDING_ID } as never);
    prismaMock.lot.create.mockResolvedValue({ id: LOT_ID } as never);
    prismaMock.lot.findMany.mockResolvedValue([] as never); // secondaryLot not found
    const input = {
      building: {
        name: "Imm", addressLine1: "1 rue", city: "Paris", postalCode: "75001", buildingType: "BUREAU" as const,
      },
      lot: { number: "A1", lotType: "BUREAUX" as const, area: 50 },
      tenant: { entityType: "PERSONNE_MORALE" as const, companyName: "ACME", email: "a@a.fr" },
      lease: {
        leaseType: "COMMERCIAL_369" as const,
        startDate: "2026-01-01", durationMonths: 108, baseRentHT: 1000, depositAmount: 2000,
        paymentFrequency: "MENSUEL" as const, vatApplicable: true, vatRate: 20, rentFreeMonths: 0, entryFee: 0,
      },
      secondaryLotIds: ["csec0123456"],
    };
    const r = await importFromPdf(SOCIETY_ID, input);
    expect(r.success).toBe(false);
    expect(r.error).toContain("introuvables");
  });

  it("erreur si le locataire existant est introuvable (lignes 216-217)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.building.create.mockResolvedValue({ id: BUILDING_ID } as never);
    prismaMock.tenant.findFirst.mockResolvedValue(null);
    const input = {
      building: {
        name: "Imm", addressLine1: "1 rue", city: "Paris", postalCode: "75001", buildingType: "BUREAU" as const,
      },
      lot: { number: "A1", lotType: "BUREAUX" as const, area: 50 },
      tenant: { existingId: TENANT_ID, entityType: "PERSONNE_MORALE" as const, email: "a@a.fr" },
      lease: {
        leaseType: "COMMERCIAL_369" as const,
        startDate: "2026-01-01", durationMonths: 108, baseRentHT: 1000, depositAmount: 2000,
        paymentFrequency: "MENSUEL" as const, vatApplicable: true, vatRate: 20, rentFreeMonths: 0, entryFee: 0,
      },
    };
    const r = await importFromPdf(SOCIETY_ID, input);
    expect(r.success).toBe(false);
    expect(r.error).toContain("Locataire introuvable");
  });

  it("erreur si un lot secondaire a deja un bail actif (lignes 227,234-236)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.building.create.mockResolvedValue({ id: BUILDING_ID } as never);
    prismaMock.lot.create.mockResolvedValue({ id: LOT_ID } as never);
    prismaMock.lot.findMany.mockResolvedValue([{ id: "csec0123456" }] as never); // found secondary lot
    prismaMock.leaseLot.findMany.mockResolvedValue([{ id: "cll01234567", lot: { number: "B1" } }] as never);
    const input = {
      building: {
        name: "Imm", addressLine1: "1 rue", city: "Paris", postalCode: "75001", buildingType: "BUREAU" as const,
      },
      lot: { number: "A1", lotType: "BUREAUX" as const, area: 50 },
      tenant: { entityType: "PERSONNE_MORALE" as const, companyName: "ACME", email: "a@a.fr" },
      lease: {
        leaseType: "COMMERCIAL_369" as const,
        startDate: "2026-01-01", durationMonths: 108, baseRentHT: 1000, depositAmount: 2000,
        paymentFrequency: "MENSUEL" as const, vatApplicable: true, vatRate: 20, rentFreeMonths: 0, entryFee: 0,
      },
      secondaryLotIds: ["csec0123456"],
    };
    const r = await importFromPdf(SOCIETY_ID, input);
    expect(r.success).toBe(false);
    expect(r.error).toContain("bail actif");
  });
});

// ─── analyzePdfAction — branches manquantes ───────────────────────────────────

describe("analyzePdfAction — branches manquantes", () => {
  it("erreur si pas de societe active (ligne 410)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    vi.mocked(getOptionalAccessibleActiveSocietyId).mockResolvedValueOnce(null as never);
    const r = await analyzePdfAction(makeFormData(makeFile("application/pdf", "bail.pdf")));
    expect(r.success).toBe(false);
    expect(r.success).toBe(false);
  });

  it("erreur si fichier trop volumineux (ligne 419)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const bigFile = makeFile("application/pdf", "big.pdf");
    Object.defineProperty(bigFile, "size", { value: 21 * 1024 * 1024 });
    const r = await analyzePdfAction(makeFormData(bigFile));
    expect(r.success).toBe(false);
    expect(r.error).toContain("volumineux");
  });

  it("erreur si ANTHROPIC_API_KEY absent (ligne 413)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const original = (env as any).ANTHROPIC_API_KEY;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (env as any).ANTHROPIC_API_KEY = undefined;
    const r = await analyzePdfAction(makeFormData(makeFile("application/pdf", "bail.pdf")));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (env as any).ANTHROPIC_API_KEY = original;
    expect(r.success).toBe(false);
    expect(r.error).toContain("Anthropic");
  });

  it("erreur si la réponse IA ne contient pas de JSON (ligne 442)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    anthropicCreateMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "Texte sans JSON" }],
    });
    const r = await analyzePdfAction(makeFormData(makeFile("application/pdf", "bail.pdf")));
    expect(r.success).toBe(false);
    expect(r.error).toContain("extraire");
  });

  it("retourne une erreur si l'IA lève une exception (lignes 449-450)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    anthropicCreateMock.mockRejectedValueOnce(new Error("Anthropic API down"));
    const r = await analyzePdfAction(makeFormData(makeFile("application/pdf", "bail.pdf")));
    expect(r.success).toBe(false);
    expect(r.error).toContain("Anthropic API down");
  });
});

// ─── parseImportFileAction — branches manquantes ─────────────────────────────

describe("parseImportFileAction — branches manquantes", () => {
  it("erreur si fichier trop volumineux (ligne 495)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const bigFile = makeFile("text/csv", "big.csv");
    Object.defineProperty(bigFile, "size", { value: 11 * 1024 * 1024 });
    const r = await parseImportFileAction(makeFormData(bigFile));
    expect(r.success).toBe(false);
    expect(r.error).toContain("volumineux");
  });

  it("erreur si le fichier est vide (ligne 502)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const { parseImportFile } = await import("@/lib/import-parser");
    vi.mocked(parseImportFile).mockResolvedValueOnce({ headers: [], rows: [] });
    const r = await parseImportFileAction(makeFormData(makeFile("text/csv", "empty.csv")));
    expect(r.success).toBe(false);
    expect(r.error).toContain("vide");
  });

  it("retourne une erreur generique si parseImportFile lance une exception (lignes 508-509)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const { parseImportFile } = await import("@/lib/import-parser");
    vi.mocked(parseImportFile).mockRejectedValueOnce(new Error("Parse failed"));
    const r = await parseImportFileAction(makeFormData(makeFile("text/csv", "bad.csv")));
    expect(r).toEqual({ success: false, error: "Erreur lors de la lecture du fichier" });
  });
});

// ─── importEntities — branches subscription/lot-limit ────────────────────────

describe("importEntities — subscription et lot limit", () => {
  it("erreur si abonnement inactif (ligne 531)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    vi.mocked(checkSubscriptionActive).mockResolvedValueOnce({ active: false, message: "Abonnement expire", status: "CANCELED" } as never);
    const r = await importEntities(SOCIETY_ID, "tenants", [{ nom: "A", prenom: "B", email: "a@b.fr" }]);
    expect(r).toEqual({ success: false, error: "Abonnement expire" });
  });

  it("erreur si limite de lots atteinte (ligne 598)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    vi.mocked(checkLotLimit).mockResolvedValueOnce({ allowed: false, message: "Limite atteinte" } as never);
    const r = await importEntities(SOCIETY_ID, "lots", [{ reference: "A1", type: "BUREAUX", surface: "50", buildingId: BUILDING_ID }]);
    expect(r).toEqual({ success: false, error: "Limite atteinte" });
  });
});


// ─── importFromPdf — lot existant trouve (ligne 145) ─────────────────────────

describe("importFromPdf — lot existant trouve", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.building.create.mockResolvedValue({ id: BUILDING_ID } as never);
    prismaMock.lot.findFirst.mockResolvedValue({ id: LOT_ID, buildingId: BUILDING_ID, number: "A1" } as never);
    prismaMock.tenant.create.mockResolvedValue({ id: TENANT_ID } as never);
    prismaMock.leaseLot.findFirst.mockResolvedValue(null);
    prismaMock.lease.create.mockResolvedValue({ id: LEASE_ID } as never);
    prismaMock.leaseLot.createMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.lot.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.lot.update.mockResolvedValue({} as never);
  });

  it("utilise le lot existant si existingId est fourni et que le lot est trouve (ligne 145)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const input = {
      building: {
        name: "Imm", addressLine1: "1 rue", city: "Paris", postalCode: "75001", buildingType: "BUREAU" as const,
      },
      lot: { existingId: LOT_ID, number: "A1", lotType: "BUREAUX" as const, area: 50 },
      tenant: { entityType: "PERSONNE_MORALE" as const, companyName: "ACME", email: "a@a.fr" },
      lease: {
        leaseType: "COMMERCIAL_369" as const,
        startDate: "2026-01-01", durationMonths: 108, baseRentHT: 1000, depositAmount: 2000,
        paymentFrequency: "MENSUEL" as const, vatApplicable: true, vatRate: 20, rentFreeMonths: 0, entryFee: 0,
      },
    };
    const r = await importFromPdf(SOCIETY_ID, input);
    expect(r.success).toBe(true);
    expect(r.data?.lotId).toBe(LOT_ID);
  });
});

// ─── Branches restantes ────────────────────────────────────────────────────────

describe("importFromPdf — branches restantes", () => {
  const baseLease = {
    leaseType: "COMMERCIAL_369" as const,
    startDate: "2026-01-01", durationMonths: 108, baseRentHT: 1000, depositAmount: 2000,
    paymentFrequency: "MENSUEL" as const, vatApplicable: true, vatRate: 20, rentFreeMonths: 0, entryFee: 0,
  };

  beforeEach(() => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.building.create.mockResolvedValue({ id: BUILDING_ID } as never);
    prismaMock.lot.findFirst.mockResolvedValue(null);
    prismaMock.lot.create.mockResolvedValue({ id: LOT_ID } as never);
    prismaMock.tenant.create.mockResolvedValue({ id: TENANT_ID } as never);
    prismaMock.leaseLot.findFirst.mockResolvedValue(null);
    prismaMock.leaseLot.findMany.mockResolvedValue([] as never);
    prismaMock.lot.findMany.mockResolvedValue([{ id: "csec0123456" }] as never);
    prismaMock.lease.create.mockResolvedValue({ id: LEASE_ID } as never);
    prismaMock.leaseLot.createMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.lot.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.lot.update.mockResolvedValue({} as never);
  });

  it("utilise l'immeuble existant s'il est trouvé (B1 arm1)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.building.findFirst.mockResolvedValue({ id: BUILDING_ID } as never);
    const r = await importFromPdf(SOCIETY_ID, {
      building: { existingId: BUILDING_ID, name: "Imm", addressLine1: "1 rue", city: "Paris", postalCode: "75001", buildingType: "BUREAU" as const },
      lot: { number: "A1", lotType: "BUREAUX" as const, area: 50 },
      tenant: { entityType: "PERSONNE_MORALE" as const, companyName: "ACME", email: "a@a.fr" },
      lease: baseLease,
    });
    expect(r.success).toBe(true);
  });

  it("crée un locataire PERSONNE_PHYSIQUE avec noms renseignés (B13 arm1, B21/B22 arm0)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await importFromPdf(SOCIETY_ID, {
      building: { name: "Imm", addressLine1: "1 rue", city: "Paris", postalCode: "75001", buildingType: "BUREAU" as const },
      lot: { number: "A1", lotType: "BUREAUX" as const, area: 50 },
      tenant: { entityType: "PERSONNE_PHYSIQUE" as const, firstName: "Jean", lastName: "Dupont", email: "j@d.fr" },
      lease: baseLease,
    });
    expect(r.success).toBe(true);
    expect(prismaMock.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ firstName: "Jean", lastName: "Dupont" }) })
    );
  });

  it("crée un locataire PERSONNE_PHYSIQUE avec noms null → 'À compléter' (B21/B22 arm1)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await importFromPdf(SOCIETY_ID, {
      building: { name: "Imm", addressLine1: "1 rue", city: "Paris", postalCode: "75001", buildingType: "BUREAU" as const },
      lot: { number: "A1", lotType: "BUREAUX" as const, area: 50 },
      tenant: { entityType: "PERSONNE_PHYSIQUE" as const, email: "j@d.fr" },
      lease: baseLease,
    });
    expect(r.success).toBe(true);
    expect(prismaMock.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ firstName: "À compléter", lastName: "À compléter" }) })
    );
  });

  it("crée un locataire PERSONNE_MORALE sans companyName → 'À compléter' (B14 arm1)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await importFromPdf(SOCIETY_ID, {
      building: { name: "Imm", addressLine1: "1 rue", city: "Paris", postalCode: "75001", buildingType: "BUREAU" as const },
      lot: { number: "A1", lotType: "BUREAUX" as const, area: 50 },
      tenant: { entityType: "PERSONNE_MORALE" as const, email: "a@a.fr" },
      lease: baseLease,
    });
    expect(r.success).toBe(true);
    expect(prismaMock.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ companyName: "À compléter" }) })
    );
  });

  it("utilise le locataire existant s'il est trouvé (B23 arm1)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.tenant.findFirst.mockResolvedValue({ id: TENANT_ID } as never);
    const r = await importFromPdf(SOCIETY_ID, {
      building: { name: "Imm", addressLine1: "1 rue", city: "Paris", postalCode: "75001", buildingType: "BUREAU" as const },
      lot: { number: "A1", lotType: "BUREAUX" as const, area: 50 },
      tenant: { existingId: TENANT_ID, entityType: "PERSONNE_MORALE" as const, email: "a@a.fr" },
      lease: baseLease,
    });
    expect(r.success).toBe(true);
  });

  it("accepte les lots secondaires sans bail actif (B26 arm1)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.lot.findMany.mockResolvedValue([{ id: "csec0123456" }] as never);
    prismaMock.leaseLot.findMany.mockResolvedValue([] as never); // no active secondary leases
    const r = await importFromPdf(SOCIETY_ID, {
      building: { name: "Imm", addressLine1: "1 rue", city: "Paris", postalCode: "75001", buildingType: "BUREAU" as const },
      lot: { number: "A1", lotType: "BUREAUX" as const, area: 50 },
      tenant: { entityType: "PERSONNE_MORALE" as const, companyName: "ACME", email: "a@a.fr" },
      lease: baseLease,
      secondaryLotIds: ["csec0123456"],
    });
    expect(r.success).toBe(true);
  });
});

describe("analyzePdfAction — branches restantes", () => {
  it("retourne rawText vide si le contenu IA n'est pas du texte (B50 arm1)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    anthropicCreateMock.mockResolvedValueOnce({ content: [{ type: "tool_use", id: "x", name: "x", input: {} }] });
    const r = await analyzePdfAction(makeFormData(makeFile("application/pdf", "bail.pdf")));
    expect(r.success).toBe(false);
    expect(r.error).toContain("extraire");
  });

  it("retourne l'erreur brute si l'exception n'est pas une Error (B53 arm1)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    anthropicCreateMock.mockRejectedValueOnce("string error");
    const r = await analyzePdfAction(makeFormData(makeFile("application/pdf", "bail.pdf")));
    expect(r.success).toBe(false);
    expect(r.error).toContain("analyse du document");
  });
});

describe("importEntities — branches internes restantes", () => {
  it("collecte 'Erreur d\\'insertion' si tenant.create lève un non-Error (B66 arm1)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.tenant.create.mockRejectedValue("string error");
    const r = await importEntities(SOCIETY_ID, "tenants", [{ nom: "X", prenom: "Y", email: "x@y.fr" }]);
    expect(r.success).toBe(true);
    expect(r.data?.errors[0].message).toBe("Erreur d'insertion");
  });

  it("collecte 'Erreur d\\'insertion' si building.create lève un non-Error (B69 arm1)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.building.create.mockRejectedValue("string error");
    const r = await importEntities(SOCIETY_ID, "buildings", [{
      name: "Imm", address: "1 rue", postalCode: "75001", city: "Paris", type: "BUREAU",
    }]);
    expect(r.success).toBe(true);
    expect(r.data?.errors[0].message).toBe("Erreur d'insertion");
  });

  it("ne traite rien pour un entityType inconnu (B70 arm1)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await importEntities(SOCIETY_ID, "unknown" as never, [{ nom: "X" }]);
    expect(r.success).toBe(true);
    expect(r.data?.imported).toBe(0);
  });

  it("collecte 'Erreur d\\'insertion' si lot.create lève un non-Error (B75 arm1)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.building.findFirst.mockResolvedValue({ id: BUILDING_ID } as never);
    prismaMock.lot.create.mockRejectedValue("string error");
    const r = await importEntities(SOCIETY_ID, "lots", [{
      reference: "A1", type: "BUREAUX", surface: "50", buildingId: BUILDING_ID,
    }]);
    expect(r.success).toBe(true);
    expect(r.data?.errors[0].message).toBe("Erreur d'insertion");
  });
});

