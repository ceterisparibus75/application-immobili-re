// Helpers de mapping entre la réponse IA et le formulaire de revue.

import type { ReviewForm, TenantOption } from "./import-types";

export function tenantLabel(t: TenantOption) {
  return t.entityType === "PERSONNE_MORALE"
    ? (t.companyName ?? t.email)
    : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || t.email;
}

export function emptyReview(): ReviewForm {
  return {
    immeuble: { name: "", addressLine1: "", city: "", postalCode: "", buildingType: "COMMERCE" },
    lot: { number: "", lotType: "LOCAL_COMMERCIAL", area: "", floor: "", position: "" },
    locataire: {
      entityType: "PERSONNE_MORALE",
      companyName: "", companyLegalForm: "", siret: "",
      legalRepName: "", legalRepTitle: "", legalRepEmail: "", legalRepPhone: "",
      firstName: "", lastName: "",
      email: "", phone: "", mobile: "",
    },
    bail: {
      leaseType: "COMMERCIAL_369", destination: "", startDate: "", durationMonths: "108",
      baseRentHT: "", depositAmount: "0",
      paymentFrequency: "MENSUEL", billingTerm: "A_ECHOIR", vatApplicable: true, vatRate: "20",
      indexType: "", baseIndexValue: "", baseIndexQuarter: "",
      fixedAnnualIndexationRate: "", billingAnchorMonth: "", billingAnchorDay: "",
      revisionFrequency: "12",
      revisionDateBasis: "DATE_SIGNATURE", revisionCustomMonth: "", revisionCustomDay: "",
      rentFreeMonths: "0", entryFee: "0", tenantWorksClauses: "",
      isThirdPartyManaged: false, managingContactId: "",
      managementFeeType: "POURCENTAGE", managementFeeValue: "0",
      managementFeeBasis: "LOYER_HT", managementFeeVatRate: "20",
    },
  };
}

export function aiToForm(ai: Record<string, unknown>): ReviewForm {
  const base = emptyReview();
  const imm = (ai.immeuble ?? {}) as Record<string, unknown>;
  const lot = (ai.lot ?? {}) as Record<string, unknown>;
  const loc = (ai.locataire ?? {}) as Record<string, unknown>;
  const bail = (ai.bail ?? {}) as Record<string, unknown>;

  return {
    immeuble: {
      name: String(imm.name ?? ""),
      addressLine1: String(imm.addressLine1 ?? ""),
      city: String(imm.city ?? ""),
      postalCode: String(imm.postalCode ?? ""),
      buildingType: String(imm.buildingType ?? "COMMERCE"),
    },
    lot: {
      number: String(lot.number ?? ""),
      lotType: String(lot.lotType ?? "LOCAL_COMMERCIAL"),
      area: lot.area != null ? String(lot.area) : "",
      floor: String(lot.floor ?? ""),
      position: String(lot.position ?? ""),
    },
    locataire: {
      entityType: (loc.entityType === "PERSONNE_PHYSIQUE" ? "PERSONNE_PHYSIQUE" : "PERSONNE_MORALE") as "PERSONNE_MORALE" | "PERSONNE_PHYSIQUE",
      companyName: String(loc.companyName ?? ""),
      companyLegalForm: String(loc.companyLegalForm ?? ""),
      siret: String(loc.siret ?? ""),
      legalRepName: String(loc.legalRepName ?? ""),
      legalRepTitle: String(loc.legalRepTitle ?? ""),
      legalRepEmail: String(loc.legalRepEmail ?? ""),
      legalRepPhone: String(loc.legalRepPhone ?? ""),
      firstName: String(loc.firstName ?? ""),
      lastName: String(loc.lastName ?? ""),
      email: String(loc.email ?? base.locataire.email),
      phone: String(loc.phone ?? ""),
      mobile: String(loc.mobile ?? ""),
    },
    bail: {
      leaseType: String(bail.leaseType ?? "COMMERCIAL_369"),
      destination: bail.destination != null && bail.destination !== "null" ? String(bail.destination) : "",
      startDate: String(bail.startDate ?? ""),
      durationMonths: bail.durationMonths != null ? String(bail.durationMonths) : "108",
      baseRentHT: bail.baseRentHT != null ? String(bail.baseRentHT) : "",
      depositAmount: bail.depositAmount != null ? String(bail.depositAmount) : "0",
      paymentFrequency: String(bail.paymentFrequency ?? "MENSUEL"),
      billingTerm: String(bail.billingTerm ?? "A_ECHOIR"),
      vatApplicable: bail.vatApplicable !== false,
      vatRate: bail.vatRate != null ? String(bail.vatRate) : "20",
      indexType: bail.indexType != null && bail.indexType !== "null" ? String(bail.indexType) : "",
      baseIndexValue: bail.baseIndexValue != null ? String(bail.baseIndexValue) : "",
      baseIndexQuarter: bail.baseIndexQuarter != null ? String(bail.baseIndexQuarter) : "",
      fixedAnnualIndexationRate: bail.fixedAnnualIndexationRate != null ? String(bail.fixedAnnualIndexationRate) : "",
      billingAnchorMonth: bail.billingAnchorMonth != null ? String(bail.billingAnchorMonth) : "",
      billingAnchorDay: bail.billingAnchorDay != null ? String(bail.billingAnchorDay) : "",
      revisionFrequency: bail.revisionFrequency != null ? String(bail.revisionFrequency) : "12",
      revisionDateBasis: bail.revisionDateBasis != null && bail.revisionDateBasis !== "null" ? String(bail.revisionDateBasis) : "DATE_SIGNATURE",
      revisionCustomMonth: bail.revisionCustomMonth != null ? String(bail.revisionCustomMonth) : "",
      revisionCustomDay: bail.revisionCustomDay != null ? String(bail.revisionCustomDay) : "",
      rentFreeMonths: bail.rentFreeMonths != null ? String(bail.rentFreeMonths) : "0",
      entryFee: bail.entryFee != null ? String(bail.entryFee) : "0",
      tenantWorksClauses: String(bail.tenantWorksClauses ?? ""),
      isThirdPartyManaged: bail.isThirdPartyManaged === true,
      managingContactId: "",
      managementFeeType: String(bail.managementFeeType ?? "POURCENTAGE"),
      managementFeeValue: bail.managementFeeValue != null ? String(bail.managementFeeValue) : "0",
      managementFeeBasis: String(bail.managementFeeBasis ?? "LOYER_HT"),
      managementFeeVatRate: bail.managementFeeVatRate != null ? String(bail.managementFeeVatRate) : "20",
    },
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
