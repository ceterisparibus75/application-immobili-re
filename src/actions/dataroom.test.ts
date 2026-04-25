import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/email", () => ({
  sendDataroomDocumentAddedEmail: vi.fn().mockResolvedValue({ success: true }),
  sendDataroomAccessEmail: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  createDataroom,
  updateDataroom,
  deleteDataroom,
  activateDataroom,
  archiveDataroom,
  addDocumentToDataroom,
  removeDocumentFromDataroom,
  verifyDataroomPassword,
  reorderDocument,
  getDatarooms,
  getDataroom,
  getDataroomByToken,
  getDataroomsForDocument,
  getDataroomMeta,
} from "./dataroom";
import { createAuditLog } from "@/lib/audit";

const SOCIETY_ID = "society-1";
const DATAROOM_ID = "dr-1";
const DOC_ID = "doc-1";
const SHARE_TOKEN = "token-abc123";

const buildDataroom = (overrides = {}) => ({
  id: DATAROOM_ID,
  societyId: SOCIETY_ID,
  name: "Dossier Vente Immeuble A",
  description: null,
  purpose: "VENTE",
  status: "BROUILLON",
  shareToken: SHARE_TOKEN,
  password: null,
  expiresAt: null,
  accessCount: 0,
  lastAccessedAt: null,
  recipientEmail: null,
  recipientName: null,
  createdBy: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  society: { name: "Ma Société" },
  ...overrides,
});

// ─── createDataroom ───────────────────────────────────────────────────────────

describe("createDataroom", () => {
  const validInput = { name: "Dossier Vente Immeuble A", purpose: "VENTE" as const };

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await createDataroom(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("erreur si role LECTURE (min GESTIONNAIRE requis)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await createDataroom(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toContain("Permissions");
  });

  it("erreur si nom trop court (< 2 chars)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await createDataroom(SOCIETY_ID, { ...validInput, name: "A" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("min. 2");
  });

  it("erreur si email destinataire invalide", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await createDataroom(SOCIETY_ID, {
      ...validInput,
      recipientEmail: "pas-un-email",
    });
    expect(r.success).toBe(false);
  });

  it("crée une dataroom en brouillon", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.dataroom.create.mockResolvedValue(buildDataroom() as never);

    const r = await createDataroom(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    expect(r.data?.id).toBe(DATAROOM_ID);
    expect(prismaMock.dataroom.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          societyId: SOCIETY_ID,
          name: validInput.name,
          password: null,
        }),
      })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE", entity: "Dataroom" })
    );
  });

  it("hash le mot de passe si fourni", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.dataroom.create.mockResolvedValue(buildDataroom() as never);

    await createDataroom(SOCIETY_ID, { ...validInput, password: "secret123" });

    const callArg = prismaMock.dataroom.create.mock.calls[0][0];
    // Le mot de passe doit être haché (commence par $2b$ pour bcrypt)
    expect(callArg.data.password).toMatch(/^\$2[ab]\$/);
  });
});

// ─── updateDataroom ───────────────────────────────────────────────────────────

describe("updateDataroom", () => {
  beforeEach(() => {
    prismaMock.dataroom.findFirst.mockResolvedValue(buildDataroom() as never);
    prismaMock.dataroom.update.mockResolvedValue(buildDataroom() as never);
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await updateDataroom(SOCIETY_ID, DATAROOM_ID, { name: "Nouveau nom" });
    expect(r.success).toBe(false);
  });

  it("erreur si dataroom introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.dataroom.findFirst.mockResolvedValue(null);
    const r = await updateDataroom(SOCIETY_ID, DATAROOM_ID, { name: "Nouveau nom" });
    expect(r.success).toBe(false);
    expect(r.error).toBe("Dataroom introuvable");
  });

  it("met à jour le nom avec succès", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await updateDataroom(SOCIETY_ID, DATAROOM_ID, { name: "Nouveau nom" });
    expect(r.success).toBe(true);
    expect(prismaMock.dataroom.update).toHaveBeenCalled();
  });

  it("supprime le mot de passe si chaîne vide transmise", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    await updateDataroom(SOCIETY_ID, DATAROOM_ID, { password: "" });
    const callArg = prismaMock.dataroom.update.mock.calls[0][0];
    expect(callArg.data.password).toBeNull();
  });
});

// ─── deleteDataroom ───────────────────────────────────────────────────────────

