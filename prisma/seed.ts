import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { seedGlobalChargeCategories } from "./seed-charge-categories";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  console.log("Seeding database...");

  // Créer l'utilisateur admin
  const passwordHash = await hash("Admin123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@gestimmo.fr" },
    update: {},
    create: {
      email: "admin@gestimmo.fr",
      name: "Administrateur",
      firstName: "Super",
      passwordHash,
      isActive: true,
    },
  });

  console.log(`Admin user created: ${admin.email}`);

  // Créer une société de démonstration
  const society = await prisma.society.upsert({
    where: { siret: "12345678901234" },
    update: {},
    create: {
      name: "SCI Démo Patrimoine",
      legalForm: "SCI",
      siret: "12345678901234",
      vatNumber: "FR12345678901",
      addressLine1: "1 rue de la Démonstration",
      city: "Paris",
      postalCode: "75001",
      country: "France",
      taxRegime: "IS",
      vatRegime: "TVA",
      invoicePrefix: "DEMO",
      legalMentions:
        "SCI Démo Patrimoine - 1 rue de la Démonstration, 75001 Paris",
    },
  });

  console.log(`Demo society created: ${society.name}`);

  // Assigner l'admin à la société en tant que SUPER_ADMIN
  await prisma.userSociety.upsert({
    where: {
      userId_societyId: { userId: admin.id, societyId: society.id },
    },
    update: { role: "SUPER_ADMIN" },
    create: {
      userId: admin.id,
      societyId: society.id,
      role: "SUPER_ADMIN",
    },
  });

  console.log(`Admin assigned to ${society.name} as SUPER_ADMIN`);

  // ─── Plan comptable complet SCI ────────────────────────────────────────
  type AccountSeed = { code: string; label: string; type: string; accountType?: string; sensNormal?: string };
  const accounts: AccountSeed[] = [
    // CLASSE 1 — Capitaux
    { code: "101000", label: "Capital social", type: "1", accountType: "PASSIF", sensNormal: "CREDIT" },
    { code: "106100", label: "Réserves légales", type: "1", accountType: "PASSIF", sensNormal: "CREDIT" },
    { code: "110000", label: "Report à nouveau (solde créditeur)", type: "1", accountType: "PASSIF", sensNormal: "CREDIT" },
    { code: "119000", label: "Report à nouveau (solde débiteur)", type: "1", accountType: "ACTIF_NEGATIF", sensNormal: "DEBIT" },
    { code: "120000", label: "Résultat de l'exercice (bénéfice)", type: "1", accountType: "PASSIF", sensNormal: "CREDIT" },
    { code: "129000", label: "Résultat de l'exercice (perte)", type: "1", accountType: "ACTIF_NEGATIF", sensNormal: "DEBIT" },
    { code: "164000", label: "Emprunts auprès des établissements de crédit", type: "1", accountType: "PASSIF", sensNormal: "CREDIT" },
    { code: "164100", label: "Emprunt — Lot Lens", type: "1", accountType: "PASSIF", sensNormal: "CREDIT" },
    { code: "164200", label: "Emprunt — Lot Rouen", type: "1", accountType: "PASSIF", sensNormal: "CREDIT" },
    { code: "164300", label: "Emprunt — Lot Paris", type: "1", accountType: "PASSIF", sensNormal: "CREDIT" },
    { code: "168740", label: "Intérêts courus sur emprunts", type: "1", accountType: "PASSIF", sensNormal: "CREDIT" },
    // CLASSE 2 — Immobilisations
    { code: "211000", label: "Terrains", type: "2", accountType: "ACTIF", sensNormal: "DEBIT" },
    { code: "213100", label: "Constructions sur sol propre — Immeubles bâtis", type: "2", accountType: "ACTIF", sensNormal: "DEBIT" },
    { code: "213500", label: "Installations générales et aménagements", type: "2", accountType: "ACTIF", sensNormal: "DEBIT" },
    { code: "215400", label: "Mobilier", type: "2", accountType: "ACTIF", sensNormal: "DEBIT" },
    { code: "231000", label: "Immobilisations en cours", type: "2", accountType: "ACTIF", sensNormal: "DEBIT" },
    { code: "275000", label: "Dépôts et cautionnements versés", type: "2", accountType: "ACTIF", sensNormal: "DEBIT" },
    { code: "280300", label: "Amortissements des constructions", type: "2", accountType: "ACTIF_NEGATIF", sensNormal: "CREDIT" },
    { code: "281540", label: "Amortissements du mobilier", type: "2", accountType: "ACTIF_NEGATIF", sensNormal: "CREDIT" },
    // CLASSE 4 — Comptes de tiers
    { code: "401000", label: "Fournisseurs", type: "4", accountType: "PASSIF", sensNormal: "CREDIT" },
    { code: "401100", label: "Fournisseurs — Travaux", type: "4", accountType: "PASSIF", sensNormal: "CREDIT" },
    { code: "401200", label: "Fournisseurs — Assurances", type: "4", accountType: "PASSIF", sensNormal: "CREDIT" },
    { code: "401300", label: "Fournisseurs — Honoraires", type: "4", accountType: "PASSIF", sensNormal: "CREDIT" },
    { code: "411000", label: "Clients — Locataires", type: "4", accountType: "ACTIF", sensNormal: "DEBIT" },
    { code: "411100", label: "Clients — Lens", type: "4", accountType: "ACTIF", sensNormal: "DEBIT" },
    { code: "411200", label: "Clients — Rouen", type: "4", accountType: "ACTIF", sensNormal: "DEBIT" },
    { code: "411300", label: "Clients — Paris", type: "4", accountType: "ACTIF", sensNormal: "DEBIT" },
    { code: "416000", label: "Clients douteux ou litigieux", type: "4", accountType: "ACTIF", sensNormal: "DEBIT" },
    { code: "421000", label: "Dépôts de garantie reçus des locataires", type: "4", accountType: "PASSIF", sensNormal: "CREDIT" },
    { code: "445660", label: "TVA déductible sur autres biens et services", type: "4", accountType: "ACTIF", sensNormal: "DEBIT" },
    { code: "445710", label: "TVA collectée", type: "4", accountType: "PASSIF", sensNormal: "CREDIT" },
    { code: "455100", label: "Associés — Comptes courants", type: "4", accountType: "PASSIF", sensNormal: "CREDIT" },
    // CLASSE 5 — Comptes financiers
    { code: "512000", label: "Banque — Compte courant principal", type: "5", accountType: "ACTIF", sensNormal: "DEBIT" },
    { code: "512100", label: "Banque — BNP Paribas", type: "5", accountType: "ACTIF", sensNormal: "DEBIT" },
    { code: "512200", label: "Banque — Caisse d'Epargne", type: "5", accountType: "ACTIF", sensNormal: "DEBIT" },
    { code: "512300", label: "Banque — Crédit Agricole", type: "5", accountType: "ACTIF", sensNormal: "DEBIT" },
    { code: "530000", label: "Caisse", type: "5", accountType: "ACTIF", sensNormal: "DEBIT" },
    // CLASSE 6 — Charges
    { code: "606100", label: "Fournitures — eau, énergie", type: "6", accountType: "CHARGE", sensNormal: "DEBIT" },
    { code: "614000", label: "Charges locatives récupérables", type: "6", accountType: "CHARGE", sensNormal: "DEBIT" },
    { code: "615100", label: "Entretien et réparations sur immeubles", type: "6", accountType: "CHARGE", sensNormal: "DEBIT" },
    { code: "615200", label: "Entretien — parties communes", type: "6", accountType: "CHARGE", sensNormal: "DEBIT" },
    { code: "616000", label: "Primes d'assurance — multirisque immeuble", type: "6", accountType: "CHARGE", sensNormal: "DEBIT" },
    { code: "616100", label: "Primes d'assurance — PNO", type: "6", accountType: "CHARGE", sensNormal: "DEBIT" },
    { code: "622600", label: "Honoraires de gestion locative", type: "6", accountType: "CHARGE", sensNormal: "DEBIT" },
    { code: "622700", label: "Honoraires — Notaire et actes", type: "6", accountType: "CHARGE", sensNormal: "DEBIT" },
    { code: "622800", label: "Honoraires — Expertise comptable", type: "6", accountType: "CHARGE", sensNormal: "DEBIT" },
    { code: "626000", label: "Frais postaux et de télécommunications", type: "6", accountType: "CHARGE", sensNormal: "DEBIT" },
    { code: "627000", label: "Services bancaires et assimilés", type: "6", accountType: "CHARGE", sensNormal: "DEBIT" },
    { code: "635100", label: "Taxe foncière", type: "6", accountType: "CHARGE", sensNormal: "DEBIT" },
    { code: "635200", label: "TEOM", type: "6", accountType: "CHARGE", sensNormal: "DEBIT" },
    { code: "635300", label: "CFE", type: "6", accountType: "CHARGE", sensNormal: "DEBIT" },
    { code: "661100", label: "Intérêts des emprunts et dettes", type: "6", accountType: "CHARGE", sensNormal: "DEBIT" },
    { code: "661200", label: "Intérêts des comptes courants associés", type: "6", accountType: "CHARGE", sensNormal: "DEBIT" },
    { code: "681110", label: "Dotations aux amortissements — immeubles", type: "6", accountType: "CHARGE", sensNormal: "DEBIT" },
    { code: "681120", label: "Dotations aux amortissements — mobilier", type: "6", accountType: "CHARGE", sensNormal: "DEBIT" },
    { code: "695000", label: "Impôts sur les bénéfices", type: "6", accountType: "CHARGE", sensNormal: "DEBIT" },
    // CLASSE 7 — Produits
    { code: "706100", label: "Loyers habitation", type: "7", accountType: "PRODUIT", sensNormal: "CREDIT" },
    { code: "706200", label: "Loyers bureaux et commerces", type: "7", accountType: "PRODUIT", sensNormal: "CREDIT" },
    { code: "706300", label: "Loyers parkings et garages", type: "7", accountType: "PRODUIT", sensNormal: "CREDIT" },
    { code: "706900", label: "Loyers divers", type: "7", accountType: "PRODUIT", sensNormal: "CREDIT" },
    { code: "708100", label: "Refacturation de charges locatives", type: "7", accountType: "PRODUIT", sensNormal: "CREDIT" },
    { code: "708200", label: "Provisions pour charges récupérables", type: "7", accountType: "PRODUIT", sensNormal: "CREDIT" },
    { code: "758000", label: "Produits divers de gestion courante", type: "7", accountType: "PRODUIT", sensNormal: "CREDIT" },
    { code: "771000", label: "Produits exceptionnels", type: "7", accountType: "PRODUIT", sensNormal: "CREDIT" },
  ];

  for (const account of accounts) {
    await prisma.accountingAccount.upsert({
      where: { societyId_code: { societyId: society.id, code: account.code } },
      update: { label: account.label, accountType: account.accountType as never, sensNormal: account.sensNormal as never },
      create: {
        societyId: society.id,
        code: account.code,
        label: account.label,
        type: account.type,
        accountType: account.accountType as never,
        sensNormal: account.sensNormal as never,
        isActive: true,
      },
    });
  }

  console.log(`${accounts.length} comptes du plan comptable créés`);

  // ─── Exercice 2026 ───────────────────────────────────────────
  await prisma.fiscalYear.upsert({
    where: { societyId_year: { societyId: society.id, year: 2026 } },
    update: {},
    create: {
      societyId: society.id,
      year: 2026,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      isClosed: false,
    },
  });

  console.log("Exercice 2026 créé");

  // Créer un scénario de relance par défaut
  const scenario = await prisma.reminderScenario.create({
    data: {
      societyId: society.id,
      name: "Scénario standard",
      isActive: true,
      isDefault: true,
      steps: {
        create: [
          {
            level: "RELANCE_1",
            daysAfterDue: 5,
            channel: "email",
            subject: "Rappel de paiement - Loyer",
            bodyTemplate:
              "Madame, Monsieur,\n\nNous vous rappelons que votre loyer d'un montant de {{montant}} € est arrivé à échéance le {{date_echeance}}.\n\nNous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais.\n\nCordialement,\n{{societe_nom}}",
            includeRIB: true,
            mentionPenalties: false,
            requiresValidation: false,
          },
          {
            level: "RELANCE_2",
            daysAfterDue: 15,
            channel: "email",
            subject: "Relance - Loyer impayé",
            bodyTemplate:
              "Madame, Monsieur,\n\nMalgré notre précédent rappel, nous constatons que votre loyer d'un montant de {{montant}} € reste impayé.\n\nNous vous informons que des pénalités de retard pourront être appliquées conformément aux dispositions de votre bail.\n\nMerci de nous contacter dans les plus brefs délais.\n\nCordialement,\n{{societe_nom}}",
            includeRIB: true,
            mentionPenalties: true,
            requiresValidation: false,
          },
          {
            level: "MISE_EN_DEMEURE",
            daysAfterDue: 30,
            channel: "email+courrier",
            subject: "Mise en demeure de payer",
            bodyTemplate:
              "Madame, Monsieur,\n\nPar la présente, nous vous mettons en demeure de régler la somme de {{montant}} €, correspondant à votre loyer impayé.\n\nÀ défaut de règlement sous 8 jours, nous nous réserverons le droit d'engager toute procédure judiciaire.\n\nCordialement,\n{{societe_nom}}",
            includeRIB: true,
            mentionPenalties: true,
            requiresValidation: true,
          },
        ],
      },
    },
  });

  console.log(`Reminder scenario created: ${scenario.name}`);

  // Créer des modèles de courrier
  const templates = [
    {
      name: "revision_notification",
      subject: "Notification de révision de loyer",
      bodyHtml:
        "<p>Madame, Monsieur,</p><p>Conformément aux dispositions de votre bail, nous vous informons que votre loyer sera révisé à compter du {{date_revision}}.</p><p>Nouveau loyer : {{nouveau_loyer}} € HT</p><p>Cordialement,<br/>{{societe_nom}}</p>",
      variables: [
        "date_revision",
        "ancien_loyer",
        "nouveau_loyer",
        "indice_type",
        "indice_base",
        "indice_nouveau",
        "societe_nom",
      ],
    },
    {
      name: "quittance",
      subject: "Quittance de loyer",
      bodyHtml:
        "<p>Madame, Monsieur,</p><p>Veuillez trouver ci-joint votre quittance de loyer pour la période du {{periode_debut}} au {{periode_fin}}.</p><p>Cordialement,<br/>{{societe_nom}}</p>",
      variables: [
        "periode_debut",
        "periode_fin",
        "montant_loyer",
        "montant_charges",
        "montant_total",
        "societe_nom",
      ],
    },
  ];

  for (const tpl of templates) {
    await prisma.letterTemplate.upsert({
      where: {
        societyId_name: { societyId: society.id, name: tpl.name },
      },
      update: {},
      create: {
        societyId: society.id,
        name: tpl.name,
        subject: tpl.subject,
        bodyHtml: tpl.bodyHtml,
        variables: tpl.variables,
      },
    });
  }

  console.log(`${templates.length} letter templates created`);

  // ─── Bibliothèque globale de charges ─────────────────────────────────────
  await seedGlobalChargeCategories(prisma);
  await seedRealisticDemoPortfolio(society.id, admin.id);

  console.log("\nSeed completed!");
  console.log("Login credentials:");
  console.log("  Email: admin@gestimmo.fr");
  console.log("  Password: Admin123!");
}

