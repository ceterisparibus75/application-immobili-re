import * as Sentry from "@sentry/nextjs";

/**
 * Loggue une erreur non bloquante : ajoute un breadcrumb Sentry et un
 * console.warn pour rester visible en dev sans interrompre le flux.
 * Usage : `} catch (e) { logNonBlocking("invoice.logo.fetch", e); }`
 */
export function logNonBlocking(label: string, error: unknown): void {
  try {
    Sentry.addBreadcrumb({
      category: "non-blocking",
      level: "warning",
      message: label,
      data: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
  } catch {
    // Sentry indisponible — on continue.
  }
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[non-blocking:${label}]`, error);
  }
}
