import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

// Supabase Storage : best-effort, ne doit pas bloquer la suppression
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockReturnValue({
    storage: {
      from: vi.fn().mockReturnValue({
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    },
  }),
}));

import { updateDocument, deleteDocument, getDocuments } from "./document";
import { createAuditLog } from "@/lib/audit";

const SOCIETY_ID = "society-1";
const DOC_ID = "doc-1";

const buildDocument = (overrides = {}) => ({
  id: DOC_ID,
  societyId: SOCIETY_ID,
  fileName: "bail.pdf",
  fileUrl: "https://example.com/storage/v1/object/documents/soc/bail.pdf",
  category: "bail",
  description: null,
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ─── updateDocument ───────────────────────────────────────────────────────────

describe("updateDocument", () => {
  const validInput = { category: "assurance", description: "Attestation annuelle" };

  beforeEach(() => {
    prismaMock.document.findFirst.mockResolvedValue(buildDocument() as never);
    prismaMock.document.update.mockResolvedValue(buildDocument({ category: "assurance" }) as never);
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await updateDocument(SOCIETY_ID, DOC_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("erreur si role LECTURE (min GESTIONNAIRE requis)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await updateDocument(SOCIETY_ID, DOC_ID, validInput);
    expect(r.success).toBe(false);
  });

  it("erreur si catégorie vide", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await updateDocument(SOCIETY_ID, DOC_ID, { category: "" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Catégorie requise");
  });

  it("erreur si document introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.document.findFirst.mockResolvedValue(null);
    const r = await updateDocument(SOCIETY_ID, DOC_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Document introuvable");
  });

  it("met à jour la catégorie et crée un audit log", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await updateDocument(SOCIETY_ID, DOC_ID, validInput);
    expect(r.success).toBe(true);
    expect(prismaMock.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DOC_ID },
        data: expect.objectContaining({ category: "assurance" }),
      })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE", entity: "Document", entityId: DOC_ID })
    );
  });

  it("remet expiresAt à null si chaîne vide passée", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    await updateDocument(SOCIETY_ID, DOC_ID, { category: "bail", expiresAt: "" });
    const call = prismaMock.document.update.mock.calls[0][0];
    expect(call.data.expiresAt).toBeNull();
  });

  it("retourne une erreur générique si la BDD échoue dans updateDocument", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.document.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const r = await updateDocument(SOCIETY_ID, DOC_ID, { category: "bail" });
    expect(r).toEqual({ success: false, error: "Erreur lors de la mise à jour" });
  });
});

// ─── deleteDocument ───────────────────────────────────────────────────────────

describe("deleteDocument", () => {
  beforeEach(() => {
    prismaMock.document.findFirst.mockResolvedValue(buildDocument() as never);
    prismaMock.document.delete.mockResolvedValue(buildDocument() as never);
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await deleteDocument(SOCIETY_ID, DOC_ID);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("erreur si role LECTURE (min GESTIONNAIRE requis)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await deleteDocument(SOCIETY_ID, DOC_ID);
    expect(r.success).toBe(false);
  });

  it("erreur si document introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.document.findFirst.mockResolvedValue(null);
    const r = await deleteDocument(SOCIETY_ID, DOC_ID);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Document introuvable");
  });

  it("supprime le document en base et crée un audit log", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await deleteDocument(SOCIETY_ID, DOC_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.document.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: DOC_ID } })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE", entity: "Document", entityId: DOC_ID })
    );
  });

  it("ne plante pas si la suppression Supabase échoue (best-effort)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const { createClient } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockReturnValueOnce({
      storage: {
        from: vi.fn().mockReturnValue({
          remove: vi.fn().mockRejectedValue(new Error("Supabase down")),
        }),
      },
    } as never);

    const r = await deleteDocument(SOCIETY_ID, DOC_ID);
    // La suppression Supabase est best-effort : l'action doit quand même réussir
    expect(r.success).toBe(true);
  });

  it("retourne une erreur générique si la BDD échoue dans deleteDocument", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.document.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const r = await deleteDocument(SOCIETY_ID, DOC_ID);
    expect(r).toEqual({ success: false, error: "Erreur lors de la suppression" });
  });
});

// ─── getDocuments ─────────────────────────────────────────────────────────────

describe("getDocuments", () => {
  it("retourne un tableau vide si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getDocuments(SOCIETY_ID);
    expect(result).toEqual([]);
  });

  it("retourne les documents de la société sans filtre", async () => {
    mockAuthSession(UserRole.LECTURE);
    prismaMock.document.findMany.mockResolvedValue([buildDocument()] as never);
    const result = await getDocuments(SOCIETY_ID);
    expect(result).toHaveLength(1);
  });

  it("filtre par buildingId si fourni", async () => {
    mockAuthSession(UserRole.LECTURE);
    prismaMock.document.findMany.mockResolvedValue([]);
    await getDocuments(SOCIETY_ID, { buildingId: "bld-1" });
    expect(prismaMock.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ buildingId: "bld-1" }),
      })
    );
  });

  it("filtre par lotId si fourni", async () => {
    mockAuthSession(UserRole.LECTURE);
    prismaMock.document.findMany.mockResolvedValue([]);
    await getDocuments(SOCIETY_ID, { lotId: "lot-1" });
    expect(prismaMock.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ lotId: "lot-1" }),
      })
    );
  });

  it("filtre par leaseId, tenantId et category si fournis (lignes 41-43)", async () => {
    mockAuthSession(UserRole.LECTURE);
    prismaMock.document.findMany.mockResolvedValue([]);
    await getDocuments(SOCIETY_ID, { leaseId: "lease-1", tenantId: "tenant-1", category: "bail" });
    expect(prismaMock.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ leaseId: "lease-1", tenantId: "tenant-1", category: "bail" }),
      })
    );
  });
});

describe("updateDocument — expiresAt fournie (ligne 80)", () => {
  it("convertit expiresAt en Date si non vide", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.document.findFirst.mockResolvedValue({
      id: DOC_ID, societyId: SOCIETY_ID, fileUrl: "https://example.com/file.pdf",
    } as never);
    prismaMock.document.update.mockResolvedValue({} as never);

    const r = await updateDocument(SOCIETY_ID, DOC_ID, { category: "assurance", expiresAt: "2030-12-31" });
    expect(r.success).toBe(true);
    const call = prismaMock.document.update.mock.calls[0][0];
    expect(call.data.expiresAt).toBeInstanceOf(Date);
  });
});

describe("deleteDocument — fileUrl sans storage/v1/object (ligne 114)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("storagePath null si fileUrl ne contient pas 'storage/v1/object'", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.document.findFirst.mockResolvedValue({
      id: DOC_ID, societyId: SOCIETY_ID, fileUrl: "https://cdn.example.com/file.pdf",
    } as never);
    prismaMock.document.delete.mockResolvedValue({} as never);

    const r = await deleteDocument(SOCIETY_ID, DOC_ID);
    expect(r.success).toBe(true);
    // storagePath = null → createClient n'est pas appelé
    const { createClient } = await import("@supabase/supabase-js");
    expect(vi.mocked(createClient)).not.toHaveBeenCalled();
  });
});