async function seedRealisticDemoPortfolio(societyId: string, adminUserId: string) {
  console.log("Seeding realistic staging portfolio...");

  let proprietaire = await prisma.proprietaire.findFirst({
    where: { userId: adminUserId, label: "Patrimoine familial Langet" },
  });
  proprietaire ??= await prisma.proprietaire.create({
    data: {
      userId: adminUserId,
      entityType: "PERSONNE_MORALE",
      label: "Patrimoine familial Langet",
      email: "gestion@demo-mygestia.fr",
      companyName: "Patrimoine familial Langet",
      legalForm: "SCI",
      siret: "12345678901234",
      representativeName: "Administrateur",
      representativeRole: "Gérant",
      city: "Paris",
    },
  });

  await prisma.society.update({
    where: { id: societyId },
    data: { proprietaireId: proprietaire.id },
  });

  const building = await upsertBuilding(societyId, {
    name: "Résidence Les Orchidées",
    addressLine1: "12 rue des Orchidées",
    city: "Saint-Denis",
    postalCode: "97400",
    buildingType: "MIXTE",
    yearBuilt: 2012,
    totalArea: 420,
    acquisitionPrice: 620000,
    acquisitionFees: 42000,
    acquisitionTaxes: 18000,
    marketValue: 760000,
    netBookValue: 598000,
    acquisitionDate: new Date("2021-07-15"),
    description: "Immeuble mixte de démonstration avec logements, commerce et parking.",
  });

  const apartment = await prisma.lot.upsert({
    where: { buildingId_number: { buildingId: building.id, number: "201" } },
    update: {
      lotType: "APPARTEMENT",
      area: 52,
      floor: "2",
      status: "OCCUPE",
      marketRentValue: 890,
      currentRent: 850,
    },
    create: {
      buildingId: building.id,
      number: "201",
      lotType: "APPARTEMENT",
      area: 52,
      floor: "2",
      commonShares: 118,
      status: "OCCUPE",
      marketRentValue: 890,
      currentRent: 850,
      description: "T2 lumineux avec balcon.",
    },
  });

  await prisma.lot.upsert({
    where: { buildingId_number: { buildingId: building.id, number: "PK-12" } },
    update: { lotType: "PARKING", area: 12, status: "VACANT", marketRentValue: 80 },
    create: {
      buildingId: building.id,
      number: "PK-12",
      lotType: "PARKING",
      area: 12,
      commonShares: 12,
      status: "VACANT",
      marketRentValue: 80,
      description: "Place de parking couverte.",
    },
  });

  const tenant = await upsertTenant(societyId, {
    email: "marie.dupont.demo@example.com",
    firstName: "Marie",
    lastName: "Dupont",
    mobile: "06 12 34 56 78",
    personalAddress: "12 rue des Orchidées, 97400 Saint-Denis",
    riskIndicator: "VERT",
  });

  const lease = await prisma.lease.upsert({
    where: { leaseNumber: "BAIL-2026-0001" },
    update: {
      lotId: apartment.id,
      tenantId: tenant.id,
      currentRentHT: 850,
      status: "EN_COURS",
    },
    create: {
      societyId,
      lotId: apartment.id,
      tenantId: tenant.id,
      leaseNumber: "BAIL-2026-0001",
      leaseType: "HABITATION",
      destination: "HABITATION",
      status: "EN_COURS",
      startDate: new Date("2025-10-01"),
      durationMonths: 36,
      endDate: new Date("2028-09-30"),
      baseRentHT: 850,
      currentRentHT: 850,
      depositAmount: 850,
      paymentFrequency: "MENSUEL",
      billingTerm: "A_ECHOIR",
      vatApplicable: false,
      vatRate: 0,
      indexType: "IRL",
      baseIndexValue: 145.47,
      baseIndexQuarter: "T3 2025",
      leaseLots: { create: [{ lotId: apartment.id, isPrimary: true }] },
      chargeProvisions: {
        create: [{
          lotId: apartment.id,
          monthlyAmount: 95,
          vatRate: 0,
          startDate: new Date("2025-10-01"),
        }],
      },
    },
  });

  await seedInvoices(societyId, tenant.id, lease.id);
  await seedBanking(societyId);
  await seedCharges(societyId, building.id);
  await seedDocuments(societyId, building.id, apartment.id, lease.id, tenant.id);
  await seedLoan(societyId, building.id);
  await seedTicket(societyId, tenant.id);

  console.log("Realistic staging portfolio seeded");
}

