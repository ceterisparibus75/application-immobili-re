export type DataroomTemplateKey =
  | "VENTE_IMMOBILIERE"
  | "FINANCEMENT"
  | "AUDIT"
  | "DUE_DILIGENCE"
  | "NOTAIRE"
  | "INVESTISSEUR"
  | "VIDE";

export type DataroomGroupPermission =
  | "NO_ACCESS"
  | "VIEW"
  | "VIEW_DOWNLOAD"
  | "QUESTION"
  | "CONTRIBUTE"
  | "MANAGE";

export type DataroomGroupPreset = {
  id: string;
  name: string;
  permission: DataroomGroupPermission;
};

export type DataroomChecklistItem = {
  id: string;
  label: string;
  section: string;
  required: boolean;
  done?: boolean;
};

export type DataroomTemplate = {
  key: DataroomTemplateKey;
  label: string;
  purpose: string | null;
  description: string;
  sections: string[];
  groups: DataroomGroupPreset[];
  checklist: DataroomChecklistItem[];
};

export const PERMISSION_LABELS: Record<DataroomGroupPermission, string> = {
  NO_ACCESS: "Aucun accès",
  VIEW: "Lecture seule",
  VIEW_DOWNLOAD: "Lecture + téléchargement",
  QUESTION: "Lecture + questions",
  CONTRIBUTE: "Contribuer",
  MANAGE: "Gérer",
};

const BASE_GROUPS: DataroomGroupPreset[] = [
  { id: "interne", name: "Équipe interne", permission: "MANAGE" },
  { id: "lecture", name: "Invités lecture seule", permission: "VIEW" },
];

function item(id: string, section: string, label: string, required = true): DataroomChecklistItem {
  return { id, section, label, required, done: false };
}

