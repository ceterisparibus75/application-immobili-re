import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const MIGRATIONS: Record<string, string | null> = {
  other_income:   "autres_revenus",   // revenus non catégorisés
  other_expense:  "divers_depense",   // dépenses non catégorisées
  tax:            "taxes",            // taxes & impôts
  finance:        null,               // ambigü → à re-catégoriser
  other_service:  null,               // ambigü → à re-catégoriser
  fees:           null,               // ambigü → à re-catégoriser
};

async function main() {
  for (const [oldCat, newCat] of Object.entries(MIGRATIONS)) {
    const { count } = await prisma.bankTransaction.updateMany({
      where: { category: oldCat },
      data: { category: newCat },
    });
    console.log(`  ${oldCat} → ${newCat ?? "(null)"} : ${count} transaction(s) mise(s) à jour`);
  }
  console.log("\nTerminé.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());