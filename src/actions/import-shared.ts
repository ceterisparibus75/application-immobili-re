// Types partagés pour les imports — pas de "use server".

import type {
  BuildingType,
  LotType,
  LeaseType,
  LeaseDestination,
  PaymentFrequency,
  IndexType,
  RevisionDateBasis,
  TenantEntityType,
  ManagementFeeType,
  ManagementFeeBasis,
} from "@/generated/prisma/client";

export type ImportBuildingInput = {
  existingId?: string;
  name: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  buildingType: BuildingType;
};

export type ImportLotInput = {
  existingId?: string;
  number: string;
  lotType: LotType;
  area: number;
  floor?: string | null;
  position?: string | null;
};

export type ImportTenantInput = {
  existingId?: string;
  entityType: TenantEntityType;
  // Personne morale
  companyName?: string | null;
  companyLegalForm?: string | null;
  siret?: string | null;
  legalRepName?: string | null;
  legalRepTitle?: string | null;
  legalRepEmail?: string | null;
  legalRepPhone?: string | null;
  // Personne physique
  firstName?: string | null;
  lastName?: string | null;
  // Commun
  email: string;
  phone?: string | null;
  mobile?: string | null;
};

export type ImportLeaseInput = {
  leaseType: LeaseType;
  destination?: LeaseDestination | null;
  startDate: string;
  durationMonths: number;
  baseRentHT: number;
  depositAmount: number;
  paymentFrequency: PaymentFrequency;
  vatApplicable: boolean;
  vatRate: number;
  indexType?: IndexType | null;
  baseIndexValue?: number | null;
  baseIndexQuarter?: string | null;
  revisionFrequency?: number;
  revisionDateBasis?: RevisionDateBasis | null;
  revisionCustomMonth?: number | null;
  revisionCustomDay?: number | null;
  rentFreeMonths: number;
  entryFee: number;
  tenantWorksClauses?: string | null;
  isThirdPartyManaged?: boolean;
  managingContactId?: string | null;
  managementFeeType?: ManagementFeeType | null;
  managementFeeValue?: number | null;
  managementFeeBasis?: ManagementFeeBasis | null;
  managementFeeVatRate?: number | null;
};

export type ImportInput = {
  building: ImportBuildingInput;
  lot: ImportLotInput;
  tenant: ImportTenantInput;
  lease: ImportLeaseInput;
  secondaryLotIds?: string[];
};

export type ImportResult = {
  leaseId: string;
  buildingId: string;
  lotId: string;
  tenantId: string;
};
