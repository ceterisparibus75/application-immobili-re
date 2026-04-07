/**
 * Script de diagnostic : vérifie l'état des propriétaires et sociétés.
 * Usage : npx tsx prisma/check-proprietaire.ts
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
  // 1. Lister les propriétaires
  const proprietaires = await prisma.proprietaire.findMany({
    select: {
      id: true,
      label: true,
      entityType: true,
      firstName: true,
      lastName: true,
      companyName: true,
      userId: true,
      societies: { select: { id: true, name: true, legalForm: true, proprietaireId: true } },
    },
  });

  console.log(`\n=== PROPRIÉTAIRES (${proprietaires.length}) ===`);
  for (const p of proprietaires) {
    console.log(`\n  [${p.id}] ${p.label} (${p.entityType})`);
    console.log(`    Créateur userId: ${p.userId}`);
    console.log(`    Nom: ${p.firstName} ${p.lastName} / Société: ${p.companyName}`);
    console.log(`    Sociétés rattachées: ${p.societies.length}`);
    for (const s of p.societies) {
      console.log(`      - ${s.name} (${s.legalForm}) [${s.id}] proprietaireId=${s.proprietaireId}`);
    }
  }

  // 2. Lister les sociétés sans propriétaire
  const orphanSocieties = await prisma.society.findMany({
    where: { proprietaireId: null },
    select: { id: true, name: true, legalForm: true, ownerId: true },
  });

  console.log(`\n=== SOCIÉTÉS SANS PROPRIÉTAIRE (${orphanSocieties.length}) ===`);
  for (const s of orphanSocieties) {
    console.log(`  - ${s.name} (${s.legalForm}) [${s.id}] ownerId=${s.ownerId}`);
  }

  // 3. Lister tous les UserSociety
  const memberships = await prisma.userSociety.findMany({
    include: {
      user: { select: { email: true, name: true } },
      society: { select: { name: true, proprietaireId: true } },
    },
  });

  console.log(`\n=== MEMBERSHIPS (${memberships.length}) ===`);
  for (const m of memberships) {
    console.log(`  ${m.user.email} → ${m.society.name} (${m.role}) | société.proprietaireId=${m.society.proprietaireId}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
