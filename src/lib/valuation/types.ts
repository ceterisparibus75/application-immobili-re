// Types partagés pour les modules d'évaluation IA (valeur vénale + loyers)

// ============================================================
// ÉVALUATION IMMOBILIÈRE (Valeur Vénale)
// ============================================================

/** Données d'entrée assemblées automatiquement pour l'IA */
export interface ValuationInput {
  building: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    buildingType: string;
    constructionYear?: number;
    totalUsableArea?: number;
    numberOfUnits: number;
    acquisitionPrice?: number;
    acquisitionDate?: string;
    marketValue?: number;
    description?: string;
    latitude?: number;
    longitude?: number;
  };

  occupancy: {
    occupancyRate: number;
    totalAnnualRent: number;
    totalAnnualCharges: number;
    leases: Array<{
      tenant: string;
      unitDescription: string;
      area: number;
      annualRent: number;
      startDate: string;
      endDate?: string;
      leaseType: string;
      indexationType?: string;
    }>;
    vacantUnits: Array<{
      description: string;
      area: number;
      estimatedMarketRent?: number;
    }>;
  };

  financials: {
    annualCharges?: number;
    propertyTax?: number;
    insurance?: number;
    maintenanceBudget?: number;
    recentWorks?: Array<{
      description: string;
      amount: number;
      date: string;
    }>;
  };

  expertReports?: Array<{
    expertName: string;
    reportDate: string;
    estimatedValue: number;
    methodology: string;
    keyFindings: string;
  }>;

  comparables?: Array<{
    address: string;
    saleDate: string;
    salePrice: number;
    area: number;
    pricePerSqm: number;
    distance: number;
    propertyType: string;
  }>;
}

/** Résultat structuré retourné par l'IA (Claude ou Gemini) */
export interface AiValuationResult {
  summary: {
    estimatedValueLow: number;
    estimatedValueMid: number;
    estimatedValueHigh: number;
    rentalValue: number;
    pricePerSqm: number;
    capitalizationRate: number;
    confidence: number;
  };
  methodology: {
    comparisonMethod: {
      applied: boolean;
      pricePerSqm: number | null;
      adjustments: string;
      resultValue: number | null;
      reasoning: string;
    };
    incomeMethod: {
      applied: boolean;
      grossRentalIncome: number | null;
      netRentalIncome: number | null;
      capRate: number | null;
      resultValue: number | null;
      reasoning: string;
    };
    costMethod: {
      applied: boolean;
      landValue: number | null;
      constructionCost: number | null;
      depreciationRate: number | null;
      resultValue: number | null;
      reasoning: string;
    };
  };
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  comparablesAnalysis: {
    summary: string;
    adjustedComparables: Array<{
      address: string;
      originalPricePerSqm: number;
      adjustedPricePerSqm: number;
      adjustmentFactors: string;
      relevanceScore: number;
    }>;
  };
  marketContext: string;
  recommendations: string[];
  caveats: string[];
  detailedNarrative: string;
}

// ============================================================
// ÉVALUATION DES LOYERS
// ============================================================

/** Données d'entrée pour l'évaluation de loyer */
export interface RentValuationInput {
  lease: {
    leaseType: string;
    startDate: string;
    endDate?: string;
    durationMonths: number;
    currentRentHT: number;
    baseRentHT: number;
    paymentFrequency: string;
    vatApplicable: boolean;
    vatRate: number;
    indexType?: string;
    baseIndexValue?: number;
    rentFreeMonths?: number;
    entryFee?: number;
  };

  unit: {
    lotType: string;
    area: number;
    floor?: string;
    description?: string;
    marketRentValue?: number;
  };

  building: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    buildingType: string;
    constructionYear?: number;
    totalUsableArea?: number;
  };

  tenant: {
    entityType: string;
    name: string;
  };

  comparableRents?: Array<{
    address: string;
    rentDate: string;
    annualRent: number;
    area: number;
    rentPerSqm: number;
    distance: number;
    propertyType: string;
    leaseType?: string;
  }>;
}

/** Résultat structuré de l'évaluation de loyer par l'IA */
export interface AiRentValuationResult {
  summary: {
    estimatedMarketRent: number;
    estimatedRentLow: number;
    estimatedRentHigh: number;
    rentPerSqm: number;
    deviationPercent: number;
    confidence: number;
  };
  methodology: {
    comparisonMethod: {
      applied: boolean;
      rentPerSqm: number | null;
      adjustments: string;
      resultRent: number | null;
      reasoning: string;
    };
    incomeMethod: {
      applied: boolean;
      targetYield: number | null;
      propertyValue: number | null;
      resultRent: number | null;
      reasoning: string;
    };
  };
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  marketContext: string;
  recommendations: string[];
  caveats: string[];
  detailedNarrative: string;
}

// ============================================================
// TYPES COMMUNS
// ============================================================

/** Données extraites d'un rapport d'expertise PDF */
export interface ExtractedReportData {
  expertInfo: {
    name: string;
    firm: string | null;
    qualifications: string[];
    reportDate: string | null;
    visitDate: string | null;
  };
  property: {
    address: string | null;
    city: string | null;
    postalCode: string | null;
    cadastralRef: string | null;
    propertyType: string | null;
    constructionYear: number | null;
    totalArea: number | null;
    landArea: number | null;
    floors: number | null;
    parkingSpaces: number | null;
    condition: string | null;
    description: string | null;
  };
  valuation: {
    estimatedValue: number | null;
    rentalValue: number | null;
    pricePerSqm: number | null;
    capRate: number | null;
    methodsUsed: string[];
    valuationDetails: {
      comparisonValue: number | null;
      incomeValue: number | null;
      costValue: number | null;
    };
  };
  comparables: Array<{
    address: string;
    saleDate: string;
    salePrice: number;
    area: number;
    pricePerSqm: number;
    propertyType: string;
  }>;
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  keyFindings: string | null;
  caveats: string[];
}

/** Résultat DVF brut */
export interface DvfTransaction {
  id: string;
  address: string;
  city: string;
  postalCode: string;
  saleDate: string;
  salePrice: number;
  builtArea: number | null;
  landArea: number | null;
  pricePerSqm: number | null;
  propertyType: string;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
}

/** Paramètres de recherche DVF */
export interface DvfSearchParams {
  postalCode: string;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
  radiusKm: number;
  periodYears: number;
  propertyTypes?: string[];
}
