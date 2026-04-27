const DIACRITICS_REGEX = /[\u0300-\u036f]/g;

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(DIACRITICS_REGEX, "");
}

export function sanitizeStorageSegment(value: string, maxLength = 60): string {
  const sanitized = stripDiacritics(value)
    .replace(/\0/g, "")
    .replace(/[\\/]+/g, "_")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, maxLength);

  return sanitized;
}

export function buildStorageFileName(
  parts: Array<string | null | undefined>,
  extension: string,
  fallback = "document"
): string {
  const cleanExtension = extension.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "bin";
  const baseName = parts
    .map((part) => (part ? sanitizeStorageSegment(part) : ""))
    .filter(Boolean)
    .join("_");

  return `${baseName || fallback}.${cleanExtension}`;
}