async function upsertBuilding(societyId: string, data: {
  name: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  buildingType: "BUREAU" | "COMMERCE" | "MIXTE" | "ENTREPOT";
  yearBuilt: number;
  totalArea: number;
  acquisitionPrice: number;
  acquisitionFees: number;
  acquisitionTaxes: number;
  marketValue: number;
  netBookValue: number;
  acquisitionDate: Date;
  description: string;
}) {
  const existing = await prisma.building.findFirst({ where: { societyId, name: data.name } });
  if (existing) {
    return prisma.building.update({ where: { id: existing.id }, data });
  }
  return prisma.building.create({ data: { societyId, ...data } });
}

async function upsertTenant(societyId: string, data: {
  email: string;
  firstName: string;
  lastName: string;
  mobile: string;
  personalAddress: string;
  riskIndicator: "VERT" | "ORANGE" | "ROUGE";
}) {
  const existing = await prisma.tenant.findFirst({ where: { societyId, email: data.email } });
  const tenantData = {
    entityType: "PERSONNE_PHYSIQUE" as const,
    isActive: true,
    ...data,
  };
  if (existing) return prisma.tenant.update({ where: { id: existing.id }, data: tenantData });
  return prisma.tenant.create({ data: { societyId, ...tenantData } });
}

async function seedInvoices(societyId: string, tenantId: string, leaseId: string) {
  const invoices = [
    { number: "DEMO-2026-0001", status: "PAYE" as const, issueDate: "2026-01-01", dueDate: "2026-01-05", periodStart: "2026-01-01", periodEnd: "2026-01-31" },
    { number: "DEMO-2026-0002", status: "PAYE" as const, issueDate: "2026-02-01", dueDate: "2026-02-05", periodStart: "2026-02-01", periodEnd: "2026-02-28" },
    { number: "DEMO-2026-0003", status: "EN_RETARD" as const, issueDate: "2026-03-01", dueDate: "2026-03-05", periodStart: "2026-03-01", periodEnd: "2026-03-31" },
  ];

  for (const invoice of invoices) {
    await prisma.invoice.upsert({
      where: { societyId_invoiceNumber: { societyId, invoiceNumber: invoice.number } },
      update: { status: invoice.status },
      create: {
        societyId,
        tenantId,
        leaseId,
        invoiceNumber: invoice.number,
        invoiceType: "APPEL_LOYER",
        status: invoice.status,
        issueDate: new Date(invoice.issueDate),
        dueDate: new Date(invoice.dueDate),
        periodStart: new Date(invoice.periodStart),
        periodEnd: new Date(invoice.periodEnd),
        totalHT: 945,
        totalVAT: 0,
        totalTTC: 945,
        lines: {
          create: [
            { label: "Loyer mensuel", quantity: 1, unitPrice: 850, vatRate: 0, totalHT: 850, totalVAT: 0, totalTTC: 850, accountingAccountCode: "706100" },
            { label: "Provision sur charges", quantity: 1, unitPrice: 95, vatRate: 0, totalHT: 95, totalVAT: 0, totalTTC: 95, accountingAccountCode: "708200" },
          ],
        },
        payments: invoice.status === "PAYE"
          ? { create: [{ amount: 945, paidAt: new Date(invoice.dueDate), method: "Virement", reference: invoice.number, isReconciled: true }] }
          : undefined,
      },
    });
  }
}

