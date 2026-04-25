export type GuidanceStep = {
  title: string;
  description: string;
  href: string;
  action: string;
};

type LocationGuidanceInput = {
  activeLeases: number;
  activeTenants: number;
  lateInvoices: number;
  openTickets: number;
};

type FinancesGuidanceInput = {
  bankAccounts: number;
  draftEntries: number;
  unpaidInvoices: number;
};

export function getLocationGuidance({
  activeLeases,
  activeTenants,
  lateInvoices,
  openTickets,
}: LocationGuidanceInput): GuidanceStep[] {
  const steps: GuidanceStep[] = [];

  if (activeTenants === 0) {
    steps.push({
      title: "Ajouter le premier locataire",
      description: "Créez la fiche locataire avant de rattacher le bail et les documents.",
      href: "/locataires/nouveau",
      action: "Ajouter un locataire",
    });
  }

  if (activeLeases === 0) {
    steps.push({
      title: "Créer ou importer un bail",
      description: "Démarrez depuis un formulaire guidé ou importez le PDF signé.",
      href: "/baux/nouveau",
      action: "Préparer un bail",
    });
  } else {
    steps.push({
      title: "Générer les appels de loyers",
      description: "Transformez les baux actifs en factures prêtes à envoyer.",
      href: "/facturation/generer",
      action: "Générer les appels",
    });
  }

  if (lateInvoices > 0) {
    steps.push({
      title: "Traiter les impayés",
      description: "Priorisez les factures en retard ou partiellement payées.",
      href: "/facturation?tab=retard",
      action: "Voir les retards",
    });
  }

  if (openTickets > 0) {
    steps.push({
      title: "Répondre aux demandes",
      description: "Passez en revue les tickets ouverts avant qu'ils ne s'accumulent.",
      href: "/tickets",
      action: "Voir les tickets",
    });
  }

  return steps.slice(0, 3);
}

export function getFinancesGuidance({
  bankAccounts,
  draftEntries,
  unpaidInvoices,
}: FinancesGuidanceInput): GuidanceStep[] {
  const steps: GuidanceStep[] = [];

  if (bankAccounts === 0) {
    steps.push(
      {
        title: "Ajouter un compte bancaire",
        description: "Centralisez le solde et préparez le rapprochement des encaissements.",
        href: "/banque/nouveau-compte",
        action: "Ajouter un compte",
      },
      {
        title: "Connecter la banque",
        description: "Activez la synchronisation automatique des transactions quand la banque est disponible.",
        href: "/banque/connexion",
        action: "Connecter une banque",
      },
    );
  } else {
    steps.push({
      title: "Rapprocher les mouvements",
      description: "Associez les transactions bancaires aux factures, paiements et écritures.",
      href: "/banque",
      action: "Ouvrir la banque",
    });
  }

  if (draftEntries > 0) {
    steps.push({
      title: "Valider les écritures brouillon",
      description: "Finalisez les écritures préparées pour garder la comptabilité exploitable.",
      href: "/comptabilite",
      action: "Voir les écritures",
    });
  } else {
    steps.push({
      title: "Saisir une écriture",
      description: "Ajoutez une première écriture comptable hors flux automatisé.",
      href: "/comptabilite/nouvelle-ecriture",
      action: "Nouvelle écriture",
    });
  }

  if (unpaidInvoices > 0) {
    steps.push({
      title: "Suivre les factures à encaisser",
      description: "Gardez les encaissements ouverts visibles depuis le pilotage financier.",
      href: "/facturation?tab=retard",
      action: "Voir les factures",
    });
  }

  return steps.slice(0, 3);
}
