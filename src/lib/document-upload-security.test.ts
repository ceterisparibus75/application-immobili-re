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

  it("retourne false si le type MIME n'est pas dans la liste des extensions (ligne 47)", () => {
    expect(hasAllowedDocumentExtension("file.txt", "text/plain")).toBe(false);
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

  it("retourne false si le buffer est trop court pour les magic bytes (ligne 28)", () => {
    expect(verifyDocumentMagicBytes(new Uint8Array([0x25]), "application/pdf")).toBe(false);
  });

  it("vérifie les magic bytes DOC (ligne 60)", () => {
    expect(verifyDocumentMagicBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), "application/msword")).toBe(true);
    expect(verifyDocumentMagicBytes(new Uint8Array([0x00, 0x00, 0x00, 0x00]), "application/msword")).toBe(false);
  });

  it("vérifie les magic bytes DOCX (lignes 61-62)", () => {
    expect(
      verifyDocumentMagicBytes(
        new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe(true);
    expect(
      verifyDocumentMagicBytes(
        new Uint8Array([0x00, 0x00, 0x00, 0x00]),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe(false);
  });

  it("retourne false pour un type MIME non reconnu (ligne 68)", () => {
    expect(verifyDocumentMagicBytes(new Uint8Array([0x00, 0x01]), "application/unknown")).toBe(false);
  });

  it("neutralise les chemins de dossier dangereux", () => {
    expect(sanitizeDocumentStorageFolder("general/quittances")).toBe("general/quittances");
    expect(sanitizeDocumentStorageFolder("general\\quittances")).toBe("general/quittances");
    expect(sanitizeDocumentStorageFolder("../../secret")).toBeNull();
    expect(sanitizeDocumentStorageFolder("%2e%2e/secret")).toBeNull();
  });

  it("retourne null si le chemin ne contient que des séparateurs (ligne 87)", () => {
    expect(sanitizeDocumentStorageFolder("/")).toBeNull();
  });

  it("retourne null si l'URI est malformée (ligne 77 — catch decodeURIComponent)", () => {
    expect(sanitizeDocumentStorageFolder("%zz")).toBeNull();
  });

  it("impose un chemin de stockage sous la societe active", () => {
    expect(isDocumentStoragePathForSociety("documents/society-1/general/1_bail.pdf", "society-1")).toBe(true);
    expect(isDocumentStoragePathForSociety("documents/society-2/general/1_bail.pdf", "society-1")).toBe(false);
    expect(isDocumentStoragePathForSociety("documents/society-1/../secret/1_bail.pdf", "society-1")).toBe(false);
  });

  it("retourne false si le chemin a moins de 4 segments (ligne 102)", () => {
    expect(isDocumentStoragePathForSociety("documents/society-1/bail.pdf", "society-1")).toBe(false);
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

  it("retourne une erreur si le nom de fichier est absent (ligne 116)", () => {
    expect(
      validateDocumentUploadMetadata({ fileName: null, fileSize: 1024, mimeType: "application/pdf" })
    ).toEqual({ ok: false, error: "Nom de fichier manquant" });
  });

  it("retourne une erreur si le type MIME n'est pas supporté (ligne 117)", () => {
    expect(
      validateDocumentUploadMetadata({ fileName: "file.txt", fileSize: 1024, mimeType: "text/plain" })
    ).toEqual({ ok: false, error: "Format non supporté (PDF, images, Word)" });
  });

  it("retourne une erreur si la taille de fichier est invalide ou nulle (ligne 122)", () => {
    expect(
      validateDocumentUploadMetadata({ fileName: "bail.pdf", fileSize: 0, mimeType: "application/pdf" })
    ).toEqual({ ok: false, error: "Taille de fichier invalide" });
  });

  it("retourne une erreur si le fichier dépasse 100 Mo (ligne 125)", () => {
    expect(
      validateDocumentUploadMetadata({ fileName: "bail.pdf", fileSize: 200 * 1024 * 1024, mimeType: "application/pdf" })
    ).toEqual({ ok: false, error: "Fichier trop volumineux (max 100 Mo)" });
  });
});
