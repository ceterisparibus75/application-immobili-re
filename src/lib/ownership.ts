/**
 * Démembrement de propriété — helpers purs (sans accès Prisma).
 *
 * Modélise la quote-part de chaque propriétaire sur un lot et applique les
 * règles civiles/fiscales de ventilation des flux financiers entre usufruitier
 * et nu-propriétaire (Code civil art. 605, 606, 608 ; CGI art. 669).
 */

export type OwnershipType = "PLEINE_PROPRIETE" | "USUFRUIT" | "NUE_PROPRIETE";

export interface OwnershipShare {
  proprietaireId: string;
  type: OwnershipType;
  share: number;
  startDate: Date;
  endDate: Date | null;
  isViager?: boolean;
  usufruitierBirthDate?: Date | null;
}

/**
 * Catégorie d'imputation pour la ventilation usufruit / nue-propriété.
 *
 * - REVENU : loyer, indemnités d'occupation, subventions → usufruitier
 * - CHARGE_COURANTE : charges récupérables, petites réparations, énergie → usufruitier
 * - TAXE_FONCIERE : par défaut usufruitier (art. 608 CC, sauf convention)
 * - ASSURANCE : par défaut usufruitier
 * - HONORAIRES_GESTION : usufruitier (charge des revenus qu'il perçoit)
 * - GROS_TRAVAUX : art. 606 CC → nu-propriétaire (gros murs, voûtes, charpentes, toitures, clôtures)
 * - ACQUISITION : nu-propriétaire (élément de la valeur du bien démembré)
 * - INDEMNITE_ASSURANCE_CAPITAL : nu-propriétaire (subrogation du bien)
 */
export type CashflowImputation =
  | "REVENU"
  | "CHARGE_COURANTE"
  | "TAXE_FONCIERE"
  | "ASSURANCE"
  | "HONORAIRES_GESTION"
  | "GROS_TRAVAUX"
  | "ACQUISITION"
  | "INDEMNITE_ASSURANCE_CAPITAL";

/**
 * Rôle d'un bénéficiaire ou payeur dans une ventilation.
 */
export type BeneficiaryRole = "PLEIN_PROPRIETAIRE" | "USUFRUITIER" | "NU_PROPRIETAIRE";

export interface AllocationLine {
  proprietaireId: string;
  role: BeneficiaryRole;
  /** Montant alloué (toujours positif, signe porté par la nature du flux côté appelant) */
  amount: number;
  /** Quote-part appliquée (0..1) */
  share: number;
}

// ─── État du démembrement à une date donnée ──────────────────────────────────

/**
 * Filtre les quote-parts actives à une date donnée.
 * Une part est active si `startDate <= date && (endDate === null || endDate > date)`.
 */
export function getOwnershipAt(ownerships: OwnershipShare[], date: Date): OwnershipShare[] {
  const t = date.getTime();
  return ownerships.filter((o) => {
    if (o.startDate.getTime() > t) return false;
    if (o.endDate !== null && o.endDate.getTime() <= t) return false;
    return true;
  });
}

export interface OwnershipSnapshot {
  full: OwnershipShare[]; // PLEINE_PROPRIETE
  usufruit: OwnershipShare[];
  nuePropriete: OwnershipShare[];
  isDismembered: boolean;
}

export function snapshotOwnership(ownerships: OwnershipShare[], date: Date): OwnershipSnapshot {
  const active = getOwnershipAt(ownerships, date);
  const full = active.filter((o) => o.type === "PLEINE_PROPRIETE");
  const usufruit = active.filter((o) => o.type === "USUFRUIT");
  const nuePropriete = active.filter((o) => o.type === "NUE_PROPRIETE");
  return {
    full,
    usufruit,
    nuePropriete,
    isDismembered: usufruit.length > 0 || nuePropriete.length > 0,
  };
}

// ─── Validation des quote-parts ──────────────────────────────────────────────

const SHARE_TOLERANCE = 0.001;

export interface OwnershipValidationIssue {
  code:
    | "TOTAL_PLEINE_PROPRIETE_NOT_ONE"
    | "TOTAL_USUFRUIT_NOT_ONE"
    | "TOTAL_NUE_PROPRIETE_NOT_ONE"
    | "MIXED_PP_AND_DEMEMBREMENT"
    | "USUFRUIT_WITHOUT_NUE_PROPRIETE"
    | "NUE_PROPRIETE_WITHOUT_USUFRUIT"
    | "SHARE_OUT_OF_RANGE";
  message: string;
}

