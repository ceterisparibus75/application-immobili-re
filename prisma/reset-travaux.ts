import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.bankTransaction.updateMany({
    where: { category: "travaux" },
    data: { category: null },
  });
  console.log(`Reset ${result.count} transactions (travaux -> null)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());