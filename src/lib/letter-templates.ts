/**
 * Bibliothèque de courriers types prédéfinis pour la gestion immobilière.
 * Chaque modèle utilise des variables {{NOM_VARIABLE}} remplacées à la génération.
 */

export interface LetterTemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: LetterCategory;
  subject: string;
  bodyHtml: string;
  variables: LetterVariable[];
}

export interface LetterVariable {
  key: string;
  label: string;
  type: "text" | "date" | "currency" | "number" | "textarea";
  required: boolean;
  autoFill?: "society_name" | "society_address" | "society_siret" | "today" | "tenant_name" | "tenant_address" | "lot_address" | "lease_start" | "lease_end" | "rent_amount" | "charges_amount";
  placeholder?: string;
}

export type LetterCategory =
  | "loyer"
  | "bail"
  | "charges"
  | "travaux"
  | "assurance"
  | "administratif";

export const LETTER_CATEGORIES: { value: LetterCategory; label: string; description: string }[] = [
  { value: "loyer", label: "Loyer et paiements", description: "Quittances, relances, mises en demeure" },
  { value: "bail", label: "Bail et occupation", description: "Congés, renouvellement, révision" },
  { value: "charges", label: "Charges et régularisation", description: "Régularisation, appel de charges" },
  { value: "travaux", label: "Travaux et entretien", description: "Avis de travaux, demande d'entretien" },
  { value: "assurance", label: "Assurance", description: "Demande d'attestation, sinistre" },
  { value: "administratif", label: "Administratif", description: "Attestations, certificats divers" },
];

// ── Variables communes ──────────────────────────────────────────

const VAR_BAILLEUR_NOM: LetterVariable = { key: "BAILLEUR_NOM", label: "Nom du bailleur", type: "text", required: true, autoFill: "society_name" };
const VAR_BAILLEUR_ADRESSE: LetterVariable = { key: "BAILLEUR_ADRESSE", label: "Adresse du bailleur", type: "text", required: true, autoFill: "society_address" };
const VAR_LOCATAIRE_NOM: LetterVariable = { key: "LOCATAIRE_NOM", label: "Nom du locataire", type: "text", required: true, autoFill: "tenant_name" };
const VAR_LOCATAIRE_ADRESSE: LetterVariable = { key: "LOCATAIRE_ADRESSE", label: "Adresse du locataire", type: "text", required: true, autoFill: "tenant_address" };
const VAR_BIEN_ADRESSE: LetterVariable = { key: "BIEN_ADRESSE", label: "Adresse du bien", type: "text", required: true, autoFill: "lot_address" };
const VAR_DATE: LetterVariable = { key: "DATE", label: "Date du courrier", type: "date", required: true, autoFill: "today" };
const VAR_LIEU: LetterVariable = { key: "LIEU", label: "Lieu", type: "text", required: true, placeholder: "Paris" };

// ── Modèles prédéfinis ──────────────────────────────────────────

