/**
 * Normalise un libellé bancaire pour faciliter la comparaison :
 * minuscules, suppression des accents, espaces multiples, chiffres,
 * dates (JJ/MM/AAAA), références alphanumériques longues.
 * Utilisé par le module cash-flow (catégorisation, auto-tags) et les imports bancaires.
 */
export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")       // accents
    .replace(/\d{2}\/\d{2}\/\d{4}/g, "")   // dates JJ/MM/AAAA
    .replace(/\d{2}-\d{2}-\d{4}/g, "")     // dates JJ-MM-AAAA
    .replace(/\b[a-z0-9]{10,}\b/g, "")     // refs longues (ex: SEPA IDs)
    .replace(/[^a-z\s]/g, " ")             // ponctuation → espace
    .replace(/\s+/g, " ")                  // espaces multiples
    .trim();
}
