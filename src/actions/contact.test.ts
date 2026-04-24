import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("bcryptjs", () => ({ hash: vi.fn().mockResolvedValue("hashed-password") }));
vi.mock("@/lib/email", () => ({ sendNewUserEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/env", () => ({ env: { AUTH_URL: "https://app.example.com" } }));

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { createContact, updateContact, getContacts, getContactById, inviteContactAsUser } from "./contact";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const CONTACT_ID = "clh3x2z4k0001qh8g7z1y2v3u";

const validInput = {
  contactType: "PRESTATAIRE" as const,
  name: "Plomberie Martin",
  email: "martin@plomberie.fr",
};

const buildContact = (overrides = {}) => ({
  id: CONTACT_ID,
  societyId: SOCIETY_ID,
  contactType: "PRESTATAIRE",
  name: "Plomberie Martin",
  company: null,
  specialty: null,
  email: "martin@plomberie.fr",
  phone: null,
  mobile: null,
  addressLine1: null,
  city: null,
  postalCode: null,
  notes: null,
  isActive: true,
  userId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("createContact", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await createContact(SOCIETY_ID, validInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/authentif/i);
  });

  it("crée un contact avec succès", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.contact.create.mockResolvedValue(buildContact() as never);

    const result = await createContact(SOCIETY_ID, validInput);

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(CONTACT_ID);
    expect(prismaMock.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Plomberie Martin", societyId: SOCIETY_ID }),
      })
    );
  });

  it("retourne une erreur si validation Zod échoue (nom vide)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);

    const result = await createContact(SOCIETY_ID, { ...validInput, name: "" });
    expect(result.success).toBe(false);
  });
});

describe("updateContact", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await updateContact(SOCIETY_ID, { id: CONTACT_ID, name: "Nouveau nom" });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si contact introuvable", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.contact.findFirst.mockResolvedValue(null);

    const result = await updateContact(SOCIETY_ID, { id: CONTACT_ID, name: "Nouveau nom" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("met à jour le contact avec succès", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.contact.findFirst.mockResolvedValue(buildContact() as never);
    prismaMock.contact.update.mockResolvedValue(buildContact({ name: "Nouveau nom" }) as never);

    const result = await updateContact(SOCIETY_ID, { id: CONTACT_ID, name: "Nouveau nom" });
    expect(result.success).toBe(true);
    expect(prismaMock.contact.update).toHaveBeenCalled();
  });
});

describe("getContacts", () => {
  it("retourne un tableau vide si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getContacts(SOCIETY_ID);
    expect(result).toEqual([]);
  });

  it("retourne les contacts actifs de la société", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.contact.findMany.mockResolvedValue([buildContact()] as never);

    const result = await getContacts(SOCIETY_ID);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Plomberie Martin");
  });
});

describe("getContactById", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getContactById(SOCIETY_ID, CONTACT_ID);
    expect(result).toBeNull();
  });

  it("retourne le contact si trouvé", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.contact.findFirst.mockResolvedValue(buildContact() as never);

    const result = await getContactById(SOCIETY_ID, CONTACT_ID);
    expect(result?.id).toBe(CONTACT_ID);
  });
});

describe("inviteContactAsUser", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await inviteContactAsUser(SOCIETY_ID, CONTACT_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si contact introuvable", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.contact.findFirst.mockResolvedValue(null);

    const result = await inviteContactAsUser(SOCIETY_ID, CONTACT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("retourne une erreur si contact sans email", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.contact.findFirst.mockResolvedValue(buildContact({ email: null }) as never);

    const result = await inviteContactAsUser(SOCIETY_ID, CONTACT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/);
  });

  it("associe un utilisateur existant si email déjà enregistré", async () => {
    // Faire passer requireSocietyAccess via ownerId pour libérer userSociety.findUnique
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.society.findUnique.mockResolvedValue({ ownerId: "user-1", proprietaire: null } as never);
    prismaMock.contact.findFirst.mockResolvedValue(buildContact() as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing-user-id", email: "martin@plomberie.fr" } as never);
    prismaMock.userSociety.findUnique.mockResolvedValue(null);
    prismaMock.userSociety.create.mockResolvedValue({} as never);

    const result = await inviteContactAsUser(SOCIETY_ID, CONTACT_ID);
    expect(result.success).toBe(true);
    expect(result.data?.userId).toBe("existing-user-id");
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("retourne une erreur si utilisateur déjà membre", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.society.findUnique.mockResolvedValue({ ownerId: "user-1", proprietaire: null } as never);
    prismaMock.contact.findFirst.mockResolvedValue(buildContact() as never);
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing-user-id" } as never);
    prismaMock.userSociety.findUnique.mockResolvedValue({ userId: "existing-user-id", societyId: SOCIETY_ID } as never);

    const result = await inviteContactAsUser(SOCIETY_ID, CONTACT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/déjà membre/);
  });

  it("crée un nouvel utilisateur si email non enregistré", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.society.findUnique.mockResolvedValue({ ownerId: "user-1", proprietaire: null } as never);
    prismaMock.contact.findFirst.mockResolvedValue(buildContact() as never);
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: "new-user-id" } as never);
    prismaMock.userSociety.create.mockResolvedValue({} as never);

    const result = await inviteContactAsUser(SOCIETY_ID, CONTACT_ID);
    expect(result.success).toBe(true);
    expect(result.data?.userId).toBe("new-user-id");
    expect(prismaMock.user.create).toHaveBeenCalled();
  });
});
