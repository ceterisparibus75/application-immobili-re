import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// En production Vercel (serverless), chaque fonction peut créer sa propre instance.
// On borne le pool à 5 connexions par instance pour ne pas saturer Supabase Pro (max 150 conns).
// DATABASE_URL doit pointer vers le pooler PgBouncer de Supabase (port 6543, ?pgbouncer=true).
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
      max: process.env.NODE_ENV === "production" ? 5 : 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    }),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
