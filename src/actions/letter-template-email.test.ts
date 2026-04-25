import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit";

const sendLetterEmail = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const generateLetterPdf = vi.hoisted(() => vi.fn());
const mockUpload = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
const mockSignedUrlDoc = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { signedUrl: "https://cdn.example.com/doc.pdf" } }));

vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/email", () => ({ sendLetterEmail }));
vi.mock("@/lib/letter-pdf", () => ({ generateLetterPdf }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
        createSignedUrl: mockSignedUrlDoc,
      })),
    },
  })),
}));

import {
  sendLetterByEmail,
  sendLetterToBuilding,
} from "./letter-template-email";

const SOCIETY_ID = "cm8m6m6m6000008l2a1bcdefg";
const TENANT_ID = "cm8m6m6m6000008l2a1bcdefh";
const BUILDING_ID = "cm8m6m6m6000008l2a1bcdefi";
const LEASE_ID = "cm8m6m6m6000008l2a1bcdefj";

describe("letter-template-email actions", () => {
  const prevSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    generateLetterPdf.mockResolvedValue(Buffer.from("pdf-buffer"));
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = prevSupabaseUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = prevSupabaseKey;
  });

  it("retourne une erreur si le locataire n'a pas d'email", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.tenant.findFirst.mockResolvedValue({
      email: null,
      firstName: "Alice",
      lastName: "Durand",
    } as never);

    const result = await sendLetterByEmail(SOCIETY_ID, {
      templateId: "courrier_libre",
      tenantId: TENANT_ID,
      values: {
        BAILLEUR_NOM: "Ma Société",
        BAILLEUR_ADRESSE: "1 rue de Paris",
        LOCATAIRE_NOM: "Alice Durand",
        LOCATAIRE_ADRESSE: "2 avenue Victor Hugo",
        DATE: "20/04/2026",
        LIEU: "Paris",
        OBJET: "Information",
        CORPS: "Bonjour",
      },
    });

    expect(result).toEqual({
      success: false,
      error: "Le locataire n'a pas d'adresse email",
    });
  });

  it("envoie un courrier par email et écrit l'audit", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.tenant.findFirst.mockResolvedValue({
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Durand",
    } as never);
    prismaMock.society.findUnique.mockResolvedValue({
      name: "Ma Société",
      siret: "12345678900011",
    } as never);

    const result = await sendLetterByEmail(SOCIETY_ID, {
      templateId: "courrier_libre",
      tenantId: TENANT_ID,
      values: {
        BAILLEUR_NOM: "Ma Société",
        BAILLEUR_ADRESSE: "1 rue de Paris",
        LOCATAIRE_NOM: "Alice Durand",
        LOCATAIRE_ADRESSE: "2 avenue Victor Hugo",
        DATE: "20/04/2026",
        LIEU: "Paris",
        OBJET: "Information",
        CORPS: "Bonjour",
      },
    });

    expect(result).toEqual({ success: true });
    expect(sendLetterEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        tenantName: "Alice Durand",
        subject: "Courrier",
        attachment: expect.objectContaining({
          filename: expect.stringMatching(/^courrier-courrier-libre-\d{4}-\d{2}-\d{2}\.pdf$/),
          content: Buffer.from("pdf-buffer"),
        }),
      })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        entity: "Letter",
        details: expect.objectContaining({ action: "email_sent" }),
      })
    );
  });

  it("retourne une erreur si l'immeuble n'existe pas", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.building.findFirst.mockResolvedValue(null);

    const result = await sendLetterToBuilding(SOCIETY_ID, {
      templateId: "courrier_libre",
      buildingId: BUILDING_ID,
      commonValues: {
        BAILLEUR_NOM: "Ma Société",
        BAILLEUR_ADRESSE: "1 rue de Paris",
        DATE: "20/04/2026",
        LIEU: "Paris",
        OBJET: "Information",
        CORPS: "Bonjour",
      },
    });

    expect(result).toEqual({ success: false, error: "Immeuble introuvable" });
  });

  it("envoie un courrier groupé et remonte les erreurs locataires", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.building.findFirst.mockResolvedValue({
      name: "Immeuble A",
      lots: [
        {
          leases: [{
            id: LEASE_ID,
            tenant: { id: TENANT_ID, firstName: "Alice", lastName: "Durand", email: "alice@example.com" },
          }],
        },
        {
          leases: [{
            id: "cm8m6m6m6000008l2a1bcdefk",
            tenant: { id: "cm8m6m6m6000008l2a1bcdefl", firstName: "Bob", lastName: "Martin", email: "bob@example.com" },
          }],
        },
      ],
    } as never);
    prismaMock.society.findUnique
      .mockResolvedValueOnce({
        name: "Ma Société",
        addressLine1: "1 rue de Paris",
        addressLine2: null,
        city: "Paris",
        postalCode: "75001",
        siret: "12345678900011",
      } as never)
      .mockResolvedValueOnce({
        name: "Ma Société",
        siret: "12345678900011",
      } as never);
    prismaMock.lease.findFirst
      .mockResolvedValueOnce({
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T00:00:00.000Z"),
        currentRentHT: 900,
        tenant: { firstName: "Alice", lastName: "Durand", email: "alice@example.com", personalAddress: "2 avenue Victor Hugo" },
        lot: { building: { addressLine1: "10 rue des Lilas", city: "Paris", postalCode: "75011" } },
        chargeProvisions: [{ monthlyAmount: 40 }],
      } as never)
      .mockResolvedValueOnce({
        startDate: new Date("2026-02-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T00:00:00.000Z"),
        currentRentHT: 850,
        tenant: { firstName: "Bob", lastName: "Martin", email: "bob@example.com", personalAddress: "3 rue des Fleurs" },
        lot: { building: { addressLine1: "10 rue des Lilas", city: "Paris", postalCode: "75011" } },
        chargeProvisions: [{ monthlyAmount: 35 }],
      } as never);
    sendLetterEmail
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("SMTP indisponible"));

    const result = await sendLetterToBuilding(SOCIETY_ID, {
      templateId: "quittance_loyer",
      buildingId: BUILDING_ID,
      commonValues: {
        BAILLEUR_NOM: "Ma Société",
        BAILLEUR_ADRESSE: "1 rue de Paris",
        DATE: "20/04/2026",
        LIEU: "Paris",
        PERIODE: "avril 2026",
        TOTAL_MONTANT: "940,00 €",
        DATE_PAIEMENT: "20/04/2026",
      },
    });

    expect(result).toEqual({
      success: true,
      data: {
        sent: 1,
        errors: ["Bob Martin: SMTP indisponible"],
      },
    });
    expect(sendLetterEmail).toHaveBeenCalledTimes(2);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        entity: "Letter",
        details: expect.objectContaining({
          action: "building_email_sent",
          sent: 1,
          errors: 1,
        }),
      })
    );
  });

  it("retourne une erreur si aucun locataire n'a d'email dans l'immeuble", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.building.findFirst.mockResolvedValue({
      name: "Immeuble B",
      lots: [
        { leases: [{ id: LEASE_ID, tenant: { id: TENANT_ID, firstName: "Alice", lastName: "Durand", email: null } }] },
      ],
    } as never);

    const result = await sendLetterToBuilding(SOCIETY_ID, {
      templateId: "courrier_libre",
      buildingId: BUILDING_ID,
      commonValues: { BAILLEUR_NOM: "SCI", DATE: "20/04/2026", LIEU: "Paris", OBJET: "Info", CORPS: "Bonjour" },
    });

    expect(result).toEqual({ success: false, error: "Aucun locataire avec email dans cet immeuble" });
  });

  it("retourne erreur non authentifié pour sendLetterToBuilding", async () => {
    mockUnauthenticated();

    const result = await sendLetterToBuilding(SOCIETY_ID, {
      templateId: "courrier_libre",
      buildingId: BUILDING_ID,
      commonValues: {},
    });

    expect(result).toEqual({ success: false, error: "Non authentifié" });
  });

  it("retourne une erreur si rôle insuffisant pour sendLetterByEmail", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);

    const result = await sendLetterByEmail(SOCIETY_ID, {
      templateId: "courrier_libre",
      tenantId: TENANT_ID,
      values: {
        BAILLEUR_NOM: "SCI", BAILLEUR_ADRESSE: "1 rue Paris",
        LOCATAIRE_NOM: "Alice", LOCATAIRE_ADRESSE: "2 avenue Foch",
        DATE: "20/04/2026", LIEU: "Paris", OBJET: "Info", CORPS: "Test",
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si generateLetterPdf lève une exception dans sendLetterByEmail", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.tenant.findFirst.mockResolvedValue({
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Durand",
    } as never);
    prismaMock.society.findUnique.mockResolvedValue({ name: "Ma Société", siret: null } as never);
    generateLetterPdf.mockRejectedValue(new Error("PDF generation failed"));

    const result = await sendLetterByEmail(SOCIETY_ID, {
      templateId: "courrier_libre",
      tenantId: TENANT_ID,
      values: {
        BAILLEUR_NOM: "SCI", BAILLEUR_ADRESSE: "1 rue Paris",
        LOCATAIRE_NOM: "Alice", LOCATAIRE_ADRESSE: "2 avenue Foch",
        DATE: "20/04/2026", LIEU: "Paris", OBJET: "Info", CORPS: "Test",
      },
    });

    expect(result).toEqual({ success: false, error: "Erreur lors de l'envoi du courrier" });
  });

  it("retourne une erreur si rôle insuffisant pour sendLetterToBuilding", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);

    const result = await sendLetterToBuilding(SOCIETY_ID, {
      templateId: "courrier_libre",
      buildingId: BUILDING_ID,
      commonValues: { BAILLEUR_NOM: "SCI", DATE: "20/04/2026", LIEU: "Paris", OBJET: "Info", CORPS: "Test" },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans sendLetterToBuilding", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.building.findFirst.mockRejectedValue(new Error("DB connection lost"));

    const result = await sendLetterToBuilding(SOCIETY_ID, {
      templateId: "courrier_libre",
      buildingId: BUILDING_ID,
      commonValues: {},
    });

    expect(result).toEqual({ success: false, error: "Erreur lors de l'envoi groupé" });
  });

  it("retourne erreur modèle introuvable si templateId n'existe pas dans les builtins ni en BDD", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.tenant.findFirst.mockResolvedValue({
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Durand",
    } as never);
    prismaMock.letterTemplate.findFirst.mockResolvedValue(null);

    const result = await sendLetterByEmail(SOCIETY_ID, {
      templateId: "modele_inexistant",
      tenantId: TENANT_ID,
      values: {
        BAILLEUR_NOM: "SCI",
        BAILLEUR_ADRESSE: "1 rue Paris",
        LOCATAIRE_NOM: "Alice",
        LOCATAIRE_ADRESSE: "2 avenue Foch",
        DATE: "20/04/2026",
        LIEU: "Paris",
        OBJET: "Info",
        CORPS: "Test",
      },
    });

    expect(result).toEqual({ success: false, error: "Modèle introuvable" });
  });

  it("retourne erreur modèle introuvable dans sendLetterToBuilding (ligne 186)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.letterTemplate.findFirst.mockResolvedValue(null);

    const result = await sendLetterToBuilding(SOCIETY_ID, {
      templateId: "modele_inexistant",
      buildingId: BUILDING_ID,
      commonValues: {},
    });

    expect(result).toEqual({ success: false, error: "Modèle introuvable" });
  });

  it("retourne erreur non authentifié pour sendLetterByEmail (ligne 153)", async () => {
    mockUnauthenticated();
    const result = await sendLetterByEmail(SOCIETY_ID, {
      templateId: "courrier_libre",
      tenantId: TENANT_ID,
      values: { BAILLEUR_NOM: "SCI", BAILLEUR_ADRESSE: "1 rue Paris", LOCATAIRE_NOM: "Alice", LOCATAIRE_ADRESSE: "2 av", DATE: "20/04/2026", LIEU: "Paris", OBJET: "Info", CORPS: "Test" },
    });
    expect(result).toEqual({ success: false, error: "Non authentifié" });
  });

  it("retourne une erreur Zod si templateId est vide (ligne 76)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    const result = await sendLetterByEmail(SOCIETY_ID, {
      templateId: "",
      tenantId: TENANT_ID,
      values: {},
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/requis/i);
  });

  it("utilise le sujet et corps d'un modèle personnalisé dans sendLetterByEmail (lignes 92-93)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.letterTemplate.findFirst.mockResolvedValue({
      id: "custom-template-id",
      subject: "Sujet personnalisé",
      bodyHtml: "<p>Corps personnalisé</p>",
    } as never);
    prismaMock.tenant.findFirst.mockResolvedValue({
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Durand",
    } as never);
    prismaMock.society.findUnique.mockResolvedValue({ name: "Ma Société", siret: null } as never);

    const result = await sendLetterByEmail(SOCIETY_ID, {
      templateId: "custom-template-id",
      tenantId: TENANT_ID,
      values: { BAILLEUR_NOM: "SCI", BAILLEUR_ADRESSE: "1 rue Paris", LOCATAIRE_NOM: "Alice", LOCATAIRE_ADRESSE: "2 av", DATE: "20/04/2026", LIEU: "Paris", OBJET: "Info", CORPS: "Test" },
    });
    expect(result.success).toBe(true);
    expect(sendLetterEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: "Sujet personnalisé" }));
  });

  it("sauvegarde le PDF dans Supabase si les env vars sont configurées (lignes 31-48)", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.com";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    try {
      mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
      prismaMock.tenant.findFirst.mockResolvedValue({ email: "alice@example.com", firstName: "Alice", lastName: "Durand" } as never);
      prismaMock.society.findUnique.mockResolvedValue({ name: "Ma Société", siret: null } as never);
      prismaMock.document.create.mockResolvedValue({} as never);

      const result = await sendLetterByEmail(SOCIETY_ID, {
        templateId: "courrier_libre",
        tenantId: TENANT_ID,
        values: { BAILLEUR_NOM: "SCI", BAILLEUR_ADRESSE: "1 rue Paris", LOCATAIRE_NOM: "Alice", LOCATAIRE_ADRESSE: "2 av", DATE: "20/04/2026", LIEU: "Paris", OBJET: "Info", CORPS: "Test" },
      });
      expect(result.success).toBe(true);
      expect(mockUpload).toHaveBeenCalled();
      expect(prismaMock.document.create).toHaveBeenCalled();
    } finally {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  });

  it("log l'erreur upload Supabase et continue (lignes 39-41)", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.com";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    try {
      mockUpload.mockResolvedValueOnce({ error: { message: "Upload failed" } });
      mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
      prismaMock.tenant.findFirst.mockResolvedValue({ email: "alice@example.com", firstName: "Alice", lastName: "Durand" } as never);
      prismaMock.society.findUnique.mockResolvedValue({ name: "Ma Société", siret: null } as never);

      const result = await sendLetterByEmail(SOCIETY_ID, {
        templateId: "courrier_libre",
        tenantId: TENANT_ID,
        values: { BAILLEUR_NOM: "SCI", BAILLEUR_ADRESSE: "1 rue Paris", LOCATAIRE_NOM: "Alice", LOCATAIRE_ADRESSE: "2 av", DATE: "20/04/2026", LIEU: "Paris", OBJET: "Info", CORPS: "Test" },
      });
      expect(result.success).toBe(true);
      expect(prismaMock.document.create).not.toHaveBeenCalled();
    } finally {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  });

  it("utilise le sujet d'un modèle personnalisé dans sendLetterToBuilding (lignes 183-188)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.letterTemplate.findFirst.mockResolvedValue({
      id: "custom-building-template",
      subject: "Sujet immeuble",
      bodyHtml: "<p>Corps immeuble</p>",
    } as never);
    prismaMock.building.findFirst.mockResolvedValue({
      name: "Immeuble A",
      lots: [{ leases: [{ id: LEASE_ID, tenant: { id: TENANT_ID, firstName: "Alice", lastName: "Durand", email: "alice@example.com" } }] }],
    } as never);
    // society.findUnique is called 4 times (requireSocietyAccess ×2, getAutoFillData ×1, main ×1)
    prismaMock.society.findUnique
      .mockResolvedValueOnce({ ownerId: null } as never)
      .mockResolvedValueOnce({ ownerId: null } as never)
      .mockResolvedValueOnce({ name: "Ma Société", addressLine1: "1 rue Paris", addressLine2: null, city: "Paris", postalCode: "75001", siret: null } as never)
      .mockResolvedValueOnce({ name: "Ma Société", siret: null } as never);
    prismaMock.lease.findFirst.mockResolvedValue({
      startDate: new Date("2026-01-01"),
      endDate: null,
      currentRentHT: 800,
      tenant: { firstName: "Alice", lastName: "Durand", email: "alice@example.com", personalAddress: "2 av Victor Hugo" },
      lot: { building: { addressLine1: "10 rue des Lilas", city: "Paris", postalCode: "75011" } },
      chargeProvisions: [],
    } as never);

    const result = await sendLetterToBuilding(SOCIETY_ID, {
      templateId: "custom-building-template",
      buildingId: BUILDING_ID,
      commonValues: {},
    });
    expect(result.success).toBe(true);
    expect(sendLetterEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: "Sujet immeuble" }));
  });

  it("remplit les variables via autoFill dans sendLetterToBuilding (lignes 237-252)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.building.findFirst.mockResolvedValue({
      name: "Immeuble A",
      lots: [{ leases: [{ id: LEASE_ID, tenant: { id: TENANT_ID, firstName: "Alice", lastName: "Durand", email: "alice@example.com" } }] }],
    } as never);
    // society.findUnique is called 4 times:
    // #1: requireSocietyAccess inside sendLetterToBuilding's requireSocietyActionContext
    // #2: requireSocietyAccess inside getAutoFillData's requireSocietyActionContext
    // #3: getAutoFillData's own society lookup
    // #4: sendLetterToBuilding's own society lookup (line 221)
    prismaMock.society.findUnique
      .mockResolvedValueOnce({ ownerId: null } as never)
      .mockResolvedValueOnce({ ownerId: null } as never)
      .mockResolvedValueOnce({ name: "Ma Société", addressLine1: "1 rue Paris", addressLine2: null, city: "Paris", postalCode: "75001", siret: "12345678900011" } as never)
      .mockResolvedValueOnce({ name: "Ma Société", siret: "12345678900011" } as never);
    prismaMock.lease.findFirst.mockResolvedValue({
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      currentRentHT: 900,
      tenant: { firstName: "Alice", lastName: "Durand", email: "alice@example.com", personalAddress: "2 avenue Victor Hugo" },
      lot: { building: { addressLine1: "10 rue des Lilas", city: "Paris", postalCode: "75011" } },
      chargeProvisions: [{ monthlyAmount: 40, isActive: true }],
    } as never);

    // Use quittance_loyer (has society_name, today, tenant_name, lot_address, rent_amount, charges_amount)
    // commonValues has BAILLEUR_NOM so that variable gets a continue (line 239 covered)
    const result = await sendLetterToBuilding(SOCIETY_ID, {
      templateId: "quittance_loyer",
      buildingId: BUILDING_ID,
      commonValues: { BAILLEUR_NOM: "Ma Société" },
    });
    expect(result.success).toBe(true);
    expect(result.data?.sent).toBe(1);
  });
});
