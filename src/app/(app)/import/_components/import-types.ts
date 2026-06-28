// Types et constantes pour le workflow d'import par PDF.

// ─── Types ───────────────────────────────────────────────────────────────────

export type BuildingOption = { id: string; name: string; city: string };
export type TenantOption = {
  id: string;
  entityType: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type LotOption = {
  id: string;
  number: string;
  lotType: string;
  area: number;
  status: string;
  building: { id: string; name: string };
};

export type ImmeubleForm = {
  name: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  buildingType: string;
};

export type LotForm = {
  number: string;
  lotType: string;
  area: string;
  floor: string;
  position: string;
};

export type LocataireForm = {
  entityType: "PERSONNE_MORALE" | "PERSONNE_PHYSIQUE";
  companyName: string;
  companyLegalForm: string;
  siret: string;
  legalRepName: string;
  legalRepTitle: string;
  legalRepEmail: string;
  legalRepPhone: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
};

export type BailForm = {
  leaseType: string;
  destination: string;
  startDate: string;
  durationMonths: string;
  baseRentHT: string;
  depositAmount: string;
  paymentFrequency: string;
  billingTerm: string;
  vatApplicable: boolean;
  vatRate: string;
  indexType: string;
  baseIndexValue: string;
  baseIndexQuarter: string;
  fixedAnnualIndexationRate: string;
  billingAnchorMonth: string;
  billingAnchorDay: string;
  revisionFrequency: string;
  revisionDateBasis: string;
  revisionCustomMonth: string;
  revisionCustomDay: string;
  rentFreeMonths: string;
  entryFee: string;
  tenantWorksClauses: string;
  isThirdPartyManaged: boolean;
  managingContactId: string;
  managementFeeType: string;
  managementFeeValue: string;
  managementFeeBasis: string;
  managementFeeVatRate: string;
};

export type ReviewForm = {
  immeuble: ImmeubleForm;
  lot: LotForm;
  locataire: LocataireForm;
  bail: BailForm;
};

// ─── Constants ───────────────────────────────────────────────────────────────

export const BUILDING_TYPE_OPTIONS = [
  { value: "BUREAU", label: "Bureau" },
  { value: "COMMERCE", label: "Commerce" },
  { value: "MIXTE", label: "Mixte" },
  { value: "ENTREPOT", label: "Entrepôt" },
];

export const LOT_TYPE_OPTIONS = [
  { value: "LOCAL_COMMERCIAL", label: "Local commercial" },
  { value: "BUREAUX", label: "Bureaux" },
  { value: "LOCAL_ACTIVITE", label: "Local d'activité" },
  { value: "APPARTEMENT", label: "Appartement" },
  { value: "ENTREPOT", label: "Entrepôt" },
  { value: "PARKING", label: "Parking" },
  { value: "CAVE", label: "Cave" },
  { value: "TERRASSE", label: "Terrasse" },
  { value: "RESERVE", label: "Réserve" },
];

export const LEASE_TYPE_OPTIONS = [
  { value: "HABITATION", label: "Bail d'habitation vide (loi 1989)" },
  { value: "MEUBLE", label: "Bail meublé (ALUR)" },
  { value: "ETUDIANT", label: "Bail étudiant meublé (9 mois)" },
  { value: "MOBILITE", label: "Bail mobilité (ELAN)" },
  { value: "COLOCATION", label: "Bail colocation" },
  { value: "SAISONNIER", label: "Location saisonnière" },
  { value: "LOGEMENT_FONCTION", label: "Logement de fonction" },
  { value: "ANAH", label: "Convention ANAH" },
  { value: "CIVIL", label: "Bail civil (Code civil)" },
  { value: "GLISSANT", label: "Bail glissant" },
  { value: "SOUS_LOCATION", label: "Sous-location" },
  { value: "COMMERCIAL_369", label: "Bail commercial 3-6-9" },
  { value: "DEROGATOIRE", label: "Bail dérogatoire" },
  { value: "PRECAIRE", label: "Convention d'occupation précaire" },
  { value: "BAIL_PROFESSIONNEL", label: "Bail professionnel" },
  { value: "MIXTE", label: "Bail mixte" },
  { value: "EMPHYTEOTIQUE", label: "Bail emphytéotique" },
  { value: "CONSTRUCTION", label: "Bail à construction" },
  { value: "REHABILITATION", label: "Bail à réhabilitation" },
  { value: "BRS", label: "Bail réel solidaire (OFS)" },
  { value: "RURAL", label: "Bail rural / agricole" },
];

export const DESTINATION_OPTIONS = [
  { value: "", label: "— Non renseignée —" },
  { value: "HABITATION", label: "Habitation" },
  { value: "BUREAU", label: "Bureau" },
  { value: "COMMERCE", label: "Commerce / Boutique" },
  { value: "ACTIVITE", label: "Local d'activité / Atelier" },
  { value: "ENTREPOT", label: "Entrepôt / Stockage" },
  { value: "INDUSTRIEL", label: "Local industriel" },
  { value: "PROFESSIONNEL", label: "Cabinet libéral" },
  { value: "MIXTE", label: "Mixte (habitation + professionnel)" },
  { value: "PARKING", label: "Parking / Garage" },
  { value: "TERRAIN", label: "Terrain nu" },
  { value: "AGRICOLE", label: "Agricole" },
  { value: "HOTELLERIE", label: "Hôtellerie / Tourisme" },
  { value: "EQUIPEMENT", label: "Équipement (salle, crèche…)" },
  { value: "AUTRE", label: "Autre" },
];

export const BILLING_TERM_OPTIONS = [
  { value: "A_ECHOIR", label: "À échoir (début de période)" },
  { value: "ECHU", label: "Échu (fin de période)" },
];

export const PAYMENT_FREQ_OPTIONS = [
  { value: "MENSUEL", label: "Mensuel" },
  { value: "TRIMESTRIEL", label: "Trimestriel" },
  { value: "SEMESTRIEL", label: "Semestriel" },
  { value: "ANNUEL", label: "Annuel" },
];

export const FREQ_PERIOD_LABELS: Record<string, string> = {
  MENSUEL: "mois",
  TRIMESTRIEL: "trimestre",
  SEMESTRIEL: "semestre",
  ANNUEL: "an",
};

export const INDEX_TYPE_OPTIONS = [
  { value: "", label: "Aucun" },
  { value: "IRL", label: "IRL — Référence des Loyers" },
  { value: "ILC", label: "ILC — Loyers Commerciaux" },
  { value: "ILAT", label: "ILAT — Activités tertiaires" },
  { value: "ICC", label: "ICC — Construction" },
  { value: "POURCENTAGE_FIXE", label: "Taux fixe annuel (contractuel)" },
];

export const REVISION_DATE_BASIS_OPTIONS = [
  { value: "DATE_SIGNATURE", label: "Date anniversaire du bail" },
  { value: "DATE_ENTREE", label: "Date d'entrée dans les lieux" },
  { value: "PREMIER_JANVIER", label: "1er janvier" },
  { value: "DATE_PERSONNALISEE", label: "Date personnalisée" },
];

export const FEE_TYPE_OPTIONS = [
  { value: "POURCENTAGE", label: "Pourcentage" },
  { value: "FORFAIT", label: "Forfait" },
];

export const FEE_BASIS_OPTIONS = [
  { value: "LOYER_HT", label: "Loyer HT" },
  { value: "LOYER_CHARGES_HT", label: "Loyer + charges HT" },
  { value: "TOTAL_TTC", label: "Total TTC" },
];

export const LEGAL_FORM_OPTIONS = [
  { value: "", label: "— Forme juridique —" },
  { value: "SAS", label: "SAS" },
  { value: "SARL", label: "SARL" },
  { value: "SA", label: "SA" },
  { value: "SCI", label: "SCI" },
  { value: "EURL", label: "EURL" },
  { value: "SASU", label: "SASU" },
  { value: "SNC", label: "SNC" },
  { value: "EI", label: "Entreprise individuelle" },
  { value: "AUTRE", label: "Autre" },
];

// ─── Helper ───────────────────────────────────────────────────────────────────
