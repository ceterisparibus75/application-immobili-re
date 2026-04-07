import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url(),
  ENCRYPTION_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().email(),
  CRON_SECRET: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
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
