export type DocumentCategoryItem = {
  readonly value: string;
  readonly label: string;
};

export type DocumentCategoryGroup = {
  readonly group: string;
  readonly items: readonly DocumentCategoryItem[];
};

export const DOCUMENT_CATEGORY_GROUPS = [
  {
    group: "Patrimoine",
    items: [
      { value: "titre_propriete", label: "Titre de propriété" },
      { value: "acte_acquisition", label: "Acte d'acquisition" },
      { value: "plan", label: "Plan / Surface" },
      { value: "diagnostic", label: "Diagnostic technique" },
      { value: "permis_construire", label: "Permis de construire" },
      { value: "autorisation_travaux", label: "Autorisation de travaux" },
    ],
  },
  {
    group: "Location",
    items: [
      { value: "bail", label: "Bail / Contrat de location" },
      { value: "avenant", label: "Avenant au bail" },
      { value: "etat_des_lieux", label: "État des lieux" },
      { value: "quittance", label: "Quittance de loyer" },
    ],
  },
  {
    group: "Juridique société",
    items: [
      { value: "statuts", label: "Statuts de société" },
      { value: "pv_ag", label: "PV d'assemblée générale" },
      { value: "kbis", label: "Extrait Kbis / RCS" },
      { value: "mandat_gestion", label: "Mandat de gestion" },
      { value: "reglement_copro", label: "Règlement de copropriété" },
    ],
  },
  {
    group: "Financier",
    items: [
      { value: "comptes_annuels", label: "Comptes annuels" },
      { value: "liasse_fiscale", label: "Liasse fiscale" },
      { value: "budget", label: "Budget prévisionnel" },
      { value: "expertise", label: "Rapport d'expertise / évaluation" },
      { value: "facture", label: "Facture" },
    ],
  },
  {
    group: "Assurance",
    items: [
      { value: "assurance", label: "Attestation d'assurance locataire" },
      { value: "police_assurance", label: "Police d'assurance immeuble" },
      { value: "attestation_decennale", label: "Attestation décennale" },
    ],
  },
  {
    group: "Administratif",
    items: [
      { value: "contrat", label: "Contrat prestataire" },
      { value: "courrier", label: "Courrier / Correspondance" },
      { value: "autre", label: "Autre" },
    ],
  },
] as const satisfies readonly DocumentCategoryGroup[];

export type DocumentCategory =
  (typeof DOCUMENT_CATEGORY_GROUPS)[number]["items"][number]["value"];

export const DOCUMENT_CATEGORIES: ReadonlyArray<{ readonly value: DocumentCategory; readonly label: string }> =
  DOCUMENT_CATEGORY_GROUPS.reduce<Array<{ readonly value: DocumentCategory; readonly label: string }>>(
    (items, group) => {
      for (const item of group.items) {
        items.push(item);
      }
      return items;
    },
    [],
  );
