/**
 * Script pour passer un utilisateur en SUPER_ADMIN sur toutes ses sociétés.
 * Usage : npx tsx prisma/set-super-admin.ts maxime.langet@mtggroupe.org
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage : npx tsx prisma/set-super-admin.ts <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, firstName: true, email: true },
  });

  if (!user) {
    console.error(`Utilisateur introuvable : ${email}`);
    process.exit(1);
  }

  console.log(`Utilisateur trouvé : ${user.name ?? user.firstName ?? user.email} (${user.id})`);

  // Mettre à jour toutes les UserSociety existantes en SUPER_ADMIN
  const updated = await prisma.userSociety.updateMany({
    where: { userId: user.id },
    data: { role: "SUPER_ADMIN" },
  });

  console.log(`${updated.count} accès société(s) mis à jour en SUPER_ADMIN`);

  // Lister les sociétés
  const societies = await prisma.userSociety.findMany({
    where: { userId: user.id },
    include: { society: { select: { name: true, legalForm: true } } },
  });

  for (const us of societies) {
    console.log(`  - ${us.society.name} (${us.society.legalForm}) → SUPER_ADMIN`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
