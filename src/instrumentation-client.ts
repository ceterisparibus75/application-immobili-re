// Configuration Sentry côté client (Next.js 15+ : ce fichier est chargé en priorité).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // DSN via env publique — pas de DSN hardcodé.
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Désactivé en dev pour éviter le bruit / la consommation de quota.
  enabled: process.env.NODE_ENV === "production",

  debug: false,

  // Sampling : 10 % en prod, 100 % en dev (sans effet si désactivé).
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // RGPD : ne pas envoyer d'IP / cookies / headers d'authentification.
  // L'application manipule locataires, factures, banque, documents — toute
  // capture PII non maîtrisée crée un risque de conformité.
  sendDefaultPii: false,

  // Session Replay désactivé : capture des entrées utilisateur (clics, saisies,
  // contenu DOM) → incompatible RGPD sans politique de masquage explicite.
  // Réactivable plus tard avec maskAllText: true + maskAllInputs: true.
  integrations: [],

  // Server Action hashes change between deploys — a client loaded on an older
  // build will trigger UnrecognizedActionError on the next interaction until
  // it hard-reloads. Don't report this transient noise.
  ignoreErrors: [
    /UnrecognizedActionError/i,
    /Server Action ".+" was not found on the server/i,
  ],

  // Browser/network interruptions during NextAuth session refresh are non-actionable.
  beforeSend(event, hint) {
    const message =
      hint.originalException instanceof Error
        ? hint.originalException.message
        : event.exception?.values?.[0]?.value ?? event.message;
    const frames = event.exception?.values?.flatMap((exception) => exception.stacktrace?.frames ?? []) ?? [];
    const isNextAuthSessionFetchFailure =
      message === "Failed to fetch" &&
      frames.some((frame) => frame.filename?.includes("next-auth/react"));

    if (isNextAuthSessionFetchFailure) return null;

    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