async function seedBanking(societyId: string) {
  let account = await prisma.bankAccount.findFirst({
    where: { societyId, accountName: "Compte courant exploitation" },
  });
  const accountData = {
    bankName: "BNP Paribas",
    accountName: "Compte courant exploitation",
    ibanEncrypted: "DEMO-IBAN-FR7612345678900000000000000",
    initialBalance: 12450,
    currentBalance: 15285,
    isActive: true,
    lastSyncAt: new Date("2026-04-20"),
  };
  account = account
    ? await prisma.bankAccount.update({ where: { id: account.id }, data: accountData })
    : await prisma.bankAccount.create({ data: { societyId, ...accountData } });

  const transactions = [
    { externalId: "DEMO-BANK-2026-001", date: "2026-02-05", amount: 945, label: "VIR MARIE DUPONT LOYER FEVRIER", category: "loyers", isReconciled: true },
    { externalId: "DEMO-BANK-2026-002", date: "2026-03-12", amount: -382.4, label: "EDF REUNION PARTIES COMMUNES", category: "charges", isReconciled: false },
    { externalId: "DEMO-BANK-2026-003", date: "2026-03-28", amount: -1260, label: "ECHEANCE PRET BNP ORCHIDEES", category: "emprunt", isReconciled: false },
  ];
  for (const tx of transactions) {
    await prisma.bankTransaction.upsert({
      where: { bankAccountId_externalId: { bankAccountId: account.id, externalId: tx.externalId } },
      update: { amount: tx.amount, label: tx.label, isReconciled: tx.isReconciled },
      create: {
        bankAccountId: account.id,
        externalId: tx.externalId,
        transactionDate: new Date(tx.date),
        valueDate: new Date(tx.date),
        amount: tx.amount,
        label: tx.label,
        category: tx.category,
        isReconciled: tx.isReconciled,
        importBatch: "DEMO-2026-Q1",
      },
    });
  }
}

