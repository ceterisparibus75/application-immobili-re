import { describe, expect, it } from "vitest";
import {
  hasAllowedDocumentExtension,
  isDocumentStoragePathForSociety,
  sanitizeDocumentStorageFolder,
  validateDocumentUploadMetadata,
  verifyDocumentMagicBytes,
} from "./document-upload-security";

describe("document upload security", () => {
  it("rejette une extension incoherente avec le type MIME declare", () => {
    expect(hasAllowedDocumentExtension("bail.pdf", "application/pdf")).toBe(true);
    expect(hasAllowedDocumentExtension("payload.exe", "application/pdf")).toBe(false);
  });

  it("verifie les signatures binaires des fichiers supportes", () => {
    expect(verifyDocumentMagicBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46]), "application/pdf")).toBe(true);
    expect(verifyDocumentMagicBytes(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]), "application/pdf")).toBe(false);
    expect(
      verifyDocumentMagicBytes(
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
        "image/webp"
      )
    ).toBe(true);
  });

  it("neutralise les chemins de dossier dangereux", () => {
    expect(sanitizeDocumentStorageFolder("general/quittances")).toBe("general/quittances");
    expect(sanitizeDocumentStorageFolder("general\\quittances")).toBe("general/quittances");
    expect(sanitizeDocumentStorageFolder("../../secret")).toBeNull();
    expect(sanitizeDocumentStorageFolder("%2e%2e/secret")).toBeNull();
  });

  it("impose un chemin de stockage sous la societe active", () => {
    expect(isDocumentStoragePathForSociety("documents/society-1/general/1_bail.pdf", "society-1")).toBe(true);
    expect(isDocumentStoragePathForSociety("documents/society-2/general/1_bail.pdf", "society-1")).toBe(false);
    expect(isDocumentStoragePathForSociety("documents/society-1/../secret/1_bail.pdf", "society-1")).toBe(false);
  });

  it("valide les metadonnees minimales d'un document", () => {
    expect(
      validateDocumentUploadMetadata({
        fileName: "bail.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
        storagePath: "documents/society-1/general/1_bail.pdf",
        societyId: "society-1",
      })
    ).toEqual({ ok: true, mimeType: "application/pdf" });

    expect(
      validateDocumentUploadMetadata({
        fileName: "bail.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
        storagePath: "documents/society-2/general/1_bail.pdf",
        societyId: "society-1",
      })
    ).toEqual({ ok: false, error: "Chemin de stockage invalide" });
  });
});
