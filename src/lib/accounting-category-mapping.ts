import { ALL_CATEGORIES, type CashflowCategoryId } from "@/lib/cashflow-categories";

export type AccountingAccountFallback = {
  code: string;
  label: string;
  type: string;
};

export type CashflowAccountingMapping = AccountingAccountFallback & {
  category: CashflowCategoryId;
};

const CATEGORY_IDS = new Set<string>(ALL_CATEGORIES.map((category) => category.id));

export const CASHFLOW_ACCOUNTING_MAPPINGS: Record<CashflowCategoryId, AccountingAccountFallback> = {
  loyers: { code: "706100", label: "Loyers", type: "7" },
  charges_locatives: { code: "708100", label: "Charges locatives refacturées", type: "7" },
  regularisation: { code: "758000", label: "Produits divers de gestion courante", type: "7" },
  autres_revenus: { code: "758000", label: "Produits divers de gestion courante", type: "7" },
  depot_garantie: { code: "165000", label: "Dépôts et cautionnements reçus", type: "1" },
  cession_immeuble: { code: "775000", label: "Produits des cessions d'éléments d'actif", type: "7" },

  charges_copro: { code: "614000", label: "Charges locatives et de copropriété", type: "6" },
  assurance: { code: "616000", label: "Primes d'assurance", type: "6" },
  entretien_courant: { code: "615000", label: "Entretien et réparations", type: "6" },
  taxes: { code: "635000", label: "Autres impôts et taxes", type: "6" },
  frais_bancaires: { code: "627000", label: "Services bancaires et assimilés", type: "6" },
  interets_emprunt: { code: "661100", label: "Intérêts des emprunts", type: "6" },
  remboursement_emprunt: { code: "164000", label: "Emprunts auprès des établissements de crédit", type: "1" },
  honoraires: { code: "622000", label: "Rémunérations d'intermédiaires et honoraires", type: "6" },
  energie: { code: "606100", label: "Fournitures non stockables - eau, énergie", type: "6" },
  fournitures: { code: "606300", label: "Fournitures d'entretien et de petit équipement", type: "6" },
  frais_gestion: { code: "622000", label: "Rémunérations d'intermédiaires et honoraires", type: "6" },
  divers_depense: { code: "658000", label: "Charges diverses de gestion courante", type: "6" },
  travaux: { code: "615000", label: "Entretien et réparations", type: "6" },
  acquisition_immeuble: { code: "213000", label: "Constructions", type: "2" },

  virement_interne: { code: "580000", label: "Virements internes", type: "5" },
  apport_cca: { code: "455000", label: "Associés - comptes courants", type: "4" },
  remboursement_cca: { code: "455000", label: "Associés - comptes courants", type: "4" },
  souscription_emprunt: { code: "164000", label: "Emprunts auprès des établissements de crédit", type: "1" },
};

export function getAccountingFallbackForCashflowCategory(
  category: string | null | undefined
): AccountingAccountFallback | null {
  if (!category || !CATEGORY_IDS.has(category)) return null;
  return CASHFLOW_ACCOUNTING_MAPPINGS[category as CashflowCategoryId] ?? null;
}

// ============================================================================
// Resolver configurable — tient compte des mappings personnalisés par société
// ============================================================================

/**
 * Snapshot minimal d'un mapping utilisateur, tel que lu en base.
 * Volontairement pur / sans dépendance Prisma pour rester testable.
 */
export type AccountingCategoryMappingRecord = {
  cashflowCategoryId: string | null;
  keyword: string | null;
  accountCode: string;
  accountLabel: string | null;
};

function normalizeKeyword(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Résout le compte PCG à utiliser pour une catégorie donnée, dans l'ordre :
 *   1. Mapping utilisateur par `cashflowCategoryId` (si présent)
 *   2. Mapping utilisateur par `keyword` (match insensible sur le nom)
 *   3. Fallback hard-codé historique (`CASHFLOW_ACCOUNTING_MAPPINGS`)
 *
 * Fonction pure — les mappings sont fournis en argument. Les call sites
 * doivent les charger depuis la base (`prisma.accountingCategoryMapping`).
 */
export function resolveAccountForCategory(
  mappings: ReadonlyArray<AccountingCategoryMappingRecord> | null | undefined,
  cashflowCategoryId: string | null | undefined,
  categoryName: string | null | undefined
): AccountingAccountFallback | null {
  const safeMappings: ReadonlyArray<AccountingCategoryMappingRecord> =
    Array.isArray(mappings) ? mappings : [];

  // 1. Lookup par ID de catégorie cashflow.
  if (cashflowCategoryId) {
    const direct = safeMappings.find((m) => m.cashflowCategoryId === cashflowCategoryId);
    if (direct) {
      return {
        code: direct.accountCode,
        label: direct.accountLabel ?? direct.accountCode,
        type: direct.accountCode.slice(0, 1),
      };
    }
  }

  // 2. Lookup par mot-clé sur le nom lisible de la catégorie.
  if (categoryName) {
    const haystack = normalizeKeyword(categoryName);
    const byKeyword = safeMappings.find((m) => {
      if (!m.keyword) return false;
      const needle = normalizeKeyword(m.keyword);
      return needle.length > 0 && haystack.includes(needle);
    });
    if (byKeyword) {
      return {
        code: byKeyword.accountCode,
        label: byKeyword.accountLabel ?? byKeyword.accountCode,
        type: byKeyword.accountCode.slice(0, 1),
      };
    }
  }

  // 3. Fallback hard-codé pour compat ascendante.
  return getAccountingFallbackForCashflowCategory(cashflowCategoryId ?? null);
}

/**
 * Variante "fire-and-forget" idéale pour les sites qui veulent déléguer
 * entièrement le chargement : passer `[]` donne le comportement historique.
 */
export function resolveAccountForCashflowCategory(
  mappings: ReadonlyArray<AccountingCategoryMappingRecord>,
  cashflowCategoryId: string | null | undefined
): AccountingAccountFallback | null {
  return resolveAccountForCategory(mappings, cashflowCategoryId ?? null, null);
}

// ============================================================================
// Chargement DB — helper serveur (non "use server")
// ============================================================================

import { prisma } from "@/lib/prisma";

/**
 * Charge les mappings personnalisés d'une société depuis la base.
 *
 * Résilient : si la table n'existe pas encore (DB legacy avant migration),
 * on retombe sur un tableau vide — `resolveAccountForCategory` repartira
 * alors sur le fallback hard-codé.
 */
export async function loadMappingsForSociety(
  societyId: string
): Promise<AccountingCategoryMappingRecord[]> {
  try {
    const rows = await prisma.accountingCategoryMapping.findMany({
      where: { societyId },
      select: {
        cashflowCategoryId: true,
        keyword: true,
        accountCode: true,
        accountLabel: true,
      },
    });
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.error("[loadMappingsForSociety]", error);
    return [];
  }
}