async function seedCharges(societyId: string, buildingId: string) {
  const category = await prisma.chargeCategory.upsert({
    where: { buildingId_name: { buildingId, name: "Entretien parties communes" } },
    update: { nature: "MIXTE", recoverableRate: 80, allocationMethod: "TANTIEME" },
    create: {
      societyId,
      buildingId,
      name: "Entretien parties communes",
      nature: "MIXTE",
      recoverableRate: 80,
      allocationMethod: "TANTIEME",
      description: "Nettoyage, petites réparations et consommables des parties communes.",
    },
  });

  const existing = await prisma.charge.findFirst({
    where: { societyId, buildingId, description: "Nettoyage parties communes - mars 2026" },
  });
  if (!existing) {
    await prisma.charge.create({
      data: {
        societyId,
        buildingId,
        categoryId: category.id,
        description: "Nettoyage parties communes - mars 2026",
        amount: 382.4,
        date: new Date("2026-03-12"),
        periodStart: new Date("2026-03-01"),
        periodEnd: new Date("2026-03-31"),
        supplierName: "Nettoyage Austral",
        isPaid: false,
      },
    });
  }
}

async function seedDocuments(societyId: string, buildingId: string, lotId: string, leaseId: string, tenantId: string) {
  const documents = [
    {
      fileName: "Bail Marie Dupont - Lot 201.pdf",
      category: "bail",
      description: "Bail d'habitation signé pour le lot 201.",
      leaseId,
      tenantId,
      aiTags: ["bail", "lot-201", "marie-dupont"],
    },
    {
      fileName: "DPE Residence Les Orchidees.pdf",
      category: "diagnostic",
      description: "Diagnostic énergétique de l'immeuble.",
      buildingId,
      expiresAt: new Date("2031-06-30"),
      aiTags: ["diagnostic", "dpe", "immeuble"],
    },
  ];

  for (const doc of documents) {
    const existing = await prisma.document.findFirst({ where: { societyId, fileName: doc.fileName } });
    const data = {
      fileUrl: `/demo/documents/${encodeURIComponent(doc.fileName)}`,
      fileSize: 245000,
      mimeType: "application/pdf",
      aiStatus: "done",
      aiSummary: doc.description,
      aiMetadata: { source: "staging-seed" },
      lotId,
      ...doc,
    };
    if (existing) await prisma.document.update({ where: { id: existing.id }, data });
    else await prisma.document.create({ data: { societyId, ...data } });
  }
}

