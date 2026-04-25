import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit";

const revalidatePath = vi.hoisted(() => vi.fn());
const generateLetterPdf = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/letter-pdf", () => ({ generateLetterPdf }));

import {
  deleteCustomTemplate,
  generateLetter,
  getAutoFillData,
  getBuildingsWithTenants,
  getLetterTemplates,
  getTenantsWithLease,
  saveCustomTemplate,
} from "./letter-template";

const SOCIETY_ID = "cm8m6m6m6000008l2a1bcdefg";
const LEASE_ID = "cm8m6m6m6000008l2a1bcdefi";

describe("letter-template actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateLetterPdf.mockResolvedValue(Buffer.from("pdf-buffer"));
  });

  it("retourne une erreur si non authentifié pour la liste des locataires", async () => {
    mockUnauthenticated();

    const result = await getTenantsWithLease(SOCIETY_ID);

    expect(result).toEqual({ success: false, error: "Non authentifié" });
  });

  it("retourne les locataires avec leurs baux actifs", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.tenant.findMany.mockResolvedValue([
      { id: "t-1", firstName: "Alice", lastName: "Durand", leases: [{ id: LEASE_ID }] },
      { id: "t-2", firstName: "Bob", lastName: "Martin", leases: [] },
    ] as never);

    const result = await getTenantsWithLease(SOCIETY_ID);

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data![0]).toMatchObject({ id: "t-1", leaseId: LEASE_ID });
    expect(result.data![1]).toMatchObject({ id: "t-2", leaseId: undefined });
  });

  it("retourne les modèles built-in et personnalisés", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.letterTemplate.findMany.mockResolvedValue([
      { id: "tpl-1", name: "Mon modèle" },
    ] as never);

    const result = await getLetterTemplates(SOCIETY_ID);

    expect(result.success).toBe(true);
    expect(result.data?.templates.some((t) => t.id === "quittance_loyer" && !t.isCustom)).toBe(true);
    expect(result.data?.templates).toContainEqual({
      id: "tpl-1",
      name: "Mon modèle",
      description: "Modèle personnalisé",
      category: "administratif",
      isCustom: true,
    });
  });

  it("auto-remplit les données société, locataire et bail actif", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.society.findUnique.mockResolvedValue({
      name: "Ma Société",
      addressLine1: "1 rue de Paris",
      addressLine2: null,
      city: "Paris",
      postalCode: "75001",
      siret: "12345678900011",
    } as never);
    prismaMock.lease.findFirst.mockResolvedValue({
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T00:00:00.000Z"),
      currentRentHT: 900,
      tenant: {
        firstName: "Alice",
        lastName: "Durand",
        email: "alice@example.com",
        personalAddress: "2 avenue Victor Hugo",
      },
      lot: {
        building: {
          addressLine1: "10 rue des Lilas",
          city: "Paris",
          postalCode: "75011",
        },
      },
      chargeProvisions: [{ monthlyAmount: 40 }, { monthlyAmount: 20 }],
    } as never);

    const result = await getAutoFillData(SOCIETY_ID, undefined, LEASE_ID);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      societyName: "Ma Société",
      societySiret: "12345678900011",
      tenantName: "Alice Durand",
      tenantAddress: "2 avenue Victor Hugo",
      lotAddress: "10 rue des Lilas, 75011 Paris",
      rentAmount: expect.stringContaining("900,00"),
      chargesAmount: expect.stringContaining("60,00"),
    });
  });

  it("génère un PDF à partir d'un modèle built-in et écrit l'audit", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.society.findUnique.mockResolvedValue({
      name: "Ma Société",
      siret: "12345678900011",
    } as never);

    const result = await generateLetter(SOCIETY_ID, {
      templateId: "courrier_libre",
      values: {
        BAILLEUR_NOM: "Ma Société",
        BAILLEUR_ADRESSE: "1 rue de Paris",
        LOCATAIRE_NOM: "Alice Durand",
        LOCATAIRE_ADRESSE: "2 avenue Victor Hugo",
        DATE: "20/04/2026",
        LIEU: "Paris",
        OBJET: "Information",
        CORPS: "Bonjour {{LOCATAIRE_NOM}}",
      },
    });

    expect(result).toEqual({
      success: true,
      data: {
        buffer: Buffer.from("pdf-buffer").toString("base64"),
        filename: expect.stringMatching(/^courrier-courrier-libre-\d{4}-\d{2}-\d{2}\.pdf$/),
      },
    });
    expect(generateLetterPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        senderName: "Ma Société",
        recipientName: "Alice Durand",
        subject: "Courrier",
        bodyHtml: expect.stringContaining("Bonjour {{LOCATAIRE_NOM}}"),
      })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        entity: "Letter",
        entityId: "courrier_libre",
      })
    );
  });

  it("auto-remplit uniquement les données locataire si tenantId fourni sans leaseId", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.society.findUnique.mockResolvedValue({
      name: "Ma Société",
      addressLine1: "1 rue de Paris",
      addressLine2: null,
      city: "Paris",
      postalCode: "75001",
      siret: null,
    } as never);
    prismaMock.tenant.findFirst.mockResolvedValue({
      firstName: "Bob",
      lastName: "Martin",
      personalAddress: "5 rue de Lyon",
    } as never);
    prismaMock.lease.findFirst.mockResolvedValue(null);

    const result = await getAutoFillData(SOCIETY_ID, "tenant-1");

    expect(result.success).toBe(true);
    expect(result.data?.tenantName).toBe("Bob Martin");
    expect(result.data?.tenantAddress).toBe("5 rue de Lyon");
    expect(result.data?.rentAmount).toBeUndefined();
  });

  it("retourne une erreur si la société est introuvable dans getAutoFillData", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.society.findUnique.mockResolvedValue(null);

    const result = await getAutoFillData(SOCIETY_ID);
    expect(result).toEqual({ success: false, error: "Société introuvable" });
  });

  it("retourne les immeubles avec leurs locataires actifs", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.building.findMany.mockResolvedValue([
      {
        id: "bld-1",
        name: "Résidence Atlas",
        city: "Lyon",
        lots: [
          {
            leases: [
              {
                id: LEASE_ID,
                tenant: {
                  id: "tenant-1",
                  firstName: "Alice",
                  lastName: "Durand",
                  companyName: null,
                  entityType: "PERSONNE_PHYSIQUE",
                },
              },
            ],
          },
          { leases: [] },
        ],
      },
      {
        id: "bld-2",
        name: "Immeuble Vide",
        city: "Paris",
        lots: [{ leases: [] }],
      },
    ] as never);

    const result = await getBuildingsWithTenants(SOCIETY_ID);

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1); // bld-2 exclu (aucun locataire)
    expect(result.data![0].name).toBe("Résidence Atlas");
    expect(result.data![0].tenants).toHaveLength(1);
    expect(result.data![0].tenants[0].name).toBe("Alice Durand");
    expect(result.data![0].tenants[0].leaseId).toBe(LEASE_ID);
  });

  it("génère un PDF à partir d'un modèle personnalisé", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.letterTemplate.findFirst.mockResolvedValue({
      id: "tpl-custom",
      subject: "Sujet personnalisé",
      bodyHtml: "<p>Bonjour {{LOCATAIRE_NOM}}</p>",
    } as never);
    prismaMock.society.findUnique.mockResolvedValue({
      name: "Ma Société",
      siret: null,
    } as never);

    const result = await generateLetter(SOCIETY_ID, {
      templateId: "tpl-custom",
      values: {
        BAILLEUR_NOM: "Ma Société",
        BAILLEUR_ADRESSE: "1 rue de Paris",
        LOCATAIRE_NOM: "Bob Martin",
        LOCATAIRE_ADRESSE: "5 rue de Lyon",
        DATE: "25/04/2026",
        LIEU: "Lyon",
      },
    });

    expect(result.success).toBe(true);
    expect(result.data?.filename).toContain("tpl-custom");
    expect(prismaMock.letterTemplate.findFirst).toHaveBeenCalledWith({
      where: { id: "tpl-custom", societyId: SOCIETY_ID },
    });
  });

  it("retourne une erreur si le modèle custom est introuvable dans generateLetter", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.letterTemplate.findFirst.mockResolvedValue(null);

    const result = await generateLetter(SOCIETY_ID, {
      templateId: "tpl-inexistant",
      values: {
        BAILLEUR_NOM: "X", BAILLEUR_ADRESSE: "Y",
        LOCATAIRE_NOM: "Z", LOCATAIRE_ADRESSE: "W",
        DATE: "25/04/2026", LIEU: "Lyon",
      },
    });

    expect(result).toEqual({ success: false, error: "Modèle introuvable" });
  });

  it("sauvegarde puis supprime un modèle personnalisé", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.letterTemplate.create.mockResolvedValue({ id: "tpl-1" } as never);

    const createResult = await saveCustomTemplate(SOCIETY_ID, {
      name: "Courrier sinistre",
      subject: "Déclaration",
      bodyHtml: "<p>Contenu assez long pour le test</p>",
      variables: ["DATE", "LOCATAIRE_NOM"],
    });
    const deleteResult = await deleteCustomTemplate(SOCIETY_ID, "tpl-1");

    expect(createResult).toEqual({ success: true, data: { id: "tpl-1" } });
    expect(prismaMock.letterTemplate.create).toHaveBeenCalledWith({
      data: {
        societyId: SOCIETY_ID,
        name: "Courrier sinistre",
        subject: "Déclaration",
        bodyHtml: "<p>Contenu assez long pour le test</p>",
        variables: ["DATE", "LOCATAIRE_NOM"],
      },
    });
    expect(deleteResult).toEqual({ success: true });
    expect(prismaMock.letterTemplate.delete).toHaveBeenCalledWith({
      where: { id: "tpl-1", societyId: SOCIETY_ID },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/courriers");
  });

  it("retourne une erreur si rôle insuffisant pour saveCustomTemplate", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const result = await saveCustomTemplate(SOCIETY_ID, {
      name: "Test",
      subject: "Test",
      bodyHtml: "<p>Test</p>",
      variables: [],
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans saveCustomTemplate", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.letterTemplate.create.mockRejectedValue(new Error("DB error"));
    const result = await saveCustomTemplate(SOCIETY_ID, {
      name: "Test",
      subject: "Test",
      bodyHtml: "<p>Test</p>",
      variables: [],
    });
    expect(result).toEqual({ success: false, error: "Erreur lors de la sauvegarde du modèle" });
  });

  it("retourne une erreur si rôle insuffisant pour deleteCustomTemplate", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const result = await deleteCustomTemplate(SOCIETY_ID, "tpl-1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans deleteCustomTemplate", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.letterTemplate.delete.mockRejectedValue(new Error("DB error"));
    const result = await deleteCustomTemplate(SOCIETY_ID, "tpl-1");
    expect(result).toEqual({ success: false, error: "Erreur lors de la suppression" });
  });
});
