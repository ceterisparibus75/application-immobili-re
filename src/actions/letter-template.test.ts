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
});
