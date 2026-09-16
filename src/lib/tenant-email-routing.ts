import { prisma } from "@/lib/prisma";

/**
 * Routage des emails vers les mandataires du locataire.
 *
 * Pour chaque catégorie de document (facture, quittance, relance, autre),
 * on ajoute automatiquement en BCC les emails des mandataires configurés
 * pour recevoir ce type. Le destinataire principal (TO) reste celui du
 * caller — typiquement tenant.billingEmail ?? tenant.email.
 *
 * Exemple : chez SMAC, la comptable Caroline est mandataire avec
 * receivesQuittances=true, receivesInvoices=false. Les quittances lui
 * partent en copie, les factures continuent d'aller uniquement sur la
 * boîte fournisseurs principale.
 */

export type MandataireCategory =
  | "invoice"
  | "quittance"
  | "reminder"
  | "document";

const FLAG_BY_CATEGORY = {
  invoice: "receivesInvoices",
  quittance: "receivesQuittances",
  reminder: "receivesReminders",
  document: "receivesDocuments",
} as const satisfies Record<MandataireCategory, string>;

/**
 * Retourne les emails à ajouter en BCC pour un envoi vers ce locataire.
 * Filtre les mandataires selon la catégorie et exclut ceux qui ont l'email
 * déjà présent dans `alreadyIncluded` (le tenant principal typiquement).
 */
export async function getMandataireBccEmails(
  tenantId: string,
  category: MandataireCategory,
  alreadyIncluded: Array<string | null | undefined> = []
): Promise<string[]> {
  try {
    const flag = FLAG_BY_CATEGORY[category];
    const mandataires = await prisma.tenantMandataire.findMany({
      where: { tenantId, [flag]: true },
      select: { email: true },
    });

    const skip = new Set(
      alreadyIncluded
        .filter((e): e is string => typeof e === "string" && e.length > 0)
        .map((e) => e.toLowerCase().trim())
    );

    // Dédoublonner insensible à la casse + filtrer les emails déjà cibles.
    const seen = new Set<string>();
    const emails: string[] = [];
    for (const m of mandataires) {
      const normalized = m.email.toLowerCase().trim();
      if (!normalized || skip.has(normalized) || seen.has(normalized)) continue;
      seen.add(normalized);
      emails.push(m.email);
    }
    return emails;
  } catch (err) {
    // Fail-safe : jamais bloquer un envoi si le lookup échoue.
    console.warn("[getMandataireBccEmails]", err);
    return [];
  }
}
