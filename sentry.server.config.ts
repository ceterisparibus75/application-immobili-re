// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production" && Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),

  // Echantillonnage faible côté serveur pour limiter coûts et données collectées.
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),

  enableLogs: false,

  // Ne jamais envoyer de PII (IPs, cookies, corps de requête) à Sentry
  sendDefaultPii: false,

  // Server Actions dont le hash a changé entre deux déploiements lèvent
  // UnrecognizedActionError côté client/server. C'est attendu : un user actif
  // au moment d'un déploiement voit cette erreur tant qu'il n'a pas rechargé.
  // On les filtre pour ne pas polluer Sentry.
  ignoreErrors: [
    /UnrecognizedActionError/i,
    /Server Action ".+" was not found on the server/i,
  ],

  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies;
      delete event.request.data;
      if (event.request.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
    }
    if (event.user) {
      delete event.user.ip_address;
      delete event.user.email;
    }
    return event;
  },
});
