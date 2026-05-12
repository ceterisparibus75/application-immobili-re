import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  debug: false,
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: false,

  // Server Action hashes change between deploys — a client loaded on an
  // older build will trigger UnrecognizedActionError on the next interaction
  // until it hard-reloads. Don't report this transient noise.
  ignoreErrors: [
    /UnrecognizedActionError/i,
    /Server Action ".+" was not found on the server/i,
  ],
});
