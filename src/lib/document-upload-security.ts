// ── Logos ────────────────────────────────────────────────────────────────────

export const ALLOWED_LOGO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_LOGO_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo

const LOGO_EXTENSIONS_BY_MIME: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

export function validateLogoUploadMetadata(input: {
  fileName: string | null | undefined;
  fileSize: number | null | undefined;
  mimeType: string | null | undefined;
}): { ok: true; mimeType: string } | { ok: false; error: string } {
  const fileName = input.fileName?.trim();
  const mimeType = normalizeDocumentMimeType(input.mimeType);

  if (!fileName) return { ok: false, error: "Nom de fichier manquant" };
  if (!ALLOWED_LOGO_MIME_TYPES.includes(mimeType as (typeof ALLOWED_LOGO_MIME_TYPES)[number])) {
    return { ok: false, error: "Format non supporté pour un logo (JPEG, PNG, WebP uniquement)" };
  }
  const allowedExtensions = LOGO_EXTENSIONS_BY_MIME[mimeType];
  if (!allowedExtensions?.some((ext) => fileName.toLowerCase().endsWith(ext))) {
    return { ok: false, error: "L'extension du fichier ne correspond pas au type déclaré" };
  }
  if (!Number.isSafeInteger(input.fileSize) || (input.fileSize ?? 0) <= 0) {
    return { ok: false, error: "Taille de fichier invalide" };
  }
  if ((input.fileSize ?? 0) > MAX_LOGO_UPLOAD_SIZE_BYTES) {
    return { ok: false, error: "Logo trop volumineux (max 5 Mo)" };
  }

  return { ok: true, mimeType };
}

// ── Détection de contenu dangereux ───────────────────────────────────────────

/**
 * Détecte HTML/SVG/XML/script en tête de fichier.
 * Utilisé pour refuser les uploads TUS dont le premier chunk est un contenu actif.
 */
export function isDangerousFileContent(bytes: Uint8Array): boolean {
  // Sauter le BOM UTF-8 éventuel avant de comparer
  const offset = startsWithBytes(bytes, [0xef, 0xbb, 0xbf]) ? 3 : 0;
  return (
    startsWithBytes(bytes, [0x3c, 0x21, 0x44, 0x4f], offset) || // <!DO (DOCTYPE)
    startsWithBytes(bytes, [0x3c, 0x21, 0x64, 0x6f], offset) || // <!do
    startsWithBytes(bytes, [0x3c, 0x73, 0x76, 0x67], offset) || // <svg
    startsWithBytes(bytes, [0x3c, 0x53, 0x56, 0x47], offset) || // <SVG
    startsWithBytes(bytes, [0x3c, 0x3f, 0x78, 0x6d], offset) || // <?xm (<?xml)
    startsWithBytes(bytes, [0x3c, 0x68, 0x74, 0x6d], offset) || // <htm
    startsWithBytes(bytes, [0x3c, 0x48, 0x54, 0x4d], offset) || // <HTM
    startsWithBytes(bytes, [0x3c, 0x73, 0x63, 0x72], offset) || // <scr (<script)
    startsWithBytes(bytes, [0x3c, 0x53, 0x43, 0x52], offset)    // <SCR
  );
}

// ── Documents ─────────────────────────────────────────────────────────────────

export const AI_SUPPORTED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  ...AI_SUPPORTED_DOCUMENT_MIME_TYPES,
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const MAX_DOCUMENT_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;

type DocumentMimeType = (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

const EXTENSIONS_BY_MIME_TYPE: Record<DocumentMimeType, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
};

function startsWithBytes(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

export function normalizeDocumentMimeType(mimeType: string | null | undefined): string {
  return (mimeType ?? "").trim().toLowerCase();
}

export function isAllowedDocumentMimeType(mimeType: string | null | undefined): boolean {
  return ALLOWED_DOCUMENT_MIME_TYPES.includes(normalizeDocumentMimeType(mimeType) as DocumentMimeType);
}

export function isAiSupportedDocumentMimeType(mimeType: string | null | undefined): boolean {
  return AI_SUPPORTED_DOCUMENT_MIME_TYPES.includes(normalizeDocumentMimeType(mimeType) as (typeof AI_SUPPORTED_DOCUMENT_MIME_TYPES)[number]);
}

export function hasAllowedDocumentExtension(fileName: string, mimeType: string | null | undefined): boolean {
  const normalizedMimeType = normalizeDocumentMimeType(mimeType) as DocumentMimeType;
  const allowedExtensions = EXTENSIONS_BY_MIME_TYPE[normalizedMimeType];
  if (!allowedExtensions) return false;
  const normalizedName = fileName.trim().toLowerCase();
  return allowedExtensions.some((extension) => normalizedName.endsWith(extension));
}

export function verifyDocumentMagicBytes(bytes: Uint8Array, declaredMimeType: string | null | undefined): boolean {
  const mimeType = normalizeDocumentMimeType(declaredMimeType);
  if (mimeType === "application/pdf") return startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46]);
  if (mimeType === "image/jpeg") return startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
  if (mimeType === "image/png") return startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47]);
  if (mimeType === "image/webp") {
    return startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWithBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8);
  }
  if (mimeType === "application/msword") return startsWithBytes(bytes, [0xd0, 0xcf, 0x11, 0xe0]);
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return (
      startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
      startsWithBytes(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
      startsWithBytes(bytes, [0x50, 0x4b, 0x07, 0x08])
    );
  }
  return false;
}

export function sanitizeDocumentStorageFolder(rawFolder: string | null | undefined): string | null {
  let decoded = rawFolder?.trim() || "general";
  try {
    decoded = decodeURIComponent(decoded);
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }

  const segments = decoded
    .replace(/\0/g, "")
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) return null;
  if (segments.some((segment) => segment === "." || segment === "..")) return null;

  const sanitized = segments
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, "_"))
    .filter(Boolean);

  return sanitized.length > 0 ? sanitized.join("/") : null;
}

export function isDocumentStoragePathForSociety(storagePath: string, societyId: string): boolean {
  const normalized = storagePath.replace(/\\/g, "/");
  const prefix = `documents/${societyId}/`;
  if (!normalized.startsWith(prefix)) return false;
  const segments = normalized.split("/");
  if (segments.length < 4) return false;
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

export function validateDocumentUploadMetadata(input: {
  fileName: string | null | undefined;
  fileSize: number | null | undefined;
  mimeType: string | null | undefined;
  storagePath?: string | null;
  societyId?: string;
}): { ok: true; mimeType: string } | { ok: false; error: string } {
  const fileName = input.fileName?.trim();
  const mimeType = normalizeDocumentMimeType(input.mimeType);

  if (!fileName) return { ok: false, error: "Nom de fichier manquant" };
  if (!isAllowedDocumentMimeType(mimeType)) return { ok: false, error: "Format non supporté (PDF, images, Word)" };
  if (!hasAllowedDocumentExtension(fileName, mimeType)) {
    return { ok: false, error: "L'extension du fichier ne correspond pas au type déclaré" };
  }
  if (!Number.isSafeInteger(input.fileSize) || (input.fileSize ?? 0) <= 0) {
    return { ok: false, error: "Taille de fichier invalide" };
  }
  if ((input.fileSize ?? 0) > MAX_DOCUMENT_UPLOAD_SIZE_BYTES) {
    return { ok: false, error: "Fichier trop volumineux (max 100 Mo)" };
  }
  if (input.storagePath && input.societyId && !isDocumentStoragePathForSociety(input.storagePath, input.societyId)) {
    return { ok: false, error: "Chemin de stockage invalide" };
  }

  return { ok: true, mimeType };
}