describe("deleteDataroom", () => {
  beforeEach(() => {
    prismaMock.dataroom.findFirst.mockResolvedValue(buildDataroom() as never);
    prismaMock.dataroom.delete.mockResolvedValue(buildDataroom() as never);
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await deleteDataroom(SOCIETY_ID, DATAROOM_ID);
    expect(r.success).toBe(false);
  });

  it("erreur si role LECTURE (min GESTIONNAIRE requis)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await deleteDataroom(SOCIETY_ID, DATAROOM_ID);
    expect(r.success).toBe(false);
  });

  it("supprime et enregistre l'audit", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await deleteDataroom(SOCIETY_ID, DATAROOM_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.dataroom.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: DATAROOM_ID } })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE", entity: "Dataroom" })
    );
  });
});

// ─── activateDataroom ────────────────────────────────────────────────────────

describe("activateDataroom", () => {
  beforeEach(() => {
    prismaMock.dataroom.findFirst.mockResolvedValue(buildDataroom() as never);
    prismaMock.dataroom.update.mockResolvedValue(
      buildDataroom({ status: "ACTIF" }) as never
    );
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await activateDataroom(SOCIETY_ID, DATAROOM_ID);
    expect(r.success).toBe(false);
  });

  it("active la dataroom", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await activateDataroom(SOCIETY_ID, DATAROOM_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.dataroom.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ACTIF" }) })
    );
  });

  it("retourne une erreur si rôle insuffisant", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await activateDataroom(SOCIETY_ID, DATAROOM_ID);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.dataroom.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const r = await activateDataroom(SOCIETY_ID, DATAROOM_ID);
    expect(r).toEqual({ success: false, error: "Erreur lors de l'activation" });
  });
});

// ─── archiveDataroom ─────────────────────────────────────────────────────────

describe("archiveDataroom", () => {
  beforeEach(() => {
    prismaMock.dataroom.findFirst.mockResolvedValue(buildDataroom({ status: "ACTIF" }) as never);
    prismaMock.dataroom.update.mockResolvedValue(buildDataroom({ status: "ARCHIVE" }) as never);
  });

  it("archive la dataroom", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await archiveDataroom(SOCIETY_ID, DATAROOM_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.dataroom.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ARCHIVE" }) })
    );
  });

  it("retourne une erreur si rôle insuffisant", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await archiveDataroom(SOCIETY_ID, DATAROOM_ID);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.dataroom.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const r = await archiveDataroom(SOCIETY_ID, DATAROOM_ID);
    expect(r).toEqual({ success: false, error: "Erreur lors de l'archivage" });
  });
});

// ─── addDocumentToDataroom ────────────────────────────────────────────────────

describe("addDocumentToDataroom", () => {
  beforeEach(() => {
    prismaMock.dataroom.findFirst.mockResolvedValue(buildDataroom() as never);
    prismaMock.document.findFirst.mockResolvedValue({
      id: DOC_ID,
      fileName: "bail.pdf",
      societyId: SOCIETY_ID,
    } as never);
    prismaMock.dataroomDocument.count.mockResolvedValue(0);
    prismaMock.dataroomDocument.upsert.mockResolvedValue({ id: "dd-1" } as never);
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await addDocumentToDataroom(SOCIETY_ID, DATAROOM_ID, DOC_ID);
    expect(r.success).toBe(false);
  });

  it("erreur si document introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.document.findFirst.mockResolvedValue(null);
    const r = await addDocumentToDataroom(SOCIETY_ID, DATAROOM_ID, DOC_ID);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Document introuvable");
  });

  it("ajoute le document avec sortOrder basé sur le count", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.dataroomDocument.count.mockResolvedValue(3);

    const r = await addDocumentToDataroom(SOCIETY_ID, DATAROOM_ID, DOC_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.dataroomDocument.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ sortOrder: 3 }),
      })
    );
  });
});

// ─── removeDocumentFromDataroom ───────────────────────────────────────────────

describe("removeDocumentFromDataroom", () => {
  beforeEach(() => {
    prismaMock.dataroom.findFirst.mockResolvedValue(buildDataroom() as never);
    prismaMock.dataroomDocument.deleteMany.mockResolvedValue({ count: 1 } as never);
  });

  it("retire le document avec succès", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await removeDocumentFromDataroom(SOCIETY_ID, DATAROOM_ID, DOC_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.dataroomDocument.deleteMany).toHaveBeenCalledWith({
      where: { dataroomId: DATAROOM_ID, documentId: DOC_ID },
    });
  });

  it("retourne une erreur si non authentifié (ligne 309)", async () => {
    mockUnauthenticated();
    const r = await removeDocumentFromDataroom(SOCIETY_ID, DATAROOM_ID, DOC_ID);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/authentif/i);
  });

  it("retourne une erreur si rôle insuffisant (ligne 310)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await removeDocumentFromDataroom(SOCIETY_ID, DATAROOM_ID, DOC_ID);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue (lignes 311-312)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.dataroom.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const r = await removeDocumentFromDataroom(SOCIETY_ID, DATAROOM_ID, DOC_ID);
    expect(r).toEqual({ success: false, error: "Erreur lors de la suppression" });
  });
});