/**
 * Vérifie la cohérence des quote-parts à une date donnée.
 * Règles :
 *  - Soit pleine propriété (somme = 1), soit démembrement (US sum = 1 ET NP sum = 1)
 *  - Pas de mélange PP + US/NP sur la même date
 *  - Toutes les parts sont dans [0, 1]
 */
export function validateOwnership(ownerships: OwnershipShare[], date: Date): OwnershipValidationIssue[] {
  const issues: OwnershipValidationIssue[] = [];
  const snap = snapshotOwnership(ownerships, date);

  for (const o of [...snap.full, ...snap.usufruit, ...snap.nuePropriete]) {
    if (o.share < 0 || o.share > 1) {
      issues.push({
        code: "SHARE_OUT_OF_RANGE",
        message: `Quote-part hors plage [0,1] : ${o.share} pour ${o.proprietaireId}`,
      });
    }
  }

  const sumFull = sumShare(snap.full);
  const sumUs = sumShare(snap.usufruit);
  const sumNp = sumShare(snap.nuePropriete);

  if (snap.full.length > 0 && (snap.usufruit.length > 0 || snap.nuePropriete.length > 0)) {
    issues.push({
      code: "MIXED_PP_AND_DEMEMBREMENT",
      message: "Pleine propriété et démembrement coexistent sur la même période",
    });
  }

  if (snap.full.length > 0 && !approxEqual(sumFull, 1)) {
    issues.push({
      code: "TOTAL_PLEINE_PROPRIETE_NOT_ONE",
      message: `Somme des quote-parts en pleine propriété = ${sumFull}, attendu 1`,
    });
  }

  if (snap.usufruit.length > 0 && snap.nuePropriete.length === 0) {
    issues.push({
      code: "NUE_PROPRIETE_WITHOUT_USUFRUIT",
      message: "Usufruit déclaré sans nue-propriété correspondante",
    });
  }

  if (snap.nuePropriete.length > 0 && snap.usufruit.length === 0) {
    issues.push({
      code: "USUFRUIT_WITHOUT_NUE_PROPRIETE",
      message: "Nue-propriété déclarée sans usufruit correspondant",
    });
  }

  if (snap.usufruit.length > 0 && !approxEqual(sumUs, 1)) {
    issues.push({
      code: "TOTAL_USUFRUIT_NOT_ONE",
      message: `Somme des quote-parts d'usufruit = ${sumUs}, attendu 1`,
    });
  }

  if (snap.nuePropriete.length > 0 && !approxEqual(sumNp, 1)) {
    issues.push({
      code: "TOTAL_NUE_PROPRIETE_NOT_ONE",
      message: `Somme des quote-parts de nue-propriété = ${sumNp}, attendu 1`,
    });
  }

  return issues;
}

// ─── Ventilation des flux ────────────────────────────────────────────────────

/**
 * Définit, pour chaque catégorie d'imputation, qui supporte/perçoit le flux
 * lorsqu'il y a démembrement. Ces règles peuvent être surchargées par
 * convention (à gérer côté caller).
 */
const DEFAULT_BENEFICIARY: Record<CashflowImputation, BeneficiaryRole> = {
  REVENU: "USUFRUITIER",
  CHARGE_COURANTE: "USUFRUITIER",
  TAXE_FONCIERE: "USUFRUITIER",
  ASSURANCE: "USUFRUITIER",
  HONORAIRES_GESTION: "USUFRUITIER",
  GROS_TRAVAUX: "NU_PROPRIETAIRE",
  ACQUISITION: "NU_PROPRIETAIRE",
  INDEMNITE_ASSURANCE_CAPITAL: "NU_PROPRIETAIRE",
};

export function defaultBeneficiaryFor(imputation: CashflowImputation): BeneficiaryRole {
  return DEFAULT_BENEFICIARY[imputation];
}

export interface AllocateOptions {
  /** Force un bénéficiaire (override de la règle par défaut). */
  forceRole?: BeneficiaryRole;
  /** Convention de partage : { usufruitier: 0.7, nuProprietaire: 0.3 } par exemple. Somme attendue = 1. */
  conventionnelSplit?: { usufruitier: number; nuProprietaire: number };
}

/**
 * Ventile un montant entre les ayants droit selon la situation à la date donnée.
 * Retour : un tableau d'allocations (une par bénéficiaire effectif).
 *
 * Cas couverts :
 *  - Pleine propriété (avec indivision) : ventilation au prorata des `share`.
 *  - Démembrement : selon `imputation` (ou `forceRole`), allocation côté US ou NP.
 *  - Convention de partage : si fournie, déroge à la règle par défaut et répartit
 *    entre US et NP selon les ratios donnés.
 */