export const DATAROOM_TEMPLATES: DataroomTemplate[] = [
  {
    key: "VENTE_IMMOBILIERE",
    label: "Vente immobilière",
    purpose: "VENTE",
    description: "Dossier structuré pour acquéreur, conseil, notaire ou broker.",
    sections: ["Propriété", "Juridique", "Baux", "Diagnostics", "Finances", "Travaux", "Copropriété"],
    groups: [
      ...BASE_GROUPS,
      { id: "acquereur", name: "Acquéreurs", permission: "VIEW_DOWNLOAD" },
      { id: "notaire", name: "Notaire", permission: "VIEW_DOWNLOAD" },
    ],
    checklist: [
      item("titre-propriete", "Propriété", "Titre de propriété"),
      item("taxe-fonciere", "Finances", "Dernière taxe foncière"),
      item("baux", "Baux", "Baux et avenants"),
      item("quittancements", "Finances", "État locatif ou quittancements"),
      item("diagnostics", "Diagnostics", "Diagnostics obligatoires"),
      item("travaux", "Travaux", "Historique des travaux", false),
    ],
  },
  {
    key: "FINANCEMENT",
    label: "Financement bancaire",
    purpose: "FINANCEMENT",
    description: "Dossier bancaire pour refinancement, acquisition ou renouvellement de dette.",
    sections: ["Synthèse", "Propriété", "Finances", "Baux", "Dette", "Assurances"],
    groups: [
      ...BASE_GROUPS,
      { id: "banque", name: "Banque", permission: "VIEW_DOWNLOAD" },
      { id: "expert", name: "Expert-comptable", permission: "VIEW_DOWNLOAD" },
    ],
    checklist: [
      item("business-plan", "Synthèse", "Note de synthèse ou business plan"),
      item("loyers", "Finances", "État des loyers"),
      item("baux", "Baux", "Baux en cours"),
      item("comptes", "Finances", "Comptes ou liasses fiscales"),
      item("dette", "Dette", "Tableau d'amortissement"),
      item("assurance", "Assurances", "Attestations d'assurance", false),
    ],
  },
  {
    key: "AUDIT",
    label: "Audit",
    purpose: "AUDIT",
    description: "Espace de revue pour audit comptable, juridique ou opérationnel.",
    sections: ["Comptabilité", "Juridique", "Contrats", "Banque", "Fiscalité", "Documents support"],
    groups: [
      ...BASE_GROUPS,
      { id: "auditeur", name: "Auditeurs", permission: "QUESTION" },
      { id: "expert", name: "Expert-comptable", permission: "VIEW_DOWNLOAD" },
    ],
    checklist: [
      item("grand-livre", "Comptabilité", "Grand livre ou export comptable"),
      item("releves", "Banque", "Relevés bancaires"),
      item("factures", "Comptabilité", "Factures significatives"),
      item("contrats", "Contrats", "Contrats principaux"),
      item("fiscalite", "Fiscalité", "Déclarations fiscales", false),
    ],
  },
  {
    key: "DUE_DILIGENCE",
    label: "Due diligence",
    purpose: "DUE_DILIGENCE",
    description: "Dossier complet pour revue acquéreur ou investisseur.",
    sections: ["Corporate", "Actifs", "Baux", "Finances", "Fiscalité", "Technique", "Risques"],
    groups: [
      ...BASE_GROUPS,
      { id: "investisseur", name: "Investisseurs", permission: "QUESTION" },
      { id: "conseil", name: "Conseils externes", permission: "VIEW_DOWNLOAD" },
    ],
    checklist: [
      item("organigramme", "Corporate", "Organigramme ou structure de détention"),
      item("actifs", "Actifs", "Liste des actifs"),
      item("baux", "Baux", "Baux, avenants et garanties"),
      item("finances", "Finances", "États financiers"),
      item("diagnostics", "Technique", "Diagnostics et rapports techniques"),
      item("risques", "Risques", "Litiges ou risques connus", false),
    ],
  },
  {
    key: "NOTAIRE",
    label: "Dossier notaire",
    purpose: "VENTE",
    description: "Pièces utiles à la préparation d'un acte ou d'une régularisation.",
    sections: ["Identité", "Propriété", "Urbanisme", "Diagnostics", "Copropriété", "Fiscalité"],
    groups: [
      ...BASE_GROUPS,
      { id: "notaire", name: "Notaire", permission: "VIEW_DOWNLOAD" },
    ],
    checklist: [
      item("identite", "Identité", "Pièces d'identité ou Kbis"),
      item("titre", "Propriété", "Titre de propriété"),
      item("urbanisme", "Urbanisme", "Documents d'urbanisme", false),
      item("diagnostics", "Diagnostics", "Diagnostics"),
      item("copro", "Copropriété", "Règlement de copropriété", false),
    ],
  },
  {
    key: "INVESTISSEUR",
    label: "Dossier investisseur",
    purpose: "FINANCEMENT",
    description: "Dossier synthétique pour présenter un actif ou une société.",
    sections: ["Présentation", "Actifs", "Performance", "Pipeline", "Risques", "Annexes"],
    groups: [
      ...BASE_GROUPS,
      { id: "investisseur", name: "Investisseurs", permission: "VIEW" },
      { id: "conseil", name: "Conseils externes", permission: "VIEW_DOWNLOAD" },
    ],
    checklist: [
      item("presentation", "Présentation", "Présentation de l'opportunité"),
      item("actifs", "Actifs", "Liste des actifs"),
      item("performance", "Performance", "Indicateurs financiers"),
      item("pipeline", "Pipeline", "Pipeline ou stratégie", false),
      item("annexes", "Annexes", "Annexes de support", false),
    ],
  },
  {
    key: "VIDE",
    label: "Dataroom vide",
    purpose: null,
    description: "Créer une structure libre, sans checklist imposée.",
    sections: ["Documents"],
    groups: BASE_GROUPS,
    checklist: [],
  },
];

export function getDataroomTemplate(key: string | null | undefined): DataroomTemplate {
  return DATAROOM_TEMPLATES.find((template) => template.key === key) ?? DATAROOM_TEMPLATES[0];
}

export function getChecklistScore(checklist: DataroomChecklistItem[]): number {
  const required = checklist.filter((item) => item.required);
  if (required.length === 0) return 100;
  return Math.round((required.filter((item) => item.done).length / required.length) * 100);
}

