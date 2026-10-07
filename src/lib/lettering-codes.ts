/**
 * Helpers purs pour la conversion entre numéro de séquence et code de
 * lettrage alphabétique (AA, AB, …, ZZ, AAA, …). Isolés du fichier server
 * action `src/actions/lettering.ts` parce que Next.js 16 interdit les
 * exports non-async dans un fichier `"use server"`.
 *
 * Les codes commencent à "AA" (sequence 1) et poursuivent AA, AB, ..., AZ,
 * BA, ..., ZZ, puis AAA, AAB, ..., ZZZ, puis AAAA, etc. Le format est
 * bijectif (base 26, chiffres A-Z) décalé pour que "AA" = 1 — ce qui donne
 * une séquence sans "A" tout seul, lecture plus claire pour un comptable :
 *   1   -> AA
 *   2   -> AB
 *   26  -> AZ
 *   27  -> BA
 *   676 -> ZZ
 *   677 -> AAA
 */
export function sequenceToLetteringCode(sequence: number): string {
  if (!Number.isFinite(sequence) || sequence < 1) {
    throw new Error("La sequence de lettrage doit etre >= 1");
  }

  // On utilise une numeration bijective base 26 : chaque "chiffre" vaut 1..26
  // et represente une lettre A..Z. "AA" = premier code sur 2 lettres, donc on
  // commence a sequence 1.
  //
  // Representation interne : on traite les codes de longueur >= 2.
  // Nombre de codes de longueur L : 26^L (AA..ZZ pour L=2 -> 26*26 = 676).
  //
  // Pour trouver la longueur : on soustrait successivement 26^L jusqu'a
  // tomber dans la bonne tranche, puis on convertit l'index restant en base 26
  // sur L chiffres (chaque chiffre 0..25 -> A..Z).
  let remaining = sequence - 1;
  let length = 2;
  while (true) {
    const bucket = Math.pow(26, length);
    if (remaining < bucket) break;
    remaining -= bucket;
    length += 1;
    if (length > 10) {
      // Garde-fou : au-dela de 10 lettres on a largement 10^14 lettrages.
      throw new Error("Depassement de la sequence de lettrage");
    }
  }

  const digits: string[] = [];
  for (let i = 0; i < length; i += 1) {
    digits.push(String.fromCharCode(65 + (remaining % 26)));
    remaining = Math.floor(remaining / 26);
  }
  return digits.reverse().join("");
}

/**
 * Convertit un code de lettrage alphabétique en numéro de séquence (1-based).
 * Inverse de sequenceToLetteringCode. Retourne 0 si le code est invalide ou
 * trop court (ex: "A" tout seul, utilisation historique inattendue) pour que
 * le backfill ignore ce code au lieu de planter.
 */
export function letteringCodeToSequence(code: string): number {
  if (!code || !/^[A-Z]+$/.test(code) || code.length < 2) return 0;

  let sequence = 0;
  // On somme d'abord les "offsets" des codes plus courts : AA..ZZ, AAA..ZZZ, etc.
  for (let L = 2; L < code.length; L += 1) {
    sequence += Math.pow(26, L);
  }
  // Puis on convertit le code lui-meme en base 26 (A=0, Z=25).
  for (let i = 0; i < code.length; i += 1) {
    sequence = sequence * 26 + (code.charCodeAt(i) - 65);
  }
  return sequence + 1;
}
