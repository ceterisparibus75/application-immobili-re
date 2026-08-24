type TenantIdentity = {
  entityType?: string | null;
  displayName?: string | null;
  companyName?: string | null;
  companyAddress?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  personalAddress?: string | null;
};

function personName(tenant: TenantIdentity): string {
  return [tenant.firstName, tenant.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * Nom d'affichage du locataire dans les factures, quittances, listes, emails.
 *
 * Priorité :
 *  1. displayName (si renseigné) — override manuel utile pour :
 *     - co-titulaires personnes physiques ("M. Langet et Mme Bui Duc")
 *     - noms d'usage différents de l'état civil
 *     - intitulés SCI/SARL spécifiques
 *  2. companyName si PERSONNE_MORALE
 *  3. firstName + lastName si PERSONNE_PHYSIQUE
 *  4. fallback
 */
export function getTenantDisplayName(tenant: TenantIdentity, fallback = "—"): string {
  const explicit = tenant.displayName?.trim();
  if (explicit) return explicit;

  const individualName = personName(tenant);
  const companyName = tenant.companyName?.trim() ?? "";

  if (tenant.entityType === "PERSONNE_MORALE") {
    return companyName || individualName || fallback;
  }

  return individualName || companyName || fallback;
}

export function getTenantMailingAddress(tenant: TenantIdentity): string {
  const personalAddress = tenant.personalAddress?.trim() ?? "";
  const companyAddress = tenant.companyAddress?.trim() ?? "";

  if (tenant.entityType === "PERSONNE_MORALE") {
    return companyAddress || personalAddress;
  }

  return personalAddress || companyAddress;
}
