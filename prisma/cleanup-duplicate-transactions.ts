import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  console.log("Recherche des doublons...");

  // Groupes avec au moins 2 lignes : même compte, même jour, même montant
  // et au moins une ligne sans externalId (import manuel/csv)
  const groups = await prisma.$queryRaw<
    { bankAccountId: string; date: string; amount: number; ids: string[] }[]
  >`
    SELECT
      "bankAccountId",
      DATE("transactionDate") AS date,
      amount,
      array_agg(
        id
        ORDER BY
          CASE WHEN category IS NOT NULL THEN 0 ELSE 1 END ASC,
          CASE WHEN "isReconciled" = true THEN 0 ELSE 1 END ASC,
          CASE WHEN "externalId" IS NOT NULL THEN 0 ELSE 1 END ASC,
          "createdAt" ASC
      ) AS ids
    FROM "BankTransaction"
    GROUP BY "bankAccountId", DATE("transactionDate"), amount
    HAVING COUNT(*) > 1
      AND COUNT(*) FILTER (WHERE "externalId" IS NULL) > 0
  `;

  if (groups.length === 0) {
    console.log("Aucun doublon trouve.");
    return;
  }

  console.log(`${groups.length} groupe(s) de doublons trouves.`);

  let totalDeleted = 0;
  for (const group of groups) {
    const toDelete = group.ids.slice(1);
    console.log(`  ${group.date} | ${group.amount} EUR | garder ${group.ids[0]} | supprimer [${toDelete.join(", ")}]`);
    const { count } = await prisma.bankTransaction.deleteMany({
      where: { id: { in: toDelete }, isReconciled: false },
    });
    totalDeleted += count;
  }

  console.log(`\nTermine. ${totalDeleted} ligne(s) supprimee(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());