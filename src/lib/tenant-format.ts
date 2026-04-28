type TenantIdentity = {
  entityType?: string | null;
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

export function getTenantDisplayName(tenant: TenantIdentity, fallback = "—"): string {
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
