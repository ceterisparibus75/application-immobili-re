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

  console.log("\nSeed completed!");
  console.log("Login credentials:");
  console.log("  Email: admin@gestimmo.fr");
  console.log("  Password: Admin123!");
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