export function allocateAmount(
  amount: number,
  imputation: CashflowImputation,
  ownerships: OwnershipShare[],
  date: Date,
  options: AllocateOptions = {},
): AllocationLine[] {
  const snap = snapshotOwnership(ownerships, date);

  if (!snap.isDismembered) {
    return distributeAcross(amount, snap.full, "PLEIN_PROPRIETAIRE");
  }

  if (options.conventionnelSplit) {
    const { usufruitier, nuProprietaire } = options.conventionnelSplit;
    const total = usufruitier + nuProprietaire;
    if (!approxEqual(total, 1)) {
      throw new Error(`conventionnelSplit doit sommer à 1, reçu ${total}`);
    }
    return [
      ...distributeAcross(amount * usufruitier, snap.usufruit, "USUFRUITIER"),
      ...distributeAcross(amount * nuProprietaire, snap.nuePropriete, "NU_PROPRIETAIRE"),
    ];
  }

  const role = options.forceRole ?? defaultBeneficiaryFor(imputation);

  if (role === "USUFRUITIER") {
    return distributeAcross(amount, snap.usufruit, "USUFRUITIER");
  }
  if (role === "NU_PROPRIETAIRE") {
    return distributeAcross(amount, snap.nuePropriete, "NU_PROPRIETAIRE");
  }
  // PLEIN_PROPRIETAIRE forcé mais aucune part PP active : fallback sur US
  // (cas inattendu — appelant a forcé un rôle incohérent avec l'état).
  return distributeAcross(amount, snap.usufruit, "USUFRUITIER");
}

function distributeAcross(amount: number, parts: OwnershipShare[], role: BeneficiaryRole): AllocationLine[] {
  if (parts.length === 0) return [];
  const totalShare = sumShare(parts);
  if (totalShare === 0) return [];
  return parts.map((p) => ({
    proprietaireId: p.proprietaireId,
    role,
    amount: round2(amount * (p.share / totalShare)),
    share: p.share / totalShare,
  }));
}

// ─── Barème art. 669 CGI ─────────────────────────────────────────────────────

/**
 * Barème de l'article 669 du Code général des impôts pour la valorisation
 * fiscale de l'usufruit viager en fonction de l'âge de l'usufruitier.
 *
 * `usufruitFraction` = fraction de la valeur en pleine propriété attribuée à l'US.
 * `nuePropertyFraction` = 1 - usufruitFraction.
 */
export interface Article669Values {
  usufruitFraction: number;
  nuePropertyFraction: number;
  usufruitValue: number;
  nuePropertyValue: number;
  age: number;
}

const ARTICLE_669_BRACKETS: Array<{ maxAge: number; usufruit: number }> = [
  { maxAge: 20, usufruit: 0.9 },
  { maxAge: 30, usufruit: 0.8 },
  { maxAge: 40, usufruit: 0.7 },
  { maxAge: 50, usufruit: 0.6 },
  { maxAge: 60, usufruit: 0.5 },
  { maxAge: 70, usufruit: 0.4 },
  { maxAge: 80, usufruit: 0.3 },
  { maxAge: 90, usufruit: 0.2 },
  { maxAge: Infinity, usufruit: 0.1 },
];

export function article669Fraction(age: number): number {
  if (age < 0) throw new Error(`Âge négatif : ${age}`);
  // « jusqu'à 20 ans révolus » = âge ≤ 20, etc. — bornes inclusives hautes.
  const bracket = ARTICLE_669_BRACKETS.find((b) => age <= b.maxAge);
  // Le dernier bracket a maxAge=Infinity donc find() trouve toujours un résultat.
  return bracket!.usufruit;
}

export function computeArticle669Values(valeurPleinePropriete: number, usufruitierAge: number): Article669Values {
  const usufruitFraction = article669Fraction(usufruitierAge);
  const nuePropertyFraction = 1 - usufruitFraction;
  return {
    usufruitFraction,
    nuePropertyFraction,
    usufruitValue: round2(valeurPleinePropriete * usufruitFraction),
    nuePropertyValue: round2(valeurPleinePropriete * nuePropertyFraction),
    age: usufruitierAge,
  };
}

/**
 * Calcule l'âge atteint à la date `at` à partir d'une date de naissance.
 */
export function ageAt(birthDate: Date, at: Date): number {
  let age = at.getFullYear() - birthDate.getFullYear();
  const monthDiff = at.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function sumShare(parts: OwnershipShare[]): number {
  return parts.reduce((acc, p) => acc + p.share, 0);
}

function approxEqual(a: number, b: number, tol = SHARE_TOLERANCE): boolean {
  return Math.abs(a - b) <= tol;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
