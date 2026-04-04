import type { PrismaClient } from "../src/generated/prisma/client";

type ChargeCategorySeed = {
  name: string;
  nature: "RECUPERABLE" | "PROPRIETAIRE" | "MIXTE";
  recoverableRate: number | null;
  allocationMethod: "TANTIEME" | "SURFACE" | "NB_LOTS" | "COMPTEUR" | "PERSONNALISE";
  description: string;
};

/**
 * Bibliothèque exhaustive des charges immobilières françaises.
 * Basée sur le Décret n°87-713 du 26 août 1987 (charges récupérables)
 * et la pratique courante de gestion locative.
 */
const GLOBAL_CHARGE_CATEGORIES: ChargeCategorySeed[] = [
  // ═══ CHARGES RÉCUPÉRABLES (Décret 87-713) ═══

  // --- Eau ---
  { name: "Eau froide — parties privatives", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "COMPTEUR", description: "Consommation d'eau froide des locataires (compteurs individuels ou répartition)" },
  { name: "Eau froide — parties communes", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "TANTIEME", description: "Eau froide pour nettoyage et entretien des parties communes" },
  { name: "Eau chaude — production", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "COMPTEUR", description: "Coût de production d'eau chaude collective (combustible, électricité)" },
  { name: "Eau chaude — distribution", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "TANTIEME", description: "Entretien du réseau de distribution d'eau chaude" },

  // --- Chauffage ---
  { name: "Chauffage collectif — combustible", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "TANTIEME", description: "Combustible ou énergie pour le chauffage collectif (gaz, fioul, réseau)" },
  { name: "Chauffage collectif — entretien courant", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "TANTIEME", description: "Entretien courant de la chaudière collective et du réseau" },
  { name: "Chauffage individuel — entretien", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "NB_LOTS", description: "Contrat d'entretien annuel des chaudières individuelles" },

  // --- Ascenseur ---
  { name: "Ascenseur — entretien courant", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "TANTIEME", description: "Contrat d'entretien, visites périodiques, menues réparations" },
  { name: "Ascenseur — électricité", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "TANTIEME", description: "Consommation électrique de l'ascenseur" },

  // --- Parties communes intérieures ---
  { name: "Nettoyage parties communes", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "TANTIEME", description: "Contrat de ménage, salaire employé d'immeuble (part entretien)" },
  { name: "Produits d'entretien", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "TANTIEME", description: "Produits ménagers, balais, sacs poubelle pour les parties communes" },
  { name: "Électricité parties communes", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "TANTIEME", description: "Éclairage des halls, couloirs, escaliers, caves, parkings" },
  { name: "Petit matériel d'entretien", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "TANTIEME", description: "Ampoules, fusibles, petit outillage pour l'entretien courant" },

  // --- Parties communes extérieures ---
  { name: "Espaces verts — entretien", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "TANTIEME", description: "Tonte, taille, arrosage, remplacement de végétaux" },
  { name: "Voiries et aires de stationnement", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "TANTIEME", description: "Nettoyage, déneigement, sablage des voies d'accès" },

  // --- Équipements collectifs ---
  { name: "VMC — entretien courant", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "TANTIEME", description: "Entretien et nettoyage de la ventilation mécanique contrôlée" },
  { name: "Interphone / digicode — entretien", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "TANTIEME", description: "Contrat d'entretien des systèmes d'accès" },
  { name: "Portail automatique — entretien", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "TANTIEME", description: "Entretien courant et menues réparations du portail automatique" },
  { name: "Antenne collective / câble", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "NB_LOTS", description: "Entretien de l'antenne collective ou du réseau câblé" },
  { name: "Surpresseur / pompe de relevage", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "TANTIEME", description: "Électricité et entretien des systèmes hydrauliques" },

  // --- Taxes récupérables ---
  { name: "TEOM (Taxe ordures ménagères)", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "TANTIEME", description: "Taxe d'enlèvement des ordures ménagères — récupérable intégralement" },
  { name: "Redevance assainissement", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "COMPTEUR", description: "Part assainissement de la facture d'eau" },

  // --- Hygiène ---
  { name: "Dératisation / désinsectisation", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "TANTIEME", description: "Traitements préventifs et curatifs contre les nuisibles" },
  { name: "Ramonage", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "NB_LOTS", description: "Ramonage des conduits de cheminée (obligatoire)" },
  { name: "Détartrage / traitement eau", nature: "RECUPERABLE", recoverableRate: 100, allocationMethod: "TANTIEME", description: "Traitement anti-calcaire et légionellose" },

  // ═══ CHARGES MIXTES ═══

  { name: "Gardiennage / concierge", nature: "MIXTE", recoverableRate: 75, allocationMethod: "TANTIEME", description: "Salaire et charges du gardien — 75% récupérable maximum (décret 87-713)" },
  { name: "Entretien espaces verts (gros travaux)", nature: "MIXTE", recoverableRate: 50, allocationMethod: "TANTIEME", description: "Élagage, abattage, replantation — part récupérable selon nature des travaux" },
  { name: "Contrat multiservices immeuble", nature: "MIXTE", recoverableRate: 70, allocationMethod: "TANTIEME", description: "Contrat global incluant entretien et maintenance — ventilation selon poste" },

  // ═══ CHARGES PROPRIÉTAIRE (non récupérables) ═══

  // --- Fiscalité ---
  { name: "Taxe foncière", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "TANTIEME", description: "Taxe foncière sur les propriétés bâties (hors TEOM)" },
  { name: "CFE (Contribution Foncière des Entreprises)", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "TANTIEME", description: "Pour les locaux commerciaux et professionnels" },
  { name: "Taxe sur les bureaux (Île-de-France)", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "SURFACE", description: "TSB applicable en Île-de-France sur les locaux professionnels" },

  // --- Assurances ---
  { name: "Assurance PNO (Propriétaire Non Occupant)", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "TANTIEME", description: "Assurance obligatoire du propriétaire non occupant" },
  { name: "Assurance multirisque immeuble", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "TANTIEME", description: "Couverture globale de l'immeuble (incendie, dégâts des eaux, RC)" },
  { name: "Assurance loyers impayés (GLI)", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "NB_LOTS", description: "Garantie Loyers Impayés par lot assuré" },

  // --- Gestion / Administration ---
  { name: "Honoraires de gestion locative", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "TANTIEME", description: "Frais de gestion par une agence ou un administrateur de biens" },
  { name: "Honoraires de syndic", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "TANTIEME", description: "Honoraires du syndic de copropriété (forfait + vacations)" },
  { name: "Honoraires comptable / expert-comptable", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "TANTIEME", description: "Tenue de comptabilité, déclarations fiscales" },
  { name: "Frais juridiques / contentieux", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "TANTIEME", description: "Avocats, huissiers, frais de procédure" },
  { name: "Frais postaux et affranchissement", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "TANTIEME", description: "Courriers recommandés, relances, envois divers" },

  // --- Travaux et réparations ---
  { name: "Gros travaux — ravalement", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "TANTIEME", description: "Ravalement de façade (obligation décennale dans certaines communes)" },
  { name: "Gros travaux — toiture", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "TANTIEME", description: "Réfection ou réparation de la toiture, étanchéité" },
  { name: "Gros travaux — mise aux normes", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "TANTIEME", description: "Mise en conformité électrique, accessibilité, sécurité incendie" },
  { name: "Réparations structurelles", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "TANTIEME", description: "Fondations, murs porteurs, charpente" },
  { name: "Remplacement équipements collectifs", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "TANTIEME", description: "Changement chaudière, ascenseur, VMC (hors entretien courant)" },

  // --- Diagnostics ---
  { name: "Diagnostics immobiliers", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "NB_LOTS", description: "DPE, amiante, plomb, termites, électricité, gaz, ERP" },

  // --- Charges financières ---
  { name: "Frais bancaires", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "TANTIEME", description: "Frais de tenue de compte, commissions bancaires" },
  { name: "Intérêts d'emprunt", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "TANTIEME", description: "Intérêts sur les emprunts immobiliers" },
  { name: "Assurance emprunteur", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "TANTIEME", description: "Assurance décès-invalidité liée aux emprunts" },

  // --- Vacance et impayés ---
  { name: "Vacance locative", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "NB_LOTS", description: "Perte de revenus pendant les périodes de vacance" },
  { name: "Provision pour impayés", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "NB_LOTS", description: "Provision pour créances douteuses et irrécouvrables" },

  // --- Copropriété (charges appelées par le syndic) ---
  { name: "Charges copropriété — courantes", nature: "MIXTE", recoverableRate: 60, allocationMethod: "TANTIEME", description: "Appel de charges trimestriel du syndic — part récupérable selon ventilation" },
  { name: "Charges copropriété — travaux votés", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "TANTIEME", description: "Appels de fonds pour travaux votés en AG" },
  { name: "Fonds de travaux (loi ALUR)", nature: "PROPRIETAIRE", recoverableRate: null, allocationMethod: "TANTIEME", description: "Cotisation obligatoire au fonds de travaux (min. 5% du budget prévisionnel)" },
];

export async function seedGlobalChargeCategories(prisma: PrismaClient) {
  console.log("Seeding global charge categories...");

  let created = 0;
  let skipped = 0;

  for (const cat of GLOBAL_CHARGE_CATEGORIES) {
    const existing = await prisma.societyChargeCategory.findFirst({
      where: { societyId: null, name: cat.name },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.societyChargeCategory.create({
      data: {
        societyId: null,
        name: cat.name,
        nature: cat.nature,
        recoverableRate: cat.recoverableRate,
        allocationMethod: cat.allocationMethod,
        description: cat.description,
        isGlobal: true,
        isActive: true,
      },
    });
    created++;
  }

  console.log(`  ${created} catégories globales créées, ${skipped} existantes ignorées`);
  console.log(`  Total : ${GLOBAL_CHARGE_CATEGORIES.length} catégories dans la bibliothèque`);
}