// ─── verifyDataroomPassword ───────────────────────────────────────────────────

describe("verifyDataroomPassword", () => {
  it("retourne succès si la dataroom n'a pas de mot de passe", async () => {
    prismaMock.dataroom.findUnique.mockResolvedValue({
      id: DATAROOM_ID,
      status: "ACTIF",
      expiresAt: null,
      password: null,
    } as never);

    const r = await verifyDataroomPassword(SHARE_TOKEN, "n'importe quoi");
    expect(r.success).toBe(true);
  });

  it("erreur si dataroom inactive ou inexistante", async () => {
    prismaMock.dataroom.findUnique.mockResolvedValue(null);
    const r = await verifyDataroomPassword(SHARE_TOKEN, "secret");
    expect(r.success).toBe(false);
    expect(r.error).toContain("introuvable");
  });

  it("erreur si la dataroom est expirée", async () => {
    prismaMock.dataroom.findUnique.mockResolvedValue({
      id: DATAROOM_ID,
      status: "ACTIF",
      expiresAt: new Date("2000-01-01"),
      password: null,
    } as never);

    const r = await verifyDataroomPassword(SHARE_TOKEN, "secret");
    expect(r.success).toBe(false);
    expect(r.error).toContain("expiré");
  });

  it("erreur si mot de passe incorrect", async () => {
    // Simuler un hash bcrypt d'un mot de passe différent
    const bcrypt = await import("bcryptjs");
    const correctHash = await bcrypt.hash("correct", 10);

    prismaMock.dataroom.findUnique.mockResolvedValue({
      id: DATAROOM_ID,
      status: "ACTIF",
      expiresAt: null,
      password: correctHash,
    } as never);

    const r = await verifyDataroomPassword(SHARE_TOKEN, "mauvais");
    expect(r.success).toBe(false);
    expect(r.error).toBe("Mot de passe incorrect");
  });

  it("retourne succès si mot de passe correct", async () => {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("secret123", 10);

    prismaMock.dataroom.findUnique.mockResolvedValue({
      id: DATAROOM_ID,
      status: "ACTIF",
      expiresAt: null,
      password: hash,
    } as never);

    const r = await verifyDataroomPassword(SHARE_TOKEN, "secret123");
    expect(r.success).toBe(true);
  });

  it("retourne une erreur générique si la BDD échoue (lignes 288-289)", async () => {
    prismaMock.dataroom.findUnique.mockRejectedValue(new Error("DB connection lost"));
    const r = await verifyDataroomPassword(SHARE_TOKEN, "secret");
    expect(r).toEqual({ success: false, error: "Erreur lors de la vérification" });
  });
});

// ─── reorderDocument ─────────────────────────────────────────────────────────

describe("reorderDocument", () => {
  const docs = [
    { id: "dd-1", documentId: "doc-a", sortOrder: 0 },
    { id: "dd-2", documentId: "doc-b", sortOrder: 1 },
    { id: "dd-3", documentId: "doc-c", sortOrder: 2 },
  ];

  beforeEach(() => {
    prismaMock.dataroom.findFirst.mockResolvedValue(buildDataroom() as never);
    prismaMock.dataroomDocument.findMany.mockResolvedValue(docs as never);
    prismaMock.$transaction.mockResolvedValue([] as never);
    prismaMock.dataroomDocument.update.mockResolvedValue({} as never);
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await reorderDocument(SOCIETY_ID, DATAROOM_ID, "doc-b", "up");
    expect(r.success).toBe(false);
  });

  it("ne fait rien si le document est déjà en première position et on monte", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await reorderDocument(SOCIETY_ID, DATAROOM_ID, "doc-a", "up");
    expect(r.success).toBe(true);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("swap les sortOrder lors d'un déplacement vers le haut", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await reorderDocument(SOCIETY_ID, DATAROOM_ID, "doc-b", "up");
    expect(r.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it("swap les sortOrder lors d'un déplacement vers le bas", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await reorderDocument(SOCIETY_ID, DATAROOM_ID, "doc-b", "down");
    expect(r.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it("retourne une erreur si rôle insuffisant", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await reorderDocument(SOCIETY_ID, DATAROOM_ID, "doc-b", "up");
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.dataroom.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const r = await reorderDocument(SOCIETY_ID, DATAROOM_ID, "doc-b", "up");
    expect(r).toEqual({ success: false, error: "Erreur lors de la réorganisation" });
  });
});

// ─── getDatarooms ─────────────────────────────────────────────────────────────

describe("getDatarooms", () => {
  it("retourne [] si non authentifié", async () => {
    mockUnauthenticated();
    const r = await getDatarooms(SOCIETY_ID);
    expect(r).toEqual([]);
  });

  it("retourne la liste des datarooms", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.dataroom.findMany.mockResolvedValue([buildDataroom()] as never);
    const r = await getDatarooms(SOCIETY_ID);
    expect(r).toHaveLength(1);
  });
});

// ─── getDataroom ──────────────────────────────────────────────────────────────

describe("getDataroom", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated();
    const r = await getDataroom(SOCIETY_ID, DATAROOM_ID);
    expect(r).toBeNull();
  });

  it("retourne la dataroom par son ID", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.dataroom.findFirst.mockResolvedValue(buildDataroom() as never);
    const r = await getDataroom(SOCIETY_ID, DATAROOM_ID);
    expect(r).not.toBeNull();
    expect(r?.id).toBe(DATAROOM_ID);
  });
});

