import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 : la datasource du schema n'accepte plus `url`/`directUrl`.
// L'URL ici sert UNIQUEMENT aux commandes Prisma (migrate, generate).
// On utilise DIRECT_URL en priorité pour contourner le pooler pgbouncer
// (port 6543) qui bloque les advisory locks des migrations Supabase.
// Le runtime PrismaClient utilise indépendamment DATABASE_URL (voir
// src/lib/prisma.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      "postgresql://placeholder:5432/placeholder",
  },
});
