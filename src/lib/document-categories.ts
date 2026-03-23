export const DOCUMENT_CATEGORIES = [
  { value: "titre_propriete", label: "Titre de propriété" },
  { value: "acte_acquisition", label: "Acte d'acquisition" },
  { value: "reglement_copro", label: "Règlement de copropriété" },
  { value: "plan", label: "Plan / Surface" },
  { value: "diagnostic", label: "Diagnostic technique" },
  { value: "bail", label: "Bail / Contrat de location" },
  { value: "avenant", label: "Avenant au bail" },
  { value: "etat_des_lieux", label: "État des lieux" },
  { value: "assurance", label: "Attestation d'assurance" },
  { value: "quittance", label: "Quittance de loyer" },
  { value: "facture", label: "Facture" },
  { value: "contrat", label: "Contrat prestataire" },
  { value: "courrier", label: "Courrier / Correspondance" },
  { value: "autre", label: "Autre" },
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]["value"];
