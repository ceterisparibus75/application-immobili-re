// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";

const {
  revalidatePath,
  createAuditLog,
  checkSignatureFeature,
  createEnvelope,
  getEmbeddedSigningUrl,
  voidEnvelope,
  getEnvelopeStatus,
} = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  checkSignatureFeature: vi.fn(),
  createEnvelope: vi.fn(),
  getEmbeddedSigningUrl: vi.fn(),
  voidEnvelope: vi.fn().mockResolvedValue(undefined),
  getEnvelopeStatus: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("crypto", () => ({ randomUUID: vi.fn(() => "client-user-1") }));
vi.mock("@/lib/audit", () => ({ createAuditLog }));
vi.mock("@/lib/plan-limits", () => ({ checkSignatureFeature }));
vi.mock("@/lib/docusign", () => ({
  createEnvelope,
  getEmbeddedSigningUrl,
  voidEnvelope,
  getEnvelopeStatus,
}));

import {
  cancelSignatureRequest,
  createSignatureRequest,
  createSignatureRequestFromUrl,
  getEmbeddedSigningUrlForRequest,
  getSignatureRequests,
  syncSignatureStatus,
} from "./signature";

describe("signature actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkSignatureFeature.mockResolvedValue({ allowed: true });
  });

  describe("createSignatureRequest", () => {
    it("retourne une erreur si non authentifié", async () => {
      mockUnauthenticated();

      const result = await createSignatureRequest("society-1", {
        documentType: "BAIL",
        documentName: "Bail principal",
        documentBase64: "ZmFrZQ==",
        signerEmail: "alice@example.com",
        signerName: "Alice Durand",
      });

      expect(result).toEqual({ success: false, error: "Non authentifie" });
    });

    it("retourne le message de limitation de plan si la signature n'est pas autorisée", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      checkSignatureFeature.mockResolvedValue({
        allowed: false,
        message: "Fonctionnalité réservée au plan Enterprise",
      });

      const result = await createSignatureRequest("society-1", {
        documentType: "BAIL",
        documentName: "Bail principal",
        documentBase64: "ZmFrZQ==",
        signerEmail: "alice@example.com",
        signerName: "Alice Durand",
      });

      expect(result).toEqual({
        success: false,
        error: "Fonctionnalité réservée au plan Enterprise",
      });
      expect(createEnvelope).not.toHaveBeenCalled();
    });

    it("crée une demande embarquée, persiste l'enveloppe et retourne l'URL de signature", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      createEnvelope.mockResolvedValue("env-1");
      getEmbeddedSigningUrl.mockResolvedValue("https://sign.test/url");
      prismaMock.signatureRequest.create.mockResolvedValue({
        id: "sig-1",
      } as never);

      const result = await createSignatureRequest("society-1", {
        documentType: "BAIL",
        documentName: "Bail principal",
        documentBase64: "ZmFrZQ==",
        signerEmail: "alice@example.com",
        signerName: "Alice Durand",
        subject: "Merci de signer",
        embedded: true,
        returnUrl: "https://app.test/retour",
      });

      expect(result).toEqual({
        success: true,
        data: {
          id: "sig-1",
          signingUrl: "https://sign.test/url",
        },
      });
      expect(createEnvelope).toHaveBeenCalledWith({
        subject: "Merci de signer",
        message: undefined,
        documents: [{ contentBase64: "ZmFrZQ==", name: "Bail principal" }],
        signers: [{ email: "alice@example.com", name: "Alice Durand", clientUserId: "client-user-1" }],
      });
      expect(prismaMock.signatureRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          societyId: "society-1",
          envelopeId: "env-1",
          signerClientId: "client-user-1",
          signerEmail: "alice@example.com",
          signerName: "Alice Durand",
        }),
      });
      expect(getEmbeddedSigningUrl).toHaveBeenCalledWith(
        "env-1",
        { email: "alice@example.com", name: "Alice Durand", clientUserId: "client-user-1" },
        "https://app.test/retour"
      );
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          societyId: "society-1",
          userId: "user-1",
          action: "CREATE",
          entity: "SignatureRequest",
          entityId: "sig-1",
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/baux");
      expect(revalidatePath).toHaveBeenCalledWith("/documents");
    });
  });

  describe("createSignatureRequestFromUrl", () => {
    it("crée une demande depuis une URL distante et persiste l'enveloppe", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      });
      vi.stubGlobal("fetch", fetchMock);

      createEnvelope.mockResolvedValue("env-url-1");
      prismaMock.signatureRequest.create.mockResolvedValue({ id: "sig-url-1" } as never);

      const result = await createSignatureRequestFromUrl("society-1", {
        documentUrl: "https://storage.test/bail.pdf",
        documentName: "Bail.pdf",
        documentType: "BAIL",
        signerEmail: "bob@example.com",
        signerName: "Bob Dupont",
        leaseId: "lease-1",
      });

      expect(result).toEqual({ success: true, data: { id: "sig-url-1" } });
      expect(fetchMock).toHaveBeenCalledWith("https://storage.test/bail.pdf");
      expect(createEnvelope).toHaveBeenCalledWith(
        expect.objectContaining({ signers: [{ email: "bob@example.com", name: "Bob Dupont" }] })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/baux/lease-1");

      vi.unstubAllGlobals();
    });

    it("retourne une erreur si le document est inaccessible", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

      const result = await createSignatureRequestFromUrl("society-1", {
        documentUrl: "https://storage.test/missing.pdf",
        documentName: "Missing.pdf",
        documentType: "BAIL",
        signerEmail: "bob@example.com",
        signerName: "Bob Dupont",
      });

      expect(result).toEqual({ success: false, error: "Impossible de recuperer le document" });
      vi.unstubAllGlobals();
    });
  });

  describe("getSignatureRequests", () => {
    it("retourne null si l'utilisateur n'a pas accès à la société", async () => {
      mockUnauthenticated();

      const result = await getSignatureRequests("society-1");

      expect(result).toBeNull();
    });

    it("retourne les demandes filtrées par statut", async () => {
      mockAuthSession(UserRole.LECTURE);
      prismaMock.signatureRequest.findMany.mockResolvedValue([
        { id: "sig-1", status: "SENT" },
      ] as never);

      const result = await getSignatureRequests("society-1", { status: "SENT" });

      expect(result).toHaveLength(1);
      expect(prismaMock.signatureRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: "SENT" }) })
      );
    });
  });

  describe("getEmbeddedSigningUrlForRequest", () => {
    it("retourne une erreur si la demande n'a pas de signerClientId", async () => {
      mockAuthSession(UserRole.LECTURE);
      prismaMock.signatureRequest.findFirst.mockResolvedValue({
        id: "sig-1",
        societyId: "society-1",
        signerClientId: null,
        status: "SENT",
      } as never);

      const result = await getEmbeddedSigningUrlForRequest(
        "society-1",
        "sig-1",
        "https://app.test/retour"
      );

      expect(result).toEqual({
        success: false,
        error: "Signature embarquee non disponible pour cette demande",
      });
      expect(getEmbeddedSigningUrl).not.toHaveBeenCalled();
    });

    it("retourne une erreur si la demande est introuvable", async () => {
      mockAuthSession(UserRole.LECTURE);
      prismaMock.signatureRequest.findFirst.mockResolvedValue(null);

      const result = await getEmbeddedSigningUrlForRequest("society-1", "sig-404", "https://app.test/retour");
      expect(result).toEqual({ success: false, error: "Demande introuvable" });
    });

    it("retourne une erreur si le document a déjà été signé", async () => {
      mockAuthSession(UserRole.LECTURE);
      prismaMock.signatureRequest.findFirst.mockResolvedValue({
        id: "sig-1",
        societyId: "society-1",
        signerClientId: "client-1",
        status: "COMPLETED",
        envelopeId: "env-1",
        signerEmail: "alice@example.com",
        signerName: "Alice",
      } as never);

      const result = await getEmbeddedSigningUrlForRequest("society-1", "sig-1", "https://app.test/retour");
      expect(result).toEqual({ success: false, error: "Ce document a deja ete signe" });
    });

    it("retourne l'URL de signature si la demande est valide", async () => {
      mockAuthSession(UserRole.LECTURE);
      prismaMock.signatureRequest.findFirst.mockResolvedValue({
        id: "sig-1",
        societyId: "society-1",
        signerClientId: "client-1",
        status: "SENT",
        envelopeId: "env-1",
        signerEmail: "alice@example.com",
        signerName: "Alice",
      } as never);
      getEmbeddedSigningUrl.mockResolvedValue("https://sign.test/embedded");

      const result = await getEmbeddedSigningUrlForRequest("society-1", "sig-1", "https://app.test/retour");
      expect(result).toEqual({ success: true, data: { signingUrl: "https://sign.test/embedded" } });
    });
  });

  describe("cancelSignatureRequest", () => {
    it("retourne une erreur si la demande est introuvable", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      prismaMock.signatureRequest.findFirst.mockResolvedValue(null);

      const result = await cancelSignatureRequest("society-1", "sig-404");
      expect(result).toEqual({ success: false, error: "Demande introuvable" });
    });

    it("retourne une erreur si la demande est déjà finalisée", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      prismaMock.signatureRequest.findFirst.mockResolvedValue({
        id: "sig-1",
        societyId: "society-1",
        envelopeId: "env-1",
        status: "COMPLETED",
      } as never);

      const result = await cancelSignatureRequest("society-1", "sig-1");
      expect(result).toEqual({ success: false, error: "Cette demande ne peut plus etre annulee" });
    });

    it("annule une demande active et la marque VOIDED", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      prismaMock.signatureRequest.findFirst.mockResolvedValue({
        id: "sig-1",
        societyId: "society-1",
        envelopeId: "env-1",
        status: "SENT",
      } as never);

      const result = await cancelSignatureRequest("society-1", "sig-1", "Demande annulée");

      expect(result).toEqual({ success: true });
      expect(voidEnvelope).toHaveBeenCalledWith("env-1", "Demande annulée");
      expect(prismaMock.signatureRequest.update).toHaveBeenCalledWith({
        where: { id: "sig-1" },
        data: { status: "VOIDED", voidedAt: expect.any(Date), voidReason: "Demande annulée" },
      });
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "UPDATE",
          entity: "SignatureRequest",
          entityId: "sig-1",
          details: { action: "voided", reason: "Demande annulée" },
        })
      );
    });
  });

  describe("syncSignatureStatus", () => {
    it("synchronise le statut completed et renseigne signedAt", async () => {
      mockAuthSession(UserRole.LECTURE);
      prismaMock.signatureRequest.findFirst.mockResolvedValue({
        id: "sig-1",
        societyId: "society-1",
        envelopeId: "env-1",
        status: "SENT",
      } as never);
      getEnvelopeStatus.mockResolvedValue({
        status: "completed",
        completedDateTime: "2026-04-20T10:30:00.000Z",
      });

      const result = await syncSignatureStatus("society-1", "sig-1");

      expect(result).toEqual({
        success: true,
        data: { status: "COMPLETED" },
      });
      expect(prismaMock.signatureRequest.update).toHaveBeenCalledWith({
        where: { id: "sig-1" },
        data: {
          status: "COMPLETED",
          signedAt: new Date("2026-04-20T10:30:00.000Z"),
        },
      });
    });

    it("retourne une erreur générique si la BDD échoue", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      prismaMock.signatureRequest.findFirst.mockRejectedValue(new Error("DB error"));
      const result = await syncSignatureStatus("society-1", "sig-1");
      expect(result).toEqual({ success: false, error: "Erreur lors de la synchronisation" });
    });
  });

  describe("cancelSignatureRequest — erreurs", () => {
    it("retourne une erreur si rôle insuffisant", async () => {
      mockAuthSession(UserRole.LECTURE);
      const result = await cancelSignatureRequest("society-1", "sig-1");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/insuffisantes|refus/i);
    });

    it("retourne une erreur générique si la BDD échoue", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      prismaMock.signatureRequest.findFirst.mockRejectedValue(new Error("DB connection lost"));
      const result = await cancelSignatureRequest("society-1", "sig-1");
      expect(result).toEqual({ success: false, error: "Erreur lors de l'annulation" });
    });
  });

  describe("createSignatureRequest — branches manquantes", () => {
    it("retourne une erreur Zod si l'input est invalide (ligne 38)", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await createSignatureRequest("society-1", {} as any);
      expect(result.success).toBe(false);
    });

    it("retourne succes sans signingUrl si non-embarque (ligne 95)", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      createEnvelope.mockResolvedValue("env-notemb");
      prismaMock.signatureRequest.create.mockResolvedValue({ id: "sig-notemb" } as never);
      const result = await createSignatureRequest("society-1", {
        documentType: "BAIL",
        documentName: "Bail.pdf",
        documentBase64: "ZmFrZQ==",
        signerEmail: "alice@example.com",
        signerName: "Alice",
      });
      expect(result).toEqual({ success: true, data: { id: "sig-notemb" } });
    });

    it("retourne une erreur si role LECTURE (ligne 98)", async () => {
      mockAuthSession(UserRole.LECTURE);
      const result = await createSignatureRequest("society-1", {
        documentType: "BAIL",
        documentName: "Bail.pdf",
        documentBase64: "ZmFrZQ==",
        signerEmail: "alice@example.com",
        signerName: "Alice",
      });
      expect(result.success).toBe(false);
    });

    it("retourne une erreur generique si la BDD echoue (lignes 99-100)", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      createEnvelope.mockResolvedValue("env-dberr");
      prismaMock.signatureRequest.create.mockRejectedValue(new Error("DB error"));
      const result = await createSignatureRequest("society-1", {
        documentType: "BAIL",
        documentName: "Bail.pdf",
        documentBase64: "ZmFrZQ==",
        signerEmail: "alice@example.com",
        signerName: "Alice",
      });
      expect(result).toEqual({ success: false, error: "Erreur lors de la creation de la demande de signature" });
    });
  });

  describe("createSignatureRequestFromUrl — branches manquantes", () => {
    it("retourne une erreur si plan non autorise (ligne 126)", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      checkSignatureFeature.mockResolvedValue({ allowed: false, message: "Plan insuffisant" });
      const result = await createSignatureRequestFromUrl("society-1", {
        documentUrl: "https://storage.test/doc.pdf",
        documentName: "doc.pdf",
        documentType: "BAIL",
        signerEmail: "alice@example.com",
        signerName: "Alice",
      });
      expect(result).toEqual({ success: false, error: "Plan insuffisant" });
    });

    it("retourne une erreur si non authentifie (ligne 173)", async () => {
      mockUnauthenticated();
      const result = await createSignatureRequestFromUrl("society-1", {
        documentUrl: "https://storage.test/doc.pdf",
        documentName: "doc.pdf",
        documentType: "BAIL",
        signerEmail: "alice@example.com",
        signerName: "Alice",
      });
      expect(result).toEqual({ success: false, error: "Non authentifie" });
    });

    it("retourne une erreur si role LECTURE (ligne 174)", async () => {
      mockAuthSession(UserRole.LECTURE);
      const result = await createSignatureRequestFromUrl("society-1", {
        documentUrl: "https://storage.test/doc.pdf",
        documentName: "doc.pdf",
        documentType: "BAIL",
        signerEmail: "alice@example.com",
        signerName: "Alice",
      });
      expect(result.success).toBe(false);
    });

    it("retourne une erreur generique si la BDD echoue (lignes 175-176)", async () => {
      mockAuthSession(UserRole.GESTIONNAIRE);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      }));
      createEnvelope.mockResolvedValue("env-url-dberr");
      prismaMock.signatureRequest.create.mockRejectedValue(new Error("DB error"));
      const result = await createSignatureRequestFromUrl("society-1", {
        documentUrl: "https://storage.test/doc.pdf",
        documentName: "doc.pdf",
        documentType: "BAIL",
        signerEmail: "alice@example.com",
        signerName: "Alice",
      });
      expect(result).toEqual({ success: false, error: "Erreur lors de la creation de la demande de signature" });
      vi.unstubAllGlobals();
    });
  });

  describe("getEmbeddedSigningUrlForRequest — branches manquantes", () => {
    it("retourne une erreur si non authentifie (ligne 227)", async () => {
      mockUnauthenticated();
      const result = await getEmbeddedSigningUrlForRequest("society-1", "sig-1", "https://app.test/retour");
      expect(result).toEqual({ success: false, error: "Non authentifie" });
    });

    it("retourne une erreur generique si la BDD echoue (lignes 229-230)", async () => {
      mockAuthSession(UserRole.LECTURE);
      prismaMock.signatureRequest.findFirst.mockRejectedValue(new Error("DB error"));
      const result = await getEmbeddedSigningUrlForRequest("society-1", "sig-1", "https://app.test/retour");
      expect(result).toEqual({ success: false, error: "Impossible d'obtenir l'URL de signature" });
    });
  });

  describe("cancelSignatureRequest — non authentifie", () => {
    it("retourne une erreur si non authentifie (ligne 273)", async () => {
      mockUnauthenticated();
      const result = await cancelSignatureRequest("society-1", "sig-1");
      expect(result).toEqual({ success: false, error: "Non authentifie" });
    });
  });

  describe("syncSignatureStatus — branches manquantes", () => {
    it("retourne une erreur si non authentifie (ligne 313)", async () => {
      mockUnauthenticated();
      const result = await syncSignatureStatus("society-1", "sig-1");
      expect(result).toEqual({ success: false, error: "Non authentifie" });
    });

    it("retourne une erreur si pas de membership (ligne 314)", async () => {
      mockAuthSession(UserRole.LECTURE);
      prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
      const result = await syncSignatureStatus("society-1", "sig-1");
      expect(result.success).toBe(false);
    });
  });

  describe("getEmbeddedSigningUrlForRequest — ForbiddenError (ligne 228)", () => {
    it("retourne une erreur si pas de membership (ligne 228)", async () => {
      mockAuthSession(UserRole.LECTURE);
      prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
      const result = await getEmbeddedSigningUrlForRequest("society-1", "sig-1", "https://app.test/retour");
      expect(result.success).toBe(false);
    });
  });

});
