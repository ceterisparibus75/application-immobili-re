/**
 * Helpers de manipulation de montants monétaires en `Decimal`.
 *
 * Préalable à la migration `Float → Decimal` (lot 1 du plan
 * docs/superpowers/plans/2026-05-11-decimal-migration.md).
 *
 * Pourquoi `Decimal` et pas `number` ?
 * - 0.1 + 0.2 !== 0.3 en JS — risque de centimes faux sur les totaux
 *   de factures, balance comptable, FEC DGFiP.
 * - Prisma 7 retourne `Decimal` (instance de `decimal.js`) pour les
 *   colonnes `Decimal @db.Decimal(...)`. Cette lib expose les opérateurs
 *   arithmétiques sans perte de précision.
 *
 * Convention d'arrondi : *banker's rounding* (ROUND_HALF_EVEN) — c'est
 * l'arrondi attendu par la DGFiP pour le FEC et la TVA. `decimal.js`
 * l'expose via `Decimal.ROUND_HALF_EVEN = 6`.
 *
 * Frontière client/serveur : un `Decimal` n'est pas sérialisable JSON
 * tel quel. Côté frontière (Server Action → Client Component), utilisez
 * `decimalToString()` pour préserver la précision ou `decimalToNumber()`
 * pour les graphes Recharts.
 */

import { Prisma } from "@/generated/prisma/client";

/** Re-export pour faciliter l'import depuis les consumers. */
export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

/** Précision standard pour un montant en euros (2 décimales, max ~999 milliards). */
const MONEY_DECIMALS = 2;
const PERCENT_DECIMALS = 4;

// ─── Conversion ────────────────────────────────────────────────────────────

/**
 * Convertit une entrée hétérogène en `Decimal`. Accepte :
 *  - `number` (ex. depuis un formulaire HTML)
 *  - `string` ("12,34" français ou "12.34")
 *  - `Decimal` existant (passe à travers)
 *  - `null` / `undefined` → retourne `null` (utile pour les champs optionnels)
 */
export function toMoney(value: number | string | Decimal | null | undefined): Decimal | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === "string") {
    const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
    if (normalized === "") return null;
    return new Prisma.Decimal(normalized);
  }
  if (!Number.isFinite(value)) {
    throw new Error(`toMoney: invalid number ${value}`);
  }
  return new Prisma.Decimal(value);
}

/** Convertit un `Decimal` en `number` pour les graphes Recharts ou les comparaisons faciles. */
export function decimalToNumber(value: Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return value.toNumber();
}

/** Convertit un `Decimal` en string `"1234.56"` (sérialisable JSON, sans perte). */
export function decimalToString(value: Decimal | null | undefined): string {
  if (value === null || value === undefined) return "0";
  return value.toFixed(MONEY_DECIMALS);
}

// ─── Arrondi ───────────────────────────────────────────────────────────────

/**
 * Arrondi à 2 décimales en *banker's rounding* (ROUND_HALF_EVEN).
 * À utiliser sur tous les totaux exposés (facture, FEC, balance).
 */
export function roundMoney(value: Decimal): Decimal {
  return value.toDecimalPlaces(MONEY_DECIMALS, Prisma.Decimal.ROUND_HALF_EVEN);
}

/** Arrondi à 4 décimales (utile pour les taux d'intérêt ou indices). */
export function roundPercent(value: Decimal): Decimal {
  return value.toDecimalPlaces(PERCENT_DECIMALS, Prisma.Decimal.ROUND_HALF_EVEN);
}

// ─── Arithmétique ──────────────────────────────────────────────────────────

export function addMoney(a: Decimal, b: Decimal): Decimal {
  return roundMoney(a.plus(b));
}

export function subMoney(a: Decimal, b: Decimal): Decimal {
  return roundMoney(a.minus(b));
}

/**
 * Multiplication monétaire. Le second opérande est typiquement un taux
 * (TVA, pourcentage, quantité). Utilise `Decimal` ou `number` puisque
 * les taux sont souvent saisis en `number`.
 */
export function mulMoney(amount: Decimal, factor: Decimal | number): Decimal {
  return roundMoney(amount.times(factor));
}

export function divMoney(amount: Decimal, divisor: Decimal | number): Decimal {
  return roundMoney(amount.dividedBy(divisor));
}

/** Somme d'un tableau de montants. Retourne `Decimal(0)` si vide. */
export function sumMoney(values: Array<Decimal | null | undefined>): Decimal {
  let sum = new Prisma.Decimal(0);
  for (const v of values) {
    if (v !== null && v !== undefined) sum = sum.plus(v);
  }
  return roundMoney(sum);
}

// ─── Comparaisons ──────────────────────────────────────────────────────────

/** `true` si les deux montants sont strictement égaux après arrondi à 2 décimales. */
export function moneyEquals(a: Decimal, b: Decimal): boolean {
  return roundMoney(a).equals(roundMoney(b));
}

/**
 * `true` si l'écart absolu est inférieur ou égal à `tolerance` (en euros).
 * Utile pour la validation comptable (« balance équilibrée à ±0.01 € »).
 */
export function moneyApproxEquals(a: Decimal, b: Decimal, tolerance = 0.01): boolean {
  return a.minus(b).abs().lte(tolerance);
}

export function isZero(value: Decimal): boolean {
  return roundMoney(value).isZero();
}

export function isPositive(value: Decimal): boolean {
  return value.gt(0);
}

export function isNegative(value: Decimal): boolean {
  return value.lt(0);
}

// ─── Formatage ─────────────────────────────────────────────────────────────

const FRENCH_CURRENCY_FORMAT = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formate un `Decimal` (ou n'importe quel input toMoney-compatible) en
 * chaîne « 1 234,56 € » française. Remplace `formatCurrency(number)` au
 * fur et à mesure de la migration.
 */
export function formatMoney(value: Decimal | number | string | null | undefined): string {
  const dec = toMoney(value);
  if (dec === null) return FRENCH_CURRENCY_FORMAT.format(0);
  return FRENCH_CURRENCY_FORMAT.format(dec.toNumber());
}
