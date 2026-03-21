import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

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

  // Créer le plan comptable de base pour la société
  const accounts = [
    { code: "411000", label: "Clients - Locataires", type: "4" },
    { code: "421000", label: "Dépôts de garantie reçus", type: "4" },
    { code: "445710", label: "TVA collectée", type: "4" },
    { code: "512000", label: "Banque", type: "5" },
    { code: "706100", label: "Loyers encaissés", type: "7" },
    { code: "706200", label: "Loyers bureaux", type: "7" },
    { code: "708100", label: "Refacturation de charges", type: "7" },
    { code: "613200", label: "Locations immobilières", type: "6" },
    { code: "614000", label: "Charges locatives", type: "6" },
    { code: "615000", label: "Entretien et réparations", type: "6" },
    { code: "616000", label: "Assurances", type: "6" },
    { code: "635100", label: "Taxe foncière", type: "6" },
    { code: "635200", label: "TEOM", type: "6" },
    { code: "622600", label: "Honoraires de gestion", type: "6" },
    { code: "164000", label: "Emprunts", type: "1" },
  ];

  for (const account of accounts) {
    await prisma.accountingAccount.upsert({
      where: {
        societyId_code: { societyId: society.id, code: account.code },
      },
      update: {},
      create: {
        societyId: society.id,
        code: account.code,
        label: account.label,
        type: account.type,
      },
    });
  }

  console.log(`${accounts.length} accounting accounts created`);

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
