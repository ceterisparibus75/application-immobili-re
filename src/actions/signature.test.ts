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

  describe("getSignatureRequests", () => {
    it("retourne null si l'utilisateur n'a pas accès à la société", async () => {
      mockUnauthenticated();

      const result = await getSignatureRequests("society-1");

      expect(result).toBeNull();
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
  });

  describe("cancelSignatureRequest", () => {
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
  });
});
