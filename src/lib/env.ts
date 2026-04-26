import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET doit contenir au moins 32 caractères"),
  AUTH_URL: z.string().url(),
  ENCRYPTION_KEY: z.string().min(32, "ENCRYPTION_KEY doit contenir au moins 32 caractères (base64 de 256 bits)"),
  RESEND_API_KEY: z.string().min(1),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_FROM: z.string().email(),
  CRON_SECRET: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  LOAN_PARSE_PDF_DEBUG: z.enum(["0", "1"]).optional(),
  POWENS_DOMAIN: z.string().trim().optional(),
  POWENS_CLIENT_ID: z.string().trim().optional(),
  POWENS_CLIENT_SECRET: z.string().trim().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER_MONTHLY: z.string().optional(),
  STRIPE_PRICE_STARTER_YEARLY: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_YEARLY: z.string().optional(),
  STRIPE_PRICE_ENTERPRISE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ENTERPRISE_YEARLY: z.string().optional(),
  BRAINTRUST_API_KEY: z.string().optional(),
  BRAINTRUST_PROJECT_ID: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  NEXT_PUBLIC_ZENDESK_KEY: z.string().optional(),
  SENTRY_DSN: z.preprocess(val => (val === "" ? undefined : val), z.string().url().optional()),
  SENTRY_TRACES_SAMPLE_RATE: z.preprocess(
    val => (val === "" ? undefined : val),
    z.coerce.number().min(0).max(1).optional()
  ),
  // Facturation électronique — PISTE OAuth2 (commun B2G et B2B)
  PISTE_CLIENT_ID: z.string().optional(),
  PISTE_CLIENT_SECRET: z.string().optional(),
  PISTE_ENV: z.enum(["sandbox", "production"]).optional(), // contrôle le endpoint OAuth uniquement
  CHORUS_PRO_ENV: z.enum(["sandbox", "production"]).optional(), // contrôle le endpoint API Chorus Pro (défaut: sandbox)

  // Chorus Pro — Facturation B2G (entreprise → secteur public via PISTE)
  // Créer un compte technique sur portail.chorus-pro.gouv.fr → Espace EDI & API
  CHORUS_PRO_TECH_ACCOUNT: z.string().optional(), // ex. "TECH_1_xxxxx@cpro.fr"
  CHORUS_PRO_TECH_PASSWORD: z.string().optional(),
  CHORUS_PRO_TECH_USER_ID: z.string().optional(), // ID numérique interne Chorus Pro

  // Plateforme Agréée (PA) — Facturation B2B (norme AFNOR XP Z12-013, réforme sept. 2026)
  // L'accès à une PA se fait par contrat direct (sans PISTE) — auth propre à la PA
  PA_API_BASE_URL: z.preprocess(val => (val === "" ? undefined : val), z.string().url().optional()),
  PA_API_KEY: z.string().optional(),            // Clé API ou Bearer token fourni par la PA
  PA_AUTH_TOKEN_URL: z.preprocess(val => (val === "" ? undefined : val), z.string().url().optional()), // URL token OAuth2 PA (si la PA utilise OAuth2)
  PA_AUTH_CLIENT_ID: z.string().optional(),     // Client ID OAuth2 PA
  PA_AUTH_CLIENT_SECRET: z.string().optional(), // Client Secret OAuth2 PA
  // Model B — MyGestia en tant que Solution Compatible (SC) / mandataire de transmission
  // MyGestia signe UN contrat avec la PA qui couvre toutes les sociétés clientes.
  // PA_MANDATAIRE_SIRET = SIRET de MTG Holding (l'entité légale MyGestia enregistrée auprès de la PA)
  PA_MANDATAIRE_SIRET: z.string().optional(),   // SIRET MyGestia enregistré comme SC auprès de la PA

  // OAuth 2.1 Authorization Code — SUPER PDP (un token par société cliente)
  // Chaque société connecte son compte SUPER PDP à MyGestia via ce flow.
  // Endpoint d'autorisation : https://api.superpdp.tech/oauth2/authorize
  // Token endpoint réutilise PA_AUTH_TOKEN_URL : https://api.superpdp.tech/oauth2/token
  PA_OAUTH_AUTHORIZE_URL: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().url().optional()
  ), // ex: https://api.superpdp.tech/oauth2/authorize

  // GoCardless Open Banking PSD2
  GOCARDLESS_SECRET_ID: z.string().optional(),
  GOCARDLESS_SECRET_KEY: z.string().optional(),
  // GoCardless SEPA Payments
  GOCARDLESS_PAYMENTS_KEY: z.string().optional(),
  GOCARDLESS_PAYMENTS_ENV: z.enum(["live", "sandbox"]).optional(),
  GOCARDLESS_PAYMENTS_CREDITOR_ID: z.string().optional(),
  GOCARDLESS_PAYMENTS_WEBHOOK_SECRET: z.string().optional(),

  // Qonto
  QONTO_CLIENT_ID: z.string().optional(),
  QONTO_CLIENT_SECRET: z.string().optional(),

  // DocuSign (ENTERPRISE)
  DOCUSIGN_API_KEY: z.string().optional(),
  DOCUSIGN_ACCOUNT_ID: z.string().optional(),
  DOCUSIGN_USER_ID: z.string().optional(),
  DOCUSIGN_PRIVATE_KEY: z.string().optional(), // RSA en base64
  DOCUSIGN_BASE_URL: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().url().optional()
  ),
  DOCUSIGN_AUTH_URL: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().url().optional()
  ),
  DOCUSIGN_WEBHOOK_SECRET: z.string().optional(),

  // INSEE
  INSEE_API_KEY: z.string().optional(),
  INSEE_API_SECRET: z.string().optional(),

  // Supabase Storage
  SUPABASE_STORAGE_BUCKET: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),

  // Contact
  EMAIL_CONTACT: z.string().email().optional(),
});

const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.argv.some((a) => a === "build" || a.endsWith("/next") || a.includes("next build"));

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => "  - " + i.path.join(".") + ": " + i.message)
      .join(", ");
    console.error("[env] Variables invalides: " + issues);
    if (process.env.NODE_ENV === "production" && !isBuildPhase) {
      throw new Error("Variables invalides — demarrage annule");
    }
  }
  return (result.data ?? {}) as z.infer<typeof envSchema> & {
    POWENS_DOMAIN: string;
    POWENS_CLIENT_ID: string;
    POWENS_CLIENT_SECRET: string;
  };
}

export const env = validateEnv();
