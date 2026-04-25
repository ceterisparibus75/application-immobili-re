import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

// Anthropic SDK — mocké comme classe pour supporter new Anthropic(...)
const MOCK_EXTRACTED_JSON = JSON.stringify({
  immeuble: { name: "Immeuble Test", addressLine1: "1 rue Test", city: "Paris", postalCode: "75001", buildingType: "BUREAU" },
  lot: { number: "A1", lotType: "BUREAUX", area: 50 },
  locataire: { entityType: "PERSONNE_MORALE", companyName: "ACME SAS", email: "contact@acme.fr" },
  bail: { leaseType: "COMMERCIAL_369", startDate: "2026-01-01", durationMonths: 108, baseRentHT: 2000, depositAmount: 4000, paymentFrequency: "MENSUEL", vatApplicable: true, vatRate: 20, rentFreeMonths: 0, entryFee: 0 },
});

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: MOCK_EXTRACTED_JSON }],
      }),
    };
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
import { createAuditLog } from "@/lib/audit";

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
