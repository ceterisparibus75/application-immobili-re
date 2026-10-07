/**
 * Helpers purs pour la numérotation FEC. Isolés du fichier server action
 * `accounting-fec-numbering.ts` parce que Next.js 16 interdit les exports
 * non-async dans un fichier `"use server"`.
 */

export const FEC_NUM_WIDTH = 8;

/**
 * Formate un numéro de séquence en EcritureNum FEC : chaîne numérique
 * zéro-paddée sur 8 chiffres (ex: 1 → "00000001", 42 → "00000042").
 */
export function formatFecEcritureNum(sequence: number): string {
  return String(sequence).padStart(FEC_NUM_WIDTH, "0");
}
