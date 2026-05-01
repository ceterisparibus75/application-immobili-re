import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const rows = await prisma.$queryRaw<{ category: string; cnt: bigint }[]>`
    SELECT category, COUNT(*) as cnt FROM "BankTransaction"
    WHERE category IS NOT NULL GROUP BY category ORDER BY cnt DESC
  `;
  for (const r of rows) console.log(`  ${String(r.cnt).padStart(4)} x  ${r.category}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());