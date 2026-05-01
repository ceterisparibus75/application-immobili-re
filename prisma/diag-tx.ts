import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const rows = await prisma.$queryRaw<
    { id: string; label: string; amount: number; transactionDate: Date; bankAccountId: string; externalId: string | null; category: string | null; accountName: string }[]
  >`
    SELECT t.id, t.label, t.amount, t."transactionDate", t."bankAccountId", t."externalId", t.category, a."accountName"
    FROM "BankTransaction" t
    JOIN "BankAccount" a ON a.id = t."bankAccountId"
    WHERE t.amount = 940183.86
      AND DATE(t."transactionDate") = '2026-02-17'
    ORDER BY t."createdAt"
  `;

  for (const r of rows) {
    console.log("id=" + r.id);
    console.log("  label=" + r.label);
    console.log("  bankAccountId=" + r.bankAccountId + " (" + r.accountName + ")");
    console.log("  externalId=" + r.externalId);
    console.log("  category=" + r.category);
    console.log();
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());