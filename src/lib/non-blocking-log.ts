import * as Sentry from "@sentry/nextjs";

/**
 * Loggue une erreur non bloquante : ajoute un breadcrumb Sentry et un
 * console.error visible en dev sans interrompre le flux d'exécution.
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
    console.error(`[non-blocking:${label}]`, error);
  }
}
