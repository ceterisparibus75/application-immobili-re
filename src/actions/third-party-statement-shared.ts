// Types utilitaires + helpers de calcul/vérification — pas de "use server".

export interface StatementFilters {
  buildingId?: string;
  leaseId?: string;
  type?: "APPEL_FONDS" | "DECOMPTE_CHARGES" | "DECOMPTE_GESTION";
  status?: string;
}

export interface VerificationLineResult {
  lineType: string;
  label: string;
  amount: number;
  expectedAmount: number | null;
  ecart: number | null;
  verificationStatus: "OK" | "ECART" | "INFO" | "ANOMALIE";
  leaseId?: string;
  leaseName?: string;
}

export interface LeaseVerificationResult {
  leaseId: string;
  leaseName: string;
  tenantName: string;
  status: "CONFORME" | "ECART" | "ANOMALIE";
  lines: VerificationLineResult[];
}

export interface VerificationResult {
  overallStatus: "CONFORME" | "ECART" | "ANOMALIE";
  lines: VerificationLineResult[];
  byLease?: LeaseVerificationResult[];
  periodMonths: number;
  computedAt: string;
}

export interface LeaseForVerification {
  id: string;
  leaseNumber: string | null;
  currentRentHT: number;
  vatApplicable: boolean;
  vatRate: number | null;
  managementFeeType: string | null;
  managementFeeValue: number | null;
  managementFeeBasis: string | null;
  managementFeeVatRate: number | null;
  chargeProvisions: Array<{ monthlyAmount: number }>;
  lot?: { number: string } | null;
  tenant?: { firstName: string; lastName: string; companyName?: string | null } | null;
}

export function computeExpectedAmounts(
  lease: LeaseForVerification,
  months: number
): { expectedRent: number; expectedProvisions: number; expectedFees: number | null } {
  // Loyer attendu
  const expectedRent = lease.vatApplicable
    ? lease.currentRentHT * months * (1 + (lease.vatRate ?? 20) / 100)
    : lease.currentRentHT * months;

  // Provisions attendues
  const totalMonthlyProvisions = lease.chargeProvisions.reduce(
    (sum, p) => sum + p.monthlyAmount,
    0
  );
  const expectedProvisions = totalMonthlyProvisions * months;

  // Honoraires attendus
  let expectedFees: number | null = null;
  if (lease.managementFeeType && lease.managementFeeValue) {
    const feeVatRate = lease.managementFeeVatRate ?? 20;

    if (lease.managementFeeType === "POURCENTAGE") {
      let basis = 0;
      const monthlyRentHT = lease.currentRentHT;
      const monthlyProvisions = totalMonthlyProvisions;

      if (lease.managementFeeBasis === "LOYER_HT") {
        basis = monthlyRentHT * months;
      } else if (lease.managementFeeBasis === "LOYER_CHARGES_HT") {
        basis = (monthlyRentHT + monthlyProvisions) * months;
      } else if (lease.managementFeeBasis === "TOTAL_TTC") {
        const rentTTC = lease.vatApplicable
          ? monthlyRentHT * (1 + (lease.vatRate ?? 20) / 100)
          : monthlyRentHT;
        basis = (rentTTC + monthlyProvisions * (1 + feeVatRate / 100)) * months;
      } else {
        basis = monthlyRentHT * months;
      }
      expectedFees = basis * (lease.managementFeeValue / 100);
    } else if (lease.managementFeeType === "FORFAIT") {
      expectedFees = lease.managementFeeValue * months;
    }

    if (expectedFees !== null) {
      expectedFees = expectedFees * (1 + feeVatRate / 100);
    }
  }

  return { expectedRent, expectedProvisions, expectedFees };
}

// ─── Vérification d'un décompte de gestion locative ──────────────────


export function verifyLine(
  line: { lineType: string; label: string; amount: number },
  expected: { expectedRent: number; expectedProvisions: number; expectedFees: number | null }
): VerificationLineResult {
  let expectedAmount: number | null = null;
  let verificationStatus: "OK" | "ECART" | "INFO" | "ANOMALIE" = "INFO";

  const labelLower = line.label.toLowerCase();

  if (line.lineType === "ENCAISSEMENT") {
    if (labelLower.includes("loyer") || labelLower.includes("lover")) {
      expectedAmount = expected.expectedRent;
    } else if (labelLower.includes("provision") || labelLower.includes("charge")) {
      expectedAmount = expected.expectedProvisions;
    }
  } else if (line.lineType === "HONORAIRES") {
    expectedAmount = expected.expectedFees;
  }

  if (expectedAmount !== null) {
    const ecart = Math.abs(line.amount - expectedAmount);
    if (ecart < 1) {
      verificationStatus = "OK";
    } else if (ecart < Math.abs(expectedAmount) * 0.1) {
      verificationStatus = "ECART";
    } else {
      verificationStatus = "ANOMALIE";
    }
  }

  return {
    lineType: line.lineType,
    label: line.label,
    amount: line.amount,
    expectedAmount,
    ecart: expectedAmount !== null ? Math.round((line.amount - expectedAmount) * 100) / 100 : null,
    verificationStatus,
  };
}

// ─── Rapprochement bancaire avec un décompte de gestion ─────────────