async function seedLoan(societyId: string, buildingId: string) {
  const existing = await prisma.loan.findFirst({ where: { societyId, label: "Prêt BNP — Résidence Les Orchidées" } });
  const data = {
    buildingId,
    label: "Prêt BNP — Résidence Les Orchidées",
    lender: "BNP Paribas",
    loanType: "AMORTISSABLE" as const,
    status: "EN_COURS" as const,
    amount: 430000,
    interestRate: 2.35,
    insuranceRate: 0.24,
    durationMonths: 240,
    startDate: new Date("2021-08-01"),
    endDate: new Date("2041-07-31"),
    purchaseValue: 680000,
    notes: "Emprunt principal du bien de démonstration.",
  };
  if (existing) await prisma.loan.update({ where: { id: existing.id }, data });
  else await prisma.loan.create({ data: { societyId, ...data } });
}

async function seedTicket(societyId: string, tenantId: string) {
  await prisma.ticket.upsert({
    where: { ticketNumber: "TK-2026-0001" },
    update: { status: "EN_COURS", priority: "NORMALE" },
    create: {
      societyId,
      tenantId,
      ticketNumber: "TK-2026-0001",
      subject: "Robinet cuisine à remplacer",
      description: "Le locataire signale une fuite légère sous l'évier de la cuisine.",
      category: "PLOMBERIE",
      priority: "NORMALE",
      status: "EN_COURS",
      location: "Cuisine",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
