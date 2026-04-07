export const APP_NAME =
  process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const LEGAL_FORMS = [
  { value: "SCI", label: "SCI" },
  { value: "SARL", label: "SARL" },
  { value: "SAS", label: "SAS" },
  { value: "SA", label: "SA" },
  { value: "EURL", label: "EURL" },
  { value: "SASU", label: "SASU" },
  { value: "SNC", label: "SNC" },
  { value: "AUTRE", label: "Autre" },
] as const;

export const TAX_REGIMES = [
  { value: "IS", label: "Impôt sur les Sociétés (IS)" },
  { value: "IR", label: "Impôt sur le Revenu (IR)" },
] as const;

export const VAT_REGIMES = [
  { value: "TVA", label: "Assujetti TVA" },
  { value: "FRANCHISE", label: "Franchise de TVA" },
] as const;

export const USER_ROLES = [
  { value: "SUPER_ADMIN", label: "Super Administrateur" },
  { value: "ADMIN_SOCIETE", label: "Administrateur Société" },
  { value: "GESTIONNAIRE", label: "Gestionnaire" },
  { value: "COMPTABLE", label: "Comptable" },
  { value: "LECTURE", label: "Lecture seule" },
] as const;

export const ITEMS_PER_PAGE = 25;

export const BUILDING_TYPES = [
  { value: "BUREAU", label: "Bureau" },
  { value: "COMMERCE", label: "Commerce" },
  { value: "MIXTE", label: "Mixte" },
  { value: "ENTREPOT", label: "Entrepôt" },
] as const;

export const LOT_TYPES = [
  { value: "LOCAL_COMMERCIAL", label: "Local commercial" },
  { value: "BUREAUX", label: "Bureaux" },
  { value: "LOCAL_ACTIVITE", label: "Local d'activité" },
  { value: "APPARTEMENT", label: "Appartement" },
  { value: "RESERVE", label: "Réserve" },
  { value: "PARKING", label: "Parking" },
  { value: "CAVE", label: "Cave" },
  { value: "TERRASSE", label: "Terrasse" },
  { value: "ENTREPOT", label: "Entrepôt" },
] as const;

export const LOT_STATUSES = [
  { value: "VACANT", label: "Vacant" },
  { value: "OCCUPE", label: "Occupé" },
  { value: "EN_TRAVAUX", label: "En travaux" },
  { value: "RESERVE", label: "Réservé" },
] as const;

export const EXPLOITATION_STATUS_GROUPS = [
  {
    group: "En exploitation",
    items: [
      { value: "EE_EN_EXPLOITATION", label: "En exploitation" },
      { value: "EE_MISE_HE_PREVUE", label: "Mise hors exploitation prévue" },
      { value: "EE_EN_VENTE", label: "En vente" },
    ],
  },
  {
    group: "Hors exploitation",
    items: [
      { value: "HE_EN_ACQUISITION", label: "En acquisition" },
      { value: "HE_EN_CONSTRUCTION", label: "En construction" },
      { value: "HE_EN_RENOVATION", label: "En rénovation" },
      { value: "HE_EN_TRAVAUX", label: "En travaux" },
      { value: "HE_PERMIS_EN_ATTENTE", label: "Permis en attente" },
      { value: "HE_EN_LIVRAISON", label: "En livraison" },
      { value: "HE_MISE_EE_PREVUE", label: "Mise en exploitation prévue" },
      { value: "HE_AUTRE", label: "Autre (hors exploitation)" },
    ],
  },
  {
    group: "Fin d'exploitation",
    items: [
      { value: "FE_VENDU", label: "Vendu" },
      { value: "FE_DETRUIT", label: "Détruit" },
      { value: "FE_AUTRE", label: "Autre (fin d'exploitation)" },
    ],
  },
  {
    group: "Inconnu",
    items: [
      { value: "INCONNU", label: "Inconnu" },
    ],
  },
] as const;

export const EXPLOITATION_STATUSES = EXPLOITATION_STATUS_GROUPS.flatMap(g => g.items);

export const DIAGNOSTIC_TYPES = [
  { value: "DPE", label: "DPE - Performance énergétique" },
  { value: "AMIANTE", label: "Amiante" },
  { value: "PLOMB", label: "Plomb (CREP)" },
  { value: "ELECTRICITE", label: "Électricité" },
  { value: "GAZ", label: "Gaz" },
  { value: "ACCESSIBILITE", label: "Accessibilité (ERP)" },
  { value: "INCENDIE", label: "Sécurité incendie" },
  { value: "TERMITES", label: "Termites" },
  { value: "AUTRE", label: "Autre" },
] as const;