// ─── getDataroomByToken ───────────────────────────────────────────────────────

describe("getDataroomByToken", () => {
  it("retourne null si la dataroom est introuvable", async () => {
    prismaMock.dataroom.findUnique.mockResolvedValue(null);
    const r = await getDataroomByToken(SHARE_TOKEN);
    expect(r).toBeNull();
  });

  it("retourne null si la dataroom n'est pas active", async () => {
    prismaMock.dataroom.findUnique.mockResolvedValue(
      buildDataroom({ status: "ARCHIVE" }) as never
    );
    const r = await getDataroomByToken(SHARE_TOKEN);
    expect(r).toBeNull();
  });

  it("retourne la dataroom et incrémente le compteur d'accès", async () => {
    prismaMock.dataroom.findUnique.mockResolvedValue(
      buildDataroom({ status: "ACTIF" }) as never
    );
    prismaMock.dataroom.update.mockResolvedValue(buildDataroom() as never);
    prismaMock.dataroomAccess.create.mockResolvedValue({} as never);

    const r = await getDataroomByToken(SHARE_TOKEN);
    expect(r).not.toBeNull();
    expect(prismaMock.dataroom.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { accessCount: { increment: 1 } } })
    );
    expect(prismaMock.dataroomAccess.create).toHaveBeenCalled();
  });
});

// ─── getDataroomsForDocument ──────────────────────────────────────────────────

describe("getDataroomsForDocument", () => {
  it("retourne [] si non authentifié", async () => {
    mockUnauthenticated();
    const r = await getDataroomsForDocument(SOCIETY_ID);
    expect(r).toEqual([]);
  });

  it("retourne les datarooms actives", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.dataroom.findMany.mockResolvedValue([
      { id: DATAROOM_ID, name: "Vente", status: "ACTIF" },
    ] as never);
    const r = await getDataroomsForDocument(SOCIETY_ID);
    expect(r).toHaveLength(1);
  });
});

// ─── getDataroomMeta ──────────────────────────────────────────────────────────

describe("getDataroomMeta", () => {
  it("retourne null si dataroom introuvable", async () => {
    prismaMock.dataroom.findUnique.mockResolvedValue(null);
    const r = await getDataroomMeta(SHARE_TOKEN);
    expect(r).toBeNull();
  });

  it("retourne null si dataroom non active", async () => {
    prismaMock.dataroom.findUnique.mockResolvedValue({
      name: "Test", status: "ARCHIVE", expiresAt: null, password: null,
      description: null, purpose: null, society: { name: "Soc", logoUrl: null },
    } as never);
    const r = await getDataroomMeta(SHARE_TOKEN);
    expect(r).toBeNull();
  });

  it("retourne les métadonnées d'une dataroom active sans mot de passe", async () => {
    prismaMock.dataroom.findUnique.mockResolvedValue({
      name: "Dossier Vente", status: "ACTIF", expiresAt: null, password: null,
      description: "Desc", purpose: "VENTE",
      society: { name: "Ma Société", logoUrl: null },
    } as never);
    const r = await getDataroomMeta(SHARE_TOKEN);
    expect(r).not.toBeNull();
    expect(r?.name).toBe("Dossier Vente");
    expect(r?.hasPassword).toBe(false);
  });
});