export const BUILTIN_TEMPLATES: LetterTemplateDefinition[] = [
  // ── LOYER ──
  {
    id: "quittance_loyer",
    name: "Quittance de loyer",
    description: "Atteste le paiement du loyer et des charges pour une période donnée.",
    category: "loyer",
    subject: "Quittance de loyer",
    variables: [
      VAR_BAILLEUR_NOM, VAR_BAILLEUR_ADRESSE, VAR_LOCATAIRE_NOM, VAR_LOCATAIRE_ADRESSE, VAR_BIEN_ADRESSE, VAR_DATE, VAR_LIEU,
      { key: "PERIODE", label: "Période (ex: mars 2026)", type: "text", required: true, placeholder: "mars 2026" },
      { key: "LOYER_MONTANT", label: "Montant du loyer (hors charges)", type: "currency", required: true, autoFill: "rent_amount" },
      { key: "CHARGES_MONTANT", label: "Montant des charges", type: "currency", required: true, autoFill: "charges_amount" },
      { key: "TOTAL_MONTANT", label: "Total (loyer + charges)", type: "currency", required: true },
      { key: "DATE_PAIEMENT", label: "Date du paiement", type: "date", required: true },
    ],
    bodyHtml: `<p><strong>QUITTANCE DE LOYER</strong></p>
<p>Je soussigné(e) {{BAILLEUR_NOM}}, bailleur du logement situé au {{BIEN_ADRESSE}}, déclare avoir reçu de {{LOCATAIRE_NOM}} la somme de {{TOTAL_MONTANT}} au titre du loyer et des charges pour la période de {{PERIODE}}, et lui en donne quittance, sous réserve de tous mes droits.</p>
<p><strong>Détail du règlement :</strong></p>
<ul>
<li>Loyer : {{LOYER_MONTANT}}</li>
<li>Charges : {{CHARGES_MONTANT}}</li>
<li>Total : {{TOTAL_MONTANT}}</li>
</ul>
<p>Date du paiement : {{DATE_PAIEMENT}}</p>
<p>Cette quittance annule tous les reçus qui auraient pu être établis précédemment en cas de paiement partiel du loyer.</p>`,
  },
  {
    id: "relance_amiable",
    name: "Relance amiable",
    description: "Premier rappel courtois en cas de retard de paiement du loyer.",
    category: "loyer",
    subject: "Rappel amiable - Loyer impayé",
    variables: [
      VAR_BAILLEUR_NOM, VAR_BAILLEUR_ADRESSE, VAR_LOCATAIRE_NOM, VAR_LOCATAIRE_ADRESSE, VAR_BIEN_ADRESSE, VAR_DATE, VAR_LIEU,
      { key: "PERIODE_IMPAYEE", label: "Période impayée", type: "text", required: true, placeholder: "mars 2026" },
      { key: "MONTANT_DU", label: "Montant dû", type: "currency", required: true },
      { key: "DATE_ECHEANCE", label: "Date d'échéance initiale", type: "date", required: true },
    ],
    bodyHtml: `<p>Objet : Rappel amiable — Loyer impayé</p>
<p>Madame, Monsieur,</p>
<p>Sauf erreur de ma part, je constate que le loyer de {{PERIODE_IMPAYEE}} d'un montant de {{MONTANT_DU}}, exigible au {{DATE_ECHEANCE}}, n'a pas été réglé à ce jour pour le logement situé au {{BIEN_ADRESSE}}.</p>
<p>Il s'agit certainement d'un oubli de votre part. Je vous serais reconnaissant(e) de bien vouloir procéder au règlement de cette somme dans les plus brefs délais.</p>
<p>Si toutefois vous rencontrez des difficultés passagères, je vous invite à prendre contact avec moi afin que nous puissions trouver ensemble une solution amiable.</p>
<p>Si ce règlement a été effectué entre-temps, je vous prie de ne pas tenir compte de ce courrier.</p>
<p>Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>`,
  },
  {
    id: "relance_formelle",
    name: "Relance formelle",
    description: "Second rappel plus ferme en cas de persistance du retard de paiement.",
    category: "loyer",
    subject: "Relance formelle - Loyer impayé",
    variables: [
      VAR_BAILLEUR_NOM, VAR_BAILLEUR_ADRESSE, VAR_LOCATAIRE_NOM, VAR_LOCATAIRE_ADRESSE, VAR_BIEN_ADRESSE, VAR_DATE, VAR_LIEU,
      { key: "MONTANT_TOTAL_DU", label: "Montant total dû", type: "currency", required: true },
      { key: "PERIODES_IMPAYEES", label: "Périodes impayées", type: "text", required: true, placeholder: "février et mars 2026" },
      { key: "DELAI_JOURS", label: "Délai accordé (jours)", type: "number", required: true, placeholder: "8" },
    ],
    bodyHtml: `<p>Objet : Relance formelle — Loyer impayé</p>
<p><strong>Lettre recommandée avec accusé de réception</strong></p>
<p>Madame, Monsieur,</p>
<p>Malgré mon précédent courrier, je constate que votre dette locative pour le logement situé au {{BIEN_ADRESSE}} reste impayée.</p>
<p>À ce jour, le montant total de votre dette s'élève à {{MONTANT_TOTAL_DU}} correspondant aux loyers et charges de {{PERIODES_IMPAYEES}}.</p>
<p>Je vous demande de régulariser cette situation dans un délai de {{DELAI_JOURS}} jours à compter de la réception de ce courrier.</p>
<p>À défaut de règlement dans le délai imparti, je me verrai dans l'obligation d'engager une procédure de mise en demeure, conformément aux dispositions légales en vigueur.</p>
<p>Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>`,
  },
  {
    id: "mise_en_demeure",
    name: "Mise en demeure de payer",
    description: "Dernière sommation avant action en justice pour loyers impayés.",
    category: "loyer",
    subject: "Mise en demeure de payer",
    variables: [
      VAR_BAILLEUR_NOM, VAR_BAILLEUR_ADRESSE, VAR_LOCATAIRE_NOM, VAR_LOCATAIRE_ADRESSE, VAR_BIEN_ADRESSE, VAR_DATE, VAR_LIEU,
      { key: "MONTANT_TOTAL_DU", label: "Montant total dû", type: "currency", required: true },
      { key: "PERIODES_IMPAYEES", label: "Détail des périodes", type: "textarea", required: true, placeholder: "Janvier 2026 : 850 EUR\nFévrier 2026 : 850 EUR" },
      { key: "DELAI_JOURS", label: "Délai ultime (jours)", type: "number", required: true, placeholder: "8" },
    ],
    bodyHtml: `<p>Objet : <strong>MISE EN DEMEURE DE PAYER</strong></p>
<p><strong>Lettre recommandée avec accusé de réception</strong></p>
<p>Madame, Monsieur,</p>
<p>Par la présente, je vous mets en demeure de régler, dans un délai de {{DELAI_JOURS}} jours à compter de la réception de ce courrier, la somme de {{MONTANT_TOTAL_DU}} au titre des loyers et charges impayés pour le logement situé au {{BIEN_ADRESSE}}.</p>
<p><strong>Détail de la dette :</strong></p>
<p>{{PERIODES_IMPAYEES}}</p>
<p>Je vous rappelle que conformément aux articles 7 et 24 de la loi n°89-462 du 6 juillet 1989, le paiement du loyer et des charges constitue une obligation essentielle du locataire.</p>
<p>À défaut de règlement dans le délai imparti, je serai contraint(e) de saisir le tribunal compétent aux fins d'obtenir la résiliation du bail et votre expulsion, ainsi que le paiement des sommes dues, majorées des intérêts légaux et des frais de procédure.</p>
<p>Je vous invite également à prendre contact avec les services sociaux de votre commune ou avec la CAF afin d'examiner les aides auxquelles vous pourriez prétendre.</p>
<p>Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>`,
  },

  // ── BAIL ──
  {
    id: "revision_loyer",
    name: "Notification de révision de loyer",
    description: "Informe le locataire de la révision annuelle du loyer selon l'IRL.",
    category: "bail",
    subject: "Révision annuelle du loyer",
    variables: [
      VAR_BAILLEUR_NOM, VAR_BAILLEUR_ADRESSE, VAR_LOCATAIRE_NOM, VAR_LOCATAIRE_ADRESSE, VAR_BIEN_ADRESSE, VAR_DATE, VAR_LIEU,
      { key: "DATE_BAIL", label: "Date de signature du bail", type: "date", required: true, autoFill: "lease_start" },
      { key: "ANCIEN_LOYER", label: "Ancien loyer mensuel", type: "currency", required: true },
      { key: "NOUVEAU_LOYER", label: "Nouveau loyer mensuel", type: "currency", required: true },
      { key: "INDICE_REF", label: "Indice de référence (ex: T4 2025 = 145,47)", type: "text", required: true },
      { key: "INDICE_BASE", label: "Indice de base", type: "text", required: true },
      { key: "DATE_EFFET", label: "Date d'effet de la révision", type: "date", required: true },
    ],
    bodyHtml: `<p>Objet : Notification de révision de loyer</p>
<p>Madame, Monsieur,</p>
<p>Conformément à l'article 17-1 de la loi n°89-462 du 6 juillet 1989 et aux stipulations de votre contrat de location signé le {{DATE_BAIL}} pour le logement situé au {{BIEN_ADRESSE}}, j'ai l'honneur de vous informer de la révision annuelle de votre loyer.</p>
<p><strong>Calcul de la révision :</strong></p>
<ul>
<li>Loyer actuel : {{ANCIEN_LOYER}}</li>
<li>Indice de référence des loyers (IRL) : {{INDICE_REF}}</li>
<li>Indice de base : {{INDICE_BASE}}</li>
<li>Nouveau loyer : {{NOUVEAU_LOYER}}</li>
</ul>
<p>Cette révision prendra effet à compter du {{DATE_EFFET}}.</p>
<p>Je vous prie de bien vouloir prendre note de ce nouveau montant pour vos prochains règlements.</p>
<p>Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>`,
  },
  {
    id: "conge_bailleur_vente",
    name: "Congé du bailleur pour vente",
    description: "Notification au locataire du congé pour vente du bien (6 mois avant échéance).",
    category: "bail",
    subject: "Congé pour vente",
    variables: [
      VAR_BAILLEUR_NOM, VAR_BAILLEUR_ADRESSE, VAR_LOCATAIRE_NOM, VAR_LOCATAIRE_ADRESSE, VAR_BIEN_ADRESSE, VAR_DATE, VAR_LIEU,
      { key: "DATE_FIN_BAIL", label: "Date de fin du bail", type: "date", required: true, autoFill: "lease_end" },
      { key: "PRIX_VENTE", label: "Prix de vente proposé", type: "currency", required: true },
      { key: "SURFACE", label: "Surface du bien (m2)", type: "number", required: true },
      { key: "NOMBRE_PIECES", label: "Nombre de pièces", type: "number", required: true },
    ],
    bodyHtml: `<p>Objet : <strong>Congé pour vente — Article 15-II de la loi du 6 juillet 1989</strong></p>
<p><strong>Lettre recommandée avec accusé de réception</strong></p>
<p>Madame, Monsieur,</p>
<p>Par la présente, je vous notifie mon intention de vendre le logement que vous occupez situé au {{BIEN_ADRESSE}}, conformément à l'article 15-II de la loi n°89-462 du 6 juillet 1989.</p>
<p>Votre bail arrivant à échéance le {{DATE_FIN_BAIL}}, le présent congé prendra effet à cette date.</p>
<p><strong>Description du bien :</strong></p>
<ul>
<li>Adresse : {{BIEN_ADRESSE}}</li>
<li>Surface : {{SURFACE}} m2</li>
<li>Nombre de pièces principales : {{NOMBRE_PIECES}}</li>
</ul>
<p><strong>Conformément à la loi, vous bénéficiez d'un droit de préemption.</strong> Le prix de vente proposé est de {{PRIX_VENTE}}. Vous disposez d'un délai de deux mois à compter de la réception de ce congé pour vous porter acquéreur aux conditions indiquées.</p>
<p>Si vous ne souhaitez pas acquérir le logement, vous devrez le libérer au plus tard le {{DATE_FIN_BAIL}}.</p>
<p>Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>`,
  },
  {
    id: "conge_bailleur_reprise",
    name: "Congé du bailleur pour reprise",
    description: "Notification au locataire du congé pour habiter le bien ou y loger un proche.",
    category: "bail",
    subject: "Congé pour reprise personnelle",
    variables: [
      VAR_BAILLEUR_NOM, VAR_BAILLEUR_ADRESSE, VAR_LOCATAIRE_NOM, VAR_LOCATAIRE_ADRESSE, VAR_BIEN_ADRESSE, VAR_DATE, VAR_LIEU,
      { key: "DATE_FIN_BAIL", label: "Date de fin du bail", type: "date", required: true, autoFill: "lease_end" },
      { key: "BENEFICIAIRE_NOM", label: "Nom du bénéficiaire de la reprise", type: "text", required: true },
      { key: "BENEFICIAIRE_LIEN", label: "Lien de parenté", type: "text", required: true, placeholder: "fils, conjoint, etc." },
    ],
    bodyHtml: `<p>Objet : <strong>Congé pour reprise — Article 15-I de la loi du 6 juillet 1989</strong></p>
<p><strong>Lettre recommandée avec accusé de réception</strong></p>
<p>Madame, Monsieur,</p>
<p>Par la présente, je vous notifie mon intention de reprendre le logement que vous occupez situé au {{BIEN_ADRESSE}}, conformément à l'article 15-I de la loi n°89-462 du 6 juillet 1989.</p>
<p>Le logement est destiné à l'usage d'habitation principale de {{BENEFICIAIRE_NOM}} ({{BENEFICIAIRE_LIEN}}).</p>
<p>Votre bail arrivant à échéance le {{DATE_FIN_BAIL}}, le présent congé prendra effet à cette date. Vous devrez libérer les lieux au plus tard à cette date.</p>
<p>Conformément à la loi, ce congé vous est notifié au moins six mois avant la date d'échéance de votre bail.</p>
<p>Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>`,
  },
  {
    id: "renouvellement_bail",
    name: "Proposition de renouvellement de bail",
    description: "Proposition de renouvellement du bail avec éventuellement de nouvelles conditions.",
    category: "bail",
    subject: "Renouvellement du bail de location",
    variables: [
      VAR_BAILLEUR_NOM, VAR_BAILLEUR_ADRESSE, VAR_LOCATAIRE_NOM, VAR_LOCATAIRE_ADRESSE, VAR_BIEN_ADRESSE, VAR_DATE, VAR_LIEU,
      { key: "DATE_FIN_BAIL", label: "Date de fin du bail actuel", type: "date", required: true, autoFill: "lease_end" },
      { key: "DUREE_RENOUVELLEMENT", label: "Durée du renouvellement (années)", type: "number", required: true, placeholder: "3" },
      { key: "NOUVEAU_LOYER", label: "Nouveau loyer proposé", type: "currency", required: false },
    ],
    bodyHtml: `<p>Objet : Proposition de renouvellement du bail</p>
<p>Madame, Monsieur,</p>
<p>Votre bail de location pour le logement situé au {{BIEN_ADRESSE}} arrive à échéance le {{DATE_FIN_BAIL}}.</p>
<p>J'ai le plaisir de vous proposer le renouvellement de votre bail pour une durée de {{DUREE_RENOUVELLEMENT}} an(s) à compter de la date d'échéance.</p>
<p>Les conditions du bail restent inchangées, à l'exception le cas échéant du montant du loyer qui serait fixé à {{NOUVEAU_LOYER}} conformément aux dispositions légales en vigueur.</p>
<p>Je vous serais reconnaissant(e) de bien vouloir me faire part de votre décision dans les meilleurs délais.</p>
<p>Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>`,
  },

  // ── CHARGES ──
  {
    id: "regularisation_charges",
    name: "Régularisation annuelle des charges",
    description: "Informe le locataire du résultat de la régularisation des charges locatives.",
    category: "charges",
    subject: "Régularisation annuelle des charges locatives",
    variables: [
      VAR_BAILLEUR_NOM, VAR_BAILLEUR_ADRESSE, VAR_LOCATAIRE_NOM, VAR_LOCATAIRE_ADRESSE, VAR_BIEN_ADRESSE, VAR_DATE, VAR_LIEU,
      { key: "ANNEE", label: "Année de régularisation", type: "text", required: true, placeholder: "2025" },
      { key: "PROVISIONS_VERSEES", label: "Total des provisions versées", type: "currency", required: true },
      { key: "CHARGES_REELLES", label: "Total des charges réelles", type: "currency", required: true },
      { key: "SOLDE", label: "Solde (positif = trop-perçu, négatif = complément dû)", type: "currency", required: true },
    ],
    bodyHtml: `<p>Objet : Régularisation des charges locatives — Année {{ANNEE}}</p>
<p>Madame, Monsieur,</p>
<p>Conformément à l'article 23 de la loi n°89-462 du 6 juillet 1989, je procède à la régularisation annuelle des charges locatives pour le logement situé au {{BIEN_ADRESSE}}.</p>
<p><strong>Récapitulatif :</strong></p>
<ul>
<li>Total des provisions versées : {{PROVISIONS_VERSEES}}</li>
<li>Total des charges réelles : {{CHARGES_REELLES}}</li>
<li>Solde : {{SOLDE}}</li>
</ul>
<p>Le détail des charges par nature est tenu à votre disposition. Vous pouvez le consulter sur simple demande pendant un mois à compter de la réception du présent courrier.</p>
<p>Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>`,
  },

  // ── TRAVAUX ──
  {
    id: "avis_travaux",
    name: "Avis de travaux",
    description: "Informe le locataire de travaux à venir dans le logement ou l'immeuble.",
    category: "travaux",
    subject: "Avis de travaux",
    variables: [
      VAR_BAILLEUR_NOM, VAR_BAILLEUR_ADRESSE, VAR_LOCATAIRE_NOM, VAR_LOCATAIRE_ADRESSE, VAR_BIEN_ADRESSE, VAR_DATE, VAR_LIEU,
      { key: "NATURE_TRAVAUX", label: "Nature des travaux", type: "textarea", required: true, placeholder: "Remplacement de la chaudière collective" },
      { key: "DATE_DEBUT", label: "Date de début des travaux", type: "date", required: true },
      { key: "DUREE_ESTIMEE", label: "Durée estimée", type: "text", required: true, placeholder: "2 semaines" },
    ],
    bodyHtml: `<p>Objet : Avis de travaux</p>
<p>Madame, Monsieur,</p>
<p>Je vous informe que des travaux vont être réalisés dans le logement/l'immeuble situé au {{BIEN_ADRESSE}}.</p>
<p><strong>Nature des travaux :</strong> {{NATURE_TRAVAUX}}</p>
<p><strong>Date de début :</strong> {{DATE_DEBUT}}</p>
<p><strong>Durée estimée :</strong> {{DUREE_ESTIMEE}}</p>
<p>Conformément à l'article 7e de la loi du 6 juillet 1989, je vous rappelle que le locataire est tenu de permettre l'accès au logement pour la préparation et l'exécution des travaux d'amélioration ou d'entretien.</p>
<p>Je vous remercie de votre compréhension et reste à votre disposition pour toute question.</p>
<p>Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>`,
  },
  {
    id: "demande_entretien",
    name: "Demande d'entretien annuel",
    description: "Rappelle au locataire son obligation d'entretien annuel (chaudière, etc.).",
    category: "travaux",
    subject: "Rappel - Entretien annuel obligatoire",
    variables: [
      VAR_BAILLEUR_NOM, VAR_BAILLEUR_ADRESSE, VAR_LOCATAIRE_NOM, VAR_LOCATAIRE_ADRESSE, VAR_BIEN_ADRESSE, VAR_DATE, VAR_LIEU,
      { key: "EQUIPEMENT", label: "Équipement concerné", type: "text", required: true, placeholder: "chaudière à gaz" },
      { key: "DATE_LIMITE", label: "Date limite de transmission de l'attestation", type: "date", required: true },
    ],
    bodyHtml: `<p>Objet : Rappel — Entretien annuel obligatoire</p>
<p>Madame, Monsieur,</p>
<p>Je vous rappelle que, conformément au décret n°2009-649 du 9 juin 2009 et aux stipulations de votre bail, l'entretien annuel de votre {{EQUIPEMENT}} est à votre charge.</p>
<p>Je vous demande de bien vouloir faire procéder à cet entretien et de me transmettre l'attestation correspondante avant le {{DATE_LIMITE}}.</p>
<p>À défaut de réception de ce justificatif dans le délai imparti, je me réserve le droit de faire procéder à cet entretien à vos frais, conformément aux dispositions du bail.</p>
<p>Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>`,
  },

  // ── ASSURANCE ──
  {
    id: "demande_attestation_assurance",
    name: "Demande d'attestation d'assurance",
    description: "Demande au locataire de fournir son attestation d'assurance habitation.",
    category: "assurance",
    subject: "Demande d'attestation d'assurance habitation",
    variables: [
      VAR_BAILLEUR_NOM, VAR_BAILLEUR_ADRESSE, VAR_LOCATAIRE_NOM, VAR_LOCATAIRE_ADRESSE, VAR_BIEN_ADRESSE, VAR_DATE, VAR_LIEU,
      { key: "DATE_LIMITE", label: "Date limite de transmission", type: "date", required: true },
    ],
    bodyHtml: `<p>Objet : Demande d'attestation d'assurance habitation</p>
<p>Madame, Monsieur,</p>
<p>Conformément à l'article 7g de la loi n°89-462 du 6 juillet 1989, le locataire est tenu de s'assurer contre les risques locatifs (incendie, dégât des eaux, explosion) et de justifier de cette assurance lors de la remise des clés puis chaque année à la demande du bailleur.</p>
<p>Je vous demande de bien vouloir me transmettre votre attestation d'assurance habitation en cours de validité pour le logement situé au {{BIEN_ADRESSE}} avant le {{DATE_LIMITE}}.</p>
<p>À défaut de justification dans un délai d'un mois suivant la réception de ce courrier, je me réserve le droit de résilier le bail conformément aux dispositions légales, ou de souscrire une assurance pour votre compte dont le montant vous sera refacturé.</p>
<p>Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>`,
  },

  // ── ADMINISTRATIF ──
  {
    id: "attestation_loyer_caf",
    name: "Attestation de loyer (CAF)",
    description: "Attestation destinée à la CAF pour le calcul des aides au logement.",
    category: "administratif",
    subject: "Attestation de loyer",
    variables: [
      VAR_BAILLEUR_NOM, VAR_BAILLEUR_ADRESSE, VAR_LOCATAIRE_NOM, VAR_LOCATAIRE_ADRESSE, VAR_BIEN_ADRESSE, VAR_DATE, VAR_LIEU,
      { key: "LOYER_MONTANT", label: "Montant du loyer mensuel (hors charges)", type: "currency", required: true, autoFill: "rent_amount" },
      { key: "CHARGES_MONTANT", label: "Montant des charges mensuelles", type: "currency", required: true, autoFill: "charges_amount" },
      { key: "DATE_ENTREE", label: "Date d'entrée dans le logement", type: "date", required: true, autoFill: "lease_start" },
      { key: "TYPE_LOGEMENT", label: "Type de logement", type: "text", required: true, placeholder: "Appartement T3" },
    ],
    bodyHtml: `<p><strong>ATTESTATION DE LOYER</strong></p>
<p>Je soussigné(e) {{BAILLEUR_NOM}}, demeurant au {{BAILLEUR_ADRESSE}}, certifie que :</p>
<p>{{LOCATAIRE_NOM}}, demeurant au {{BIEN_ADRESSE}}, est locataire d'un logement de type {{TYPE_LOGEMENT}} depuis le {{DATE_ENTREE}}.</p>
<p><strong>Conditions financières :</strong></p>
<ul>
<li>Loyer mensuel hors charges : {{LOYER_MONTANT}}</li>
<li>Charges mensuelles : {{CHARGES_MONTANT}}</li>
</ul>
<p>La présente attestation est établie pour servir et valoir ce que de droit, notamment auprès de la Caisse d'Allocations Familiales.</p>
<p>Fait pour servir et valoir ce que de droit.</p>`,
  },
  {
    id: "attestation_hebergement",
    name: "Attestation d'hébergement",
    description: "Atteste qu'une personne est hébergée dans le logement.",
    category: "administratif",
    subject: "Attestation d'hébergement",
    variables: [
      VAR_BAILLEUR_NOM, VAR_BAILLEUR_ADRESSE, VAR_LOCATAIRE_NOM, VAR_BIEN_ADRESSE, VAR_DATE, VAR_LIEU,
      { key: "HEBERGE_NOM", label: "Nom de la personne hébergée", type: "text", required: true },
      { key: "HEBERGE_DATE_NAISSANCE", label: "Date de naissance de l'hébergé(e)", type: "date", required: true },
      { key: "DATE_DEBUT_HEBERGEMENT", label: "Date de début d'hébergement", type: "date", required: true },
    ],
    bodyHtml: `<p><strong>ATTESTATION D'HÉBERGEMENT</strong></p>
<p>Je soussigné(e) {{LOCATAIRE_NOM}}, demeurant au {{BIEN_ADRESSE}}, certifie sur l'honneur héberger à mon domicile :</p>
<p>{{HEBERGE_NOM}}, né(e) le {{HEBERGE_DATE_NAISSANCE}}, depuis le {{DATE_DEBUT_HEBERGEMENT}}.</p>
<p>Fait pour servir et valoir ce que de droit.</p>`,
  },
  {
    id: "courrier_libre",
    name: "Courrier libre",
    description: "Rédigez un courrier personnalisé avec mise en page professionnelle.",
    category: "administratif",
    subject: "Courrier",
    variables: [
      VAR_BAILLEUR_NOM, VAR_BAILLEUR_ADRESSE, VAR_LOCATAIRE_NOM, VAR_LOCATAIRE_ADRESSE, VAR_DATE, VAR_LIEU,
      { key: "OBJET", label: "Objet du courrier", type: "text", required: true },
      { key: "CORPS", label: "Corps du courrier", type: "textarea", required: true },
    ],
    bodyHtml: `<p>Objet : {{OBJET}}</p>
<p>Madame, Monsieur,</p>
<p>{{CORPS}}</p>
<p>Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>`,
  },
];

/**
 * Remplace les variables {{CLE}} dans le HTML par les valeurs fournies.
 */
export function interpolateTemplate(bodyHtml: string, values: Record<string, string>): string {
  let result = bodyHtml;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}
