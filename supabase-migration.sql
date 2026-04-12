-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN_SOCIETE', 'GESTIONNAIRE', 'COMPTABLE', 'LECTURE');

-- CreateEnum
CREATE TYPE "LegalForm" AS ENUM ('SCI', 'SARL', 'SAS', 'SA', 'EURL', 'SASU', 'SNC', 'AUTRE', 'PERSONNE_PHYSIQUE');

-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('IS', 'IR');

-- CreateEnum
CREATE TYPE "VatRegime" AS ENUM ('TVA', 'FRANCHISE');

-- CreateEnum
CREATE TYPE "BuildingType" AS ENUM ('BUREAU', 'COMMERCE', 'MIXTE', 'ENTREPOT');

-- CreateEnum
CREATE TYPE "LotType" AS ENUM ('LOCAL_COMMERCIAL', 'BUREAUX', 'LOCAL_ACTIVITE', 'RESERVE', 'PARKING', 'CAVE', 'TERRASSE', 'ENTREPOT', 'APPARTEMENT');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('OCCUPE', 'VACANT', 'EN_TRAVAUX', 'RESERVE');

-- CreateEnum
CREATE TYPE "LeaseType" AS ENUM ('HABITATION', 'MEUBLE', 'ETUDIANT', 'MOBILITE', 'COLOCATION', 'SAISONNIER', 'LOGEMENT_FONCTION', 'ANAH', 'CIVIL', 'GLISSANT', 'SOUS_LOCATION', 'COMMERCIAL_369', 'DEROGATOIRE', 'PRECAIRE', 'BAIL_PROFESSIONNEL', 'MIXTE', 'EMPHYTEOTIQUE', 'CONSTRUCTION', 'REHABILITATION', 'BRS', 'RURAL');

-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('EN_COURS', 'RESILIE', 'RENOUVELE', 'EN_NEGOCIATION', 'CONTENTIEUX');

-- CreateEnum
CREATE TYPE "PaymentFrequency" AS ENUM ('MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL', 'ANNUEL');

-- CreateEnum
CREATE TYPE "BillingTerm" AS ENUM ('ECHU', 'A_ECHOIR');

-- CreateEnum
CREATE TYPE "IndexType" AS ENUM ('IRL', 'ILC', 'ILAT', 'ICC');

-- CreateEnum
CREATE TYPE "TenantEntityType" AS ENUM ('PERSONNE_MORALE', 'PERSONNE_PHYSIQUE');

-- CreateEnum
CREATE TYPE "ProprietaireEntityType" AS ENUM ('PERSONNE_PHYSIQUE', 'PERSONNE_MORALE');

-- CreateEnum
CREATE TYPE "DocumentCheckStatus" AS ENUM ('RECU', 'MANQUANT', 'EXPIRE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('EN_ATTENTE', 'BROUILLON', 'VALIDEE', 'ENVOYEE', 'RELANCEE', 'IRRECOUVRABLE', 'ANNULEE', 'PAYE', 'PARTIELLEMENT_PAYE', 'EN_RETARD', 'LITIGIEUX');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('APPEL_LOYER', 'QUITTANCE', 'REGULARISATION_CHARGES', 'REFACTURATION', 'AVOIR');

-- CreateEnum
CREATE TYPE "GuaranteeType" AS ENUM ('DEPOT_GARANTIE', 'CAUTION_PERSONNELLE', 'GARANTIE_BANCAIRE', 'GLI');

-- CreateEnum
CREATE TYPE "GuaranteeStatus" AS ENUM ('ACTIF', 'PARTIELLEMENT_RESTITUE', 'RESTITUE', 'EXPIRE');

-- CreateEnum
CREATE TYPE "ChargeNature" AS ENUM ('PROPRIETAIRE', 'RECUPERABLE', 'MIXTE');

-- CreateEnum
CREATE TYPE "AllocationMethod" AS ENUM ('TANTIEME', 'SURFACE', 'NB_LOTS', 'COMPTEUR', 'PERSONNALISE');

-- CreateEnum
CREATE TYPE "ReminderLevel" AS ENUM ('RELANCE_1', 'RELANCE_2', 'MISE_EN_DEMEURE', 'CONTENTIEUX');

-- CreateEnum
CREATE TYPE "RiskIndicator" AS ENUM ('VERT', 'ORANGE', 'ROUGE');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('ENTREE', 'SORTIE');

-- CreateEnum
CREATE TYPE "RoomCondition" AS ENUM ('BON', 'USAGE_NORMAL', 'DEGRADE', 'TRES_DEGRADE');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('LOCATAIRE', 'PRESTATAIRE', 'NOTAIRE', 'EXPERT', 'SYNDIC', 'AGENCE', 'AUTRE');

-- CreateEnum
CREATE TYPE "JournalType" AS ENUM ('VENTES', 'BANQUE', 'OPERATIONS_DIVERSES', 'AN', 'AC', 'BQUE', 'INV', 'OD', 'VT');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('BROUILLON', 'VALIDEE', 'CLOTUREE');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ACTIF', 'PASSIF', 'ACTIF_NEGATIF', 'CHARGE', 'PRODUIT');

-- CreateEnum
CREATE TYPE "SensNormal" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT', 'SEND_EMAIL', 'GENERATE_PDF');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('BROUILLON', 'PUBLIE', 'DEPUBLIE', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "PublicationPlatform" AS ENUM ('SELOGER', 'LOGIC_IMMO', 'BIENICI', 'LEBONCOIN', 'PAP');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('EN_COURS', 'PUBLIE', 'ERREUR', 'RETIRE');

-- CreateEnum
CREATE TYPE "LoanType" AS ENUM ('AMORTISSABLE', 'IN_FINE', 'BULLET');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('EN_COURS', 'TERMINE', 'REMBOURSE_ANTICIPE');

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('MENSUEL', 'ANNUEL');

-- CreateEnum
CREATE TYPE "DepositMovementType" AS ENUM ('ENCAISSEMENT', 'RETENUE', 'RESTITUTION_PARTIELLE', 'RESTITUTION_TOTALE');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OUVERT', 'EN_COURS', 'EN_ATTENTE', 'RESOLU', 'FERME');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('BASSE', 'NORMALE', 'HAUTE', 'URGENTE');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('MAINTENANCE', 'PLOMBERIE', 'ELECTRICITE', 'CHAUFFAGE', 'NUISANCES', 'PARTIES_COMMUNES', 'DOCUMENT', 'FACTURATION', 'ASSURANCE', 'AUTRE');

-- CreateEnum
CREATE TYPE "ManagementFeeType" AS ENUM ('POURCENTAGE', 'FORFAIT');

-- CreateEnum
CREATE TYPE "ManagementFeeBasis" AS ENUM ('LOYER_HT', 'LOYER_CHARGES_HT', 'TOTAL_TTC');

-- CreateEnum
CREATE TYPE "AmendmentType" AS ENUM ('RENOUVELLEMENT', 'AVENANT_LOYER', 'AVENANT_DUREE', 'AVENANT_DIVERS', 'RESILIATION');

-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('SENT', 'DELIVERED', 'COMPLETED', 'DECLINED', 'VOIDED');

-- CreateEnum
CREATE TYPE "SignatureDocumentType" AS ENUM ('BAIL', 'ETAT_DES_LIEUX', 'MANDAT', 'AUTRE');

-- CreateEnum
CREATE TYPE "SepaMandateStatus" AS ENUM ('PENDING_SUBMISSION', 'SUBMITTED', 'ACTIVE', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SepaPaymentStatus" AS ENUM ('PENDING_SUBMISSION', 'SUBMITTED', 'CONFIRMED', 'PAID_OUT', 'FAILED', 'CANCELLED', 'CUSTOMER_APPROVAL_DENIED', 'CHARGED_BACK');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "PlanId" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BAIL_EXPIRING', 'INVOICE_OVERDUE', 'DIAGNOSTIC_EXPIRING', 'PAYMENT_RECEIVED', 'MAINTENANCE_COMPLETED', 'DOCUMENT_SIGNED', 'SEPA_PAYMENT_FAILED', 'SEPA_PAYMENT_CONFIRMED', 'INSURANCE_EXPIRING', 'RENT_REVISION', 'TICKET_CREATED', 'TICKET_REPLY', 'TICKET_STATUS_CHANGED');

-- CreateEnum
CREATE TYPE "ReportFrequency" AS ENUM ('MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL', 'ANNUEL');

-- CreateEnum
CREATE TYPE "ValuationStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('CLAUDE', 'GEMINI', 'MISTRAL', 'OPENAI');

-- CreateEnum
CREATE TYPE "RentValuationStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CoproBudgetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CoproAssemblyType" AS ENUM ('ORDINAIRE', 'EXTRAORDINAIRE', 'MIXTE');

-- CreateEnum
CREATE TYPE "CoproAssemblyStatus" AS ENUM ('PLANNED', 'CONVOCATION_SENT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CoproMajority" AS ENUM ('SIMPLE', 'ABSOLUE', 'DOUBLE', 'UNANIMITE');

-- CreateEnum
CREATE TYPE "CoproResolutionStatus" AS ENUM ('PENDING', 'ADOPTED', 'REJECTED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "CoproVoteChoice" AS ENUM ('POUR', 'CONTRE', 'ABSTENTION');

-- CreateEnum
CREATE TYPE "SeasonalPropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'VILLA', 'STUDIO', 'ROOM', 'GITE', 'CHALET');

-- CreateEnum
CREATE TYPE "SeasonalBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'VISIT_DONE', 'DOSSIER_RECEIVED', 'DOSSIER_VALIDATED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "CandidateActivityType" AS ENUM ('NOTE', 'EMAIL_SENT', 'CALL', 'VISIT', 'DOCUMENT_RECEIVED', 'STATUS_CHANGE', 'SCORE_UPDATE');

-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Society" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "legalForm" "LegalForm" NOT NULL,
    "siret" TEXT NOT NULL,
    "vatNumber" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'France',
    "phone" TEXT,
    "email" TEXT,
    "shareCapital" DOUBLE PRECISION,
    "signatoryName" TEXT,
    "ibanEncrypted" TEXT,
    "bicEncrypted" TEXT,
    "bankName" TEXT,
    "taxRegime" "TaxRegime" NOT NULL,
    "vatRegime" "VatRegime" NOT NULL,
    "accountantName" TEXT,
    "accountantFirm" TEXT,
    "accountantEmail" TEXT,
    "accountantPhone" TEXT,
    "logoUrl" TEXT,
    "legalMentions" TEXT,
    "invoicePrefix" TEXT,
    "nextInvoiceNumber" INTEGER NOT NULL DEFAULT 0,
    "invoiceNumberYear" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT,
    "proprietaireId" TEXT,
    "leasePrefix" TEXT,
    "nextLeaseNumber" INTEGER DEFAULT 0,
    "leaseNumberYear" INTEGER DEFAULT 0,

    CONSTRAINT "Society_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proprietaire" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "entityType" "ProprietaireEntityType" NOT NULL DEFAULT 'PERSONNE_PHYSIQUE',
    "label" TEXT NOT NULL,
    "email" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "birthDate" TIMESTAMP(3),
    "birthPlace" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "profession" TEXT,
    "nationality" TEXT,
    "companyName" TEXT,
    "legalForm" TEXT,
    "siret" TEXT,
    "siren" TEXT,
    "vatNumber" TEXT,
    "shareCapital" DOUBLE PRECISION,
    "registrationCity" TEXT,
    "representativeName" TEXT,
    "representativeRole" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Proprietaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProprietaireAssocie" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "birthDate" TIMESTAMP(3),
    "birthPlace" TEXT,
    "nationality" TEXT,
    "profession" TEXT,
    "share" TEXT,
    "role" TEXT,
    "proprietaireId" TEXT NOT NULL,

    CONSTRAINT "ProprietaireAssocie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "birthDate" TIMESTAMP(3),
    "birthPlace" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "ownerCity" TEXT,
    "profession" TEXT,
    "nationality" TEXT,
    "passwordHash" TEXT NOT NULL,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetTokenExpiresAt" TIMESTAMP(3),
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorRecoveryCodes" TEXT[],
    "pendingTwoFactorSecret" TEXT,
    "emailCopyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailCopyAddress" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSociety" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "modulePermissions" JSONB,

    CONSTRAINT "UserSociety_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "societyId" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'France',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "buildingType" "BuildingType" NOT NULL,
    "yearBuilt" INTEGER,
    "totalArea" DOUBLE PRECISION,
    "marketValue" DOUBLE PRECISION,
    "netBookValue" DOUBLE PRECISION,
    "acquisitionPrice" DOUBLE PRECISION,
    "acquisitionFees" DOUBLE PRECISION,
    "acquisitionTaxes" DOUBLE PRECISION,
    "acquisitionOtherCosts" DOUBLE PRECISION,
    "acquisitionDate" TIMESTAMP(3),
    "worksCost" DOUBLE PRECISION,
    "description" TEXT,
    "acquisitionPdfUrl" TEXT,
    "acquisitionPdfStoragePath" TEXT,
    "acquisitionPdfAnalysis" TEXT,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdditionalAcquisition" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "buildingId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "acquisitionPrice" DOUBLE PRECISION NOT NULL,
    "acquisitionFees" DOUBLE PRECISION,
    "acquisitionTaxes" DOUBLE PRECISION,
    "otherCosts" DOUBLE PRECISION,
    "description" TEXT,

    CONSTRAINT "AdditionalAcquisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Diagnostic" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "buildingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "result" TEXT,
    "fileUrl" TEXT,
    "fileStoragePath" TEXT,
    "aiAnalysis" TEXT,
    "aiAnalyzedAt" TIMESTAMP(3),
    "alertSent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Diagnostic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "buildingId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "lotType" "LotType" NOT NULL,
    "area" DOUBLE PRECISION NOT NULL,
    "commonShares" INTEGER DEFAULT 0,
    "floor" TEXT,
    "position" TEXT,
    "description" TEXT,
    "status" "LotStatus" NOT NULL DEFAULT 'VACANT',
    "marketRentValue" DOUBLE PRECISION,
    "currentRent" DOUBLE PRECISION,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Maintenance" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "buildingId" TEXT NOT NULL,
    "lotId" TEXT,
    "contactId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cost" DOUBLE PRECISION,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "invoiceUrl" TEXT,
    "notes" TEXT,

    CONSTRAINT "Maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lease" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaseNumber" TEXT,
    "leaseTemplateId" TEXT,
    "leaseType" "LeaseType" NOT NULL,
    "status" "LeaseStatus" NOT NULL DEFAULT 'EN_COURS',
    "startDate" TIMESTAMP(3) NOT NULL,
    "durationMonths" INTEGER NOT NULL DEFAULT 108,
    "endDate" TIMESTAMP(3) NOT NULL,
    "baseRentHT" DOUBLE PRECISION NOT NULL,
    "currentRentHT" DOUBLE PRECISION NOT NULL,
    "depositAmount" DOUBLE PRECISION NOT NULL,
    "paymentFrequency" "PaymentFrequency" NOT NULL DEFAULT 'MENSUEL',
    "billingTerm" "BillingTerm" NOT NULL DEFAULT 'A_ECHOIR',
    "vatApplicable" BOOLEAN NOT NULL DEFAULT true,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "indexType" "IndexType",
    "baseIndexValue" DOUBLE PRECISION,
    "baseIndexQuarter" TEXT,
    "revisionFrequency" INTEGER DEFAULT 12,
    "rentFreeMonths" DOUBLE PRECISION DEFAULT 0,
    "progressiveRent" JSONB,
    "tenantWorksClauses" TEXT,
    "entryFee" DOUBLE PRECISION DEFAULT 0,
    "isThirdPartyManaged" BOOLEAN NOT NULL DEFAULT false,
    "managingContactId" TEXT,
    "managementFeeType" "ManagementFeeType",
    "managementFeeValue" DOUBLE PRECISION,
    "managementFeeBasis" "ManagementFeeBasis",
    "managementFeeVatRate" DOUBLE PRECISION DEFAULT 20.0,
    "managementContractUrl" TEXT,
    "managementNotes" TEXT,
    "entryDate" TIMESTAMP(3),
    "exitDate" TIMESTAMP(3),
    "depositReceivedAt" TIMESTAMP(3),
    "depositReturnedAt" TIMESTAMP(3),
    "depositReturnAmount" DOUBLE PRECISION,
    "depositDeductions" JSONB,
    "leaseFileUrl" TEXT,
    "leaseFileStoragePath" TEXT,
    "triennialAlert1Sent" BOOLEAN NOT NULL DEFAULT false,
    "triennialAlert2Sent" BOOLEAN NOT NULL DEFAULT false,
    "endAlert18mSent" BOOLEAN NOT NULL DEFAULT false,
    "endAlert12mSent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseAmendment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "leaseId" TEXT NOT NULL,
    "amendmentNumber" INTEGER NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amendmentType" "AmendmentType" NOT NULL,
    "previousRentHT" DOUBLE PRECISION,
    "newRentHT" DOUBLE PRECISION,
    "previousEndDate" TIMESTAMP(3),
    "newEndDate" TIMESTAMP(3),
    "otherChanges" JSONB,

    CONSTRAINT "LeaseAmendment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositMovement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseId" TEXT NOT NULL,
    "type" "DepositMovementType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "documentUrl" TEXT,

    CONSTRAINT "DepositMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "leaseId" TEXT NOT NULL,
    "type" "InspectionType" NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "performedBy" TEXT,
    "generalNotes" TEXT,
    "signedFileUrl" TEXT,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionRoom" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "condition" "RoomCondition" NOT NULL,
    "notes" TEXT,

    CONSTRAINT "InspectionRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionPhoto" (
    "id" TEXT NOT NULL,
    "inspectionRoomId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "entityType" "TenantEntityType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyName" TEXT,
    "companyLegalForm" TEXT,
    "siret" TEXT,
    "siren" TEXT,
    "codeAPE" TEXT,
    "vatNumber" TEXT,
    "companyAddress" TEXT,
    "shareCapital" DOUBLE PRECISION,
    "legalRepName" TEXT,
    "legalRepTitle" TEXT,
    "legalRepEmail" TEXT,
    "legalRepPhone" TEXT,
    "kbisFileUrl" TEXT,
    "kbisExpiresAt" TIMESTAMP(3),
    "lastName" TEXT,
    "firstName" TEXT,
    "birthDate" TIMESTAMP(3),
    "birthPlace" TEXT,
    "personalAddress" TEXT,
    "idDocumentUrl" TEXT,
    "idExpiresAt" TIMESTAMP(3),
    "autoEntrepreneurSiret" TEXT,
    "email" TEXT NOT NULL,
    "billingEmail" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "riskIndicator" "RiskIndicator" NOT NULL DEFAULT 'VERT',
    "notes" TEXT,
    "insuranceFileUrl" TEXT,
    "insuranceStoragePath" TEXT,
    "insuranceUploadedAt" TIMESTAMP(3),
    "insuranceExpiresAt" TIMESTAMP(3),
    "insuranceReminderSentAt" TIMESTAMP(3),

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantContact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,

    CONSTRAINT "TenantContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guarantee" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaseId" TEXT,
    "type" "GuaranteeType" NOT NULL,
    "status" "GuaranteeStatus" NOT NULL DEFAULT 'ACTIF',
    "depositAmount" DOUBLE PRECISION,
    "depositReceivedAt" TIMESTAMP(3),
    "depositAccountInfo" TEXT,
    "guarantorName" TEXT,
    "guarantorAddress" TEXT,
    "guarantorIdUrl" TEXT,
    "maxAmount" DOUBLE PRECISION,
    "deedFileUrl" TEXT,
    "engagementEndDate" TIMESTAMP(3),
    "bankName" TEXT,
    "bankAmount" DOUBLE PRECISION,
    "bankExpiresAt" TIMESTAMP(3),
    "bankDocumentUrl" TEXT,
    "insurerName" TEXT,
    "contractNumber" TEXT,
    "coveredAmount" DOUBLE PRECISION,
    "gliExpiresAt" TIMESTAMP(3),
    "gliDocumentUrl" TEXT,
    "alertSent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Guarantee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantDocument" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "status" "DocumentCheckStatus" NOT NULL DEFAULT 'MANQUANT',
    "fileUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "alertSent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "TenantDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantPortalAccess" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activationCode" TEXT,
    "activationCodeExpiresAt" TIMESTAMP(3),

    CONSTRAINT "TenantPortalAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InseeIndex" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indexType" "IndexType" NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "InseeIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentRevision" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "leaseId" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "previousRentHT" DOUBLE PRECISION NOT NULL,
    "newRentHT" DOUBLE PRECISION NOT NULL,
    "indexType" "IndexType" NOT NULL,
    "baseIndexValue" DOUBLE PRECISION NOT NULL,
    "newIndexValue" DOUBLE PRECISION NOT NULL,
    "formula" TEXT,
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "validatedAt" TIMESTAMP(3),
    "validatedBy" TEXT,
    "notificationFileUrl" TEXT,
    "amendmentFileUrl" TEXT,

    CONSTRAINT "RentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocietyChargeCategory" (
    "id" TEXT NOT NULL,
    "societyId" TEXT,
    "name" TEXT NOT NULL,
    "nature" "ChargeNature" NOT NULL,
    "recoverableRate" DOUBLE PRECISION,
    "allocationMethod" "AllocationMethod" NOT NULL DEFAULT 'TANTIEME',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocietyChargeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeCategory" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nature" "ChargeNature" NOT NULL,
    "recoverableRate" DOUBLE PRECISION DEFAULT 100,
    "allocationMethod" "AllocationMethod" NOT NULL DEFAULT 'TANTIEME',
    "description" TEXT,
    "societyChargeCategoryId" TEXT,

    CONSTRAINT "ChargeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "invoiceUrl" TEXT,
    "supplierName" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationKey" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "method" "AllocationMethod" NOT NULL,

    CONSTRAINT "AllocationKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationKeyEntry" (
    "id" TEXT NOT NULL,
    "allocationKeyId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "AllocationKeyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeProvision" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Provision sur charges',
    "monthlyAmount" DOUBLE PRECISION NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChargeProvision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeRegularization" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalCharges" DOUBLE PRECISION NOT NULL,
    "totalProvisions" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "details" JSONB,
    "statementFileUrl" TEXT,
    "isFinalized" BOOLEAN NOT NULL DEFAULT false,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "ChargeRegularization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL,
    "meterType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kWh',

    CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "leaseId" TEXT,
    "tenantId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceType" "InvoiceType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "totalHT" DOUBLE PRECISION NOT NULL,
    "totalVAT" DOUBLE PRECISION NOT NULL,
    "totalTTC" DOUBLE PRECISION NOT NULL,
    "fileUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "sentBy" TEXT,
    "resendEmailId" TEXT,
    "emailDeliveryStatus" TEXT,
    "validatedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "creditNoteForId" TEXT,
    "sepaPaymentId" TEXT,
    "sepaStatus" "SepaPaymentStatus",
    "isThirdPartyManaged" BOOLEAN NOT NULL DEFAULT false,
    "managementFeeHT" DOUBLE PRECISION,
    "managementFeeVAT" DOUBLE PRECISION,
    "managementFeeTTC" DOUBLE PRECISION,
    "expectedNetAmount" DOUBLE PRECISION,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "totalHT" DOUBLE PRECISION NOT NULL,
    "totalVAT" DOUBLE PRECISION NOT NULL,
    "totalTTC" DOUBLE PRECISION NOT NULL,
    "accountingAccountCode" TEXT,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankConnection" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'POWENS',
    "institutionName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3),
    "powensUserId" TEXT,
    "connectorId" TEXT,
    "powensAccessToken" TEXT,
    "powensConnectionId" TEXT,
    "qontoSlugEncrypted" TEXT,
    "qontoSecretKeyEncrypted" TEXT,

    CONSTRAINT "BankConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "ibanEncrypted" TEXT NOT NULL,
    "initialBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "powensAccountId" TEXT,
    "qontoAccountId" TEXT,
    "connectionId" TEXT,
    "lastSyncAt" TIMESTAMP(3),

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bankAccountId" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "valueDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "reference" TEXT,
    "category" TEXT,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "importBatch" TEXT,
    "externalId" TEXT,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReconciliation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "validatedAt" TIMESTAMP(3),
    "validatedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "BankReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchingRule" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "matchField" TEXT NOT NULL,
    "matchPattern" TEXT NOT NULL,
    "toleranceAmount" DOUBLE PRECISION DEFAULT 0,
    "toleranceDays" INTEGER DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MatchingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingAccount" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "accountType" "AccountType",
    "sensNormal" "SensNormal",
    "refContrat" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AccountingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "societyId" TEXT NOT NULL,
    "journalType" "JournalType" NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "piece" TEXT,
    "label" TEXT NOT NULL,
    "reference" TEXT,
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "status" "EntryStatus" NOT NULL DEFAULT 'BROUILLON',
    "fiscalYearId" TEXT,
    "validatedById" TEXT,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntryLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "label" TEXT,
    "lettrage" TEXT,
    "letteringCode" TEXT,
    "letteredAt" TIMESTAMP(3),

    CONSTRAINT "JournalEntryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalYear" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,

    CONSTRAINT "FiscalYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderScenario" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReminderScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderStep" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "level" "ReminderLevel" NOT NULL,
    "daysAfterDue" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "includeRIB" BOOLEAN NOT NULL DEFAULT false,
    "mentionPenalties" BOOLEAN NOT NULL DEFAULT false,
    "requiresValidation" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReminderStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseId" TEXT NOT NULL,
    "tenantId" TEXT,
    "level" "ReminderLevel" NOT NULL,
    "invoiceIds" TEXT[],
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fileUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "emailStatus" TEXT,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT,
    "tenantId" TEXT,
    "contactType" "ContactType" NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "specialty" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "addressLine1" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactNote" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "ContactNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "societyId" TEXT,
    "senderName" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "senderPhone" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "lotId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "linkedTenantId" TEXT,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LetterTemplate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "variables" TEXT[],

    CONSTRAINT "LetterTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rentHC" DOUBLE PRECISION NOT NULL,
    "charges" DOUBLE PRECISION,
    "area" DOUBLE PRECISION NOT NULL,
    "features" JSONB,
    "dpeRating" TEXT,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'BROUILLON',
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementPhoto" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AnnouncementPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementPublication" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "announcementId" TEXT NOT NULL,
    "platform" "PublicationPlatform" NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'EN_COURS',
    "externalId" TEXT,
    "externalUrl" TEXT,
    "error" TEXT,
    "publishedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "AnnouncementPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "societyId" TEXT NOT NULL,
    "buildingId" TEXT,
    "lotId" TEXT,
    "leaseId" TEXT,
    "tenantId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "category" TEXT,
    "description" TEXT,
    "expiresAt" TIMESTAMP(3),
    "storagePath" TEXT,
    "aiSummary" TEXT,
    "aiTags" TEXT[],
    "aiMetadata" JSONB,
    "aiAnalyzedAt" TIMESTAMP(3),
    "aiStatus" TEXT,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataProcessingRecord" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT NOT NULL,
    "dataCategories" TEXT[],
    "legalBasis" TEXT NOT NULL,
    "recipients" TEXT[],
    "retentionDays" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DataProcessingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GdprRequest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "GdprRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "buildingId" TEXT,
    "label" TEXT NOT NULL,
    "lender" TEXT NOT NULL,
    "loanType" "LoanType" NOT NULL DEFAULT 'AMORTISSABLE',
    "status" "LoanStatus" NOT NULL DEFAULT 'EN_COURS',
    "amount" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "insuranceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationMonths" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "purchaseValue" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanAmortizationLine" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "principalPayment" DOUBLE PRECISION NOT NULL,
    "interestPayment" DOUBLE PRECISION NOT NULL,
    "insurancePayment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPayment" DOUBLE PRECISION NOT NULL,
    "remainingBalance" DOUBLE PRECISION NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "LoanAmortizationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "accountId" TEXT NOT NULL,
    "budgetAmount" DOUBLE PRECISION NOT NULL,
    "label" TEXT,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isGranted" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureRequest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "status" "SignatureStatus" NOT NULL,
    "documentType" "SignatureDocumentType" NOT NULL,
    "documentId" TEXT,
    "documentName" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerClientId" TEXT,
    "subject" TEXT,
    "message" TEXT,
    "leaseId" TEXT,
    "signedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "signedDocumentUrl" TEXT,
    "signedDocumentStoragePath" TEXT,

    CONSTRAINT "SignatureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SepaMandate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "gocardlessId" TEXT NOT NULL,
    "status" "SepaMandateStatus" NOT NULL DEFAULT 'PENDING_SUBMISSION',
    "ibanLast4" TEXT,
    "bankName" TEXT,
    "mandateReference" TEXT,
    "signedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,

    CONSTRAINT "SepaMandate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dataroom" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "createdBy" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "shareToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BROUILLON',
    "expiresAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3),
    "password" TEXT,
    "recipientEmail" TEXT,
    "recipientName" TEXT,
    "purpose" TEXT,

    CONSTRAINT "Dataroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataroomDocument" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataroomId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "section" TEXT,

    CONSTRAINT "DataroomDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataroomAccess" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataroomId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "viewerEmail" TEXT,
    "viewerName" TEXT,

    CONSTRAINT "DataroomAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "planId" "PlanId" NOT NULL DEFAULT 'STARTER',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSchedule" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" "ReportFrequency" NOT NULL,
    "reportTypes" TEXT[],
    "recipients" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyValuation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "buildingId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "valuationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ValuationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "estimatedValueLow" DOUBLE PRECISION,
    "estimatedValueMid" DOUBLE PRECISION,
    "estimatedValueHigh" DOUBLE PRECISION,
    "estimatedRentalValue" DOUBLE PRECISION,
    "pricePerSqm" DOUBLE PRECISION,
    "capitalizationRate" DOUBLE PRECISION,

    CONSTRAINT "PropertyValuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiValuationAnalysis" (
    "id" TEXT NOT NULL,
    "valuationId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "inputPayload" JSONB NOT NULL,
    "rawResponse" TEXT NOT NULL,
    "structuredResult" JSONB NOT NULL,
    "estimatedValue" DOUBLE PRECISION,
    "rentalValue" DOUBLE PRECISION,
    "pricePerSqm" DOUBLE PRECISION,
    "capRate" DOUBLE PRECISION,
    "methodology" TEXT,
    "strengths" JSONB,
    "weaknesses" JSONB,
    "opportunities" JSONB,
    "threats" JSONB,
    "confidence" DOUBLE PRECISION,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,
    "tokenCount" INTEGER,
    "cost" DOUBLE PRECISION,

    CONSTRAINT "AiValuationAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpertReport" (
    "id" TEXT NOT NULL,
    "valuationId" TEXT NOT NULL,
    "expertName" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "reportReference" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "extractedData" JSONB NOT NULL,
    "estimatedValue" DOUBLE PRECISION,
    "rentalValue" DOUBLE PRECISION,
    "pricePerSqm" DOUBLE PRECISION,
    "capRate" DOUBLE PRECISION,
    "usableArea" DOUBLE PRECISION,
    "methodology" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpertReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparableSale" (
    "id" TEXT NOT NULL,
    "valuationId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceReference" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "salePrice" DOUBLE PRECISION NOT NULL,
    "builtArea" DOUBLE PRECISION,
    "landArea" DOUBLE PRECISION,
    "pricePerSqm" DOUBLE PRECISION,
    "propertyType" TEXT NOT NULL,
    "buildingAge" TEXT,
    "distanceKm" DOUBLE PRECISION,
    "relevanceScore" DOUBLE PRECISION,
    "relevanceComment" TEXT,

    CONSTRAINT "ComparableSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsolidatedReport" (
    "id" TEXT NOT NULL,
    "valuationId" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "reportContent" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,

    CONSTRAINT "ConsolidatedReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentValuation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "leaseId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "valuationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RentValuationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "currentRent" DOUBLE PRECISION,
    "estimatedMarketRent" DOUBLE PRECISION,
    "estimatedRentLow" DOUBLE PRECISION,
    "estimatedRentHigh" DOUBLE PRECISION,
    "rentPerSqm" DOUBLE PRECISION,
    "deviationPercent" DOUBLE PRECISION,

    CONSTRAINT "RentValuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentAiAnalysis" (
    "id" TEXT NOT NULL,
    "rentValuationId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "inputPayload" JSONB NOT NULL,
    "rawResponse" TEXT NOT NULL,
    "structuredResult" JSONB NOT NULL,
    "estimatedRent" DOUBLE PRECISION,
    "rentPerSqm" DOUBLE PRECISION,
    "methodology" TEXT,
    "strengths" JSONB,
    "weaknesses" JSONB,
    "opportunities" JSONB,
    "threats" JSONB,
    "confidence" DOUBLE PRECISION,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,
    "tokenCount" INTEGER,
    "cost" DOUBLE PRECISION,

    CONSTRAINT "RentAiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparableRent" (
    "id" TEXT NOT NULL,
    "rentValuationId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceReference" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "rentDate" TIMESTAMP(3) NOT NULL,
    "annualRent" DOUBLE PRECISION NOT NULL,
    "area" DOUBLE PRECISION,
    "rentPerSqm" DOUBLE PRECISION,
    "propertyType" TEXT NOT NULL,
    "leaseType" TEXT,
    "distanceKm" DOUBLE PRECISION,
    "relevanceScore" DOUBLE PRECISION,
    "relevanceComment" TEXT,

    CONSTRAINT "ComparableRent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentConsolidatedReport" (
    "id" TEXT NOT NULL,
    "rentValuationId" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "reportContent" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,

    CONSTRAINT "RentConsolidatedReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseTemplate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "leaseType" "LeaseType" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "headerContent" TEXT,
    "partiesClause" TEXT,
    "premisesClause" TEXT,
    "durationClause" TEXT,
    "rentClause" TEXT,
    "depositClause" TEXT,
    "indexationClause" TEXT,
    "chargesClause" TEXT,
    "useClause" TEXT,
    "maintenanceClause" TEXT,
    "insuranceClause" TEXT,
    "terminationClause" TEXT,
    "specialConditions" TEXT,
    "signatureClause" TEXT,
    "defaultDurationMonths" INTEGER,
    "defaultPaymentFrequency" "PaymentFrequency",
    "defaultBillingTerm" "BillingTerm",
    "defaultVatApplicable" BOOLEAN,
    "defaultVatRate" DOUBLE PRECISION,
    "defaultIndexType" "IndexType",
    "defaultDepositMonths" INTEGER,

    CONSTRAINT "LeaseTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMALE',
    "status" "TicketStatus" NOT NULL DEFAULT 'OUVERT',
    "lotId" TEXT,
    "location" TEXT,
    "attachmentUrls" JSONB,
    "attachmentPaths" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "assignedToId" TEXT,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticketId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachmentUrls" JSONB,
    "attachmentPaths" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagementReport" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "grossRent" DOUBLE PRECISION NOT NULL,
    "chargesAmount" DOUBLE PRECISION,
    "feeAmountHT" DOUBLE PRECISION NOT NULL,
    "feeAmountTTC" DOUBLE PRECISION NOT NULL,
    "netTransfer" DOUBLE PRECISION NOT NULL,
    "reportFileUrl" TEXT,
    "reportFileStoragePath" TEXT,
    "aiAnalyzed" BOOLEAN NOT NULL DEFAULT false,
    "aiRawResponse" JSONB,
    "aiConfidence" DOUBLE PRECISION,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciledPaymentId" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "ManagementReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Copropriete" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "totalTantiemes" INTEGER NOT NULL,
    "fiscalYearStart" INTEGER NOT NULL DEFAULT 1,
    "siret" TEXT,
    "notes" TEXT,

    CONSTRAINT "Copropriete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoproLot" (
    "id" TEXT NOT NULL,
    "coproprieteId" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerEmail" TEXT,
    "tantiemes" INTEGER NOT NULL,
    "description" TEXT,
    "floor" TEXT,
    "area" DOUBLE PRECISION,

    CONSTRAINT "CoproLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoproBudget" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "coproprieteId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "CoproBudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "lines" JSONB NOT NULL,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByAssemblyId" TEXT,

    CONSTRAINT "CoproBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoproAssembly" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "coproprieteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "CoproAssemblyType" NOT NULL DEFAULT 'ORDINAIRE',
    "status" "CoproAssemblyStatus" NOT NULL DEFAULT 'PLANNED',
    "location" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "quorumRequired" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "convocationSentAt" TIMESTAMP(3),
    "convocationFileUrl" TEXT,
    "pvFileUrl" TEXT,
    "pvApprovedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "CoproAssembly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoproResolution" (
    "id" TEXT NOT NULL,
    "assemblyId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "majority" "CoproMajority" NOT NULL DEFAULT 'SIMPLE',
    "status" "CoproResolutionStatus" NOT NULL DEFAULT 'PENDING',
    "votesFor" INTEGER NOT NULL DEFAULT 0,
    "votesAgainst" INTEGER NOT NULL DEFAULT 0,
    "abstentions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CoproResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoproVote" (
    "id" TEXT NOT NULL,
    "resolutionId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "vote" "CoproVoteChoice" NOT NULL,
    "proxy" BOOLEAN NOT NULL DEFAULT false,
    "proxyName" TEXT,

    CONSTRAINT "CoproVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonalProperty" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "lotId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'France',
    "propertyType" "SeasonalPropertyType" NOT NULL DEFAULT 'APARTMENT',
    "capacity" INTEGER NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "area" DOUBLE PRECISION,
    "amenities" JSONB,
    "photos" JSONB,
    "checkInTime" TEXT NOT NULL DEFAULT '15:00',
    "checkOutTime" TEXT NOT NULL DEFAULT '11:00',
    "minStay" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "otaConnections" JSONB,
    "icalUrl" TEXT,

    CONSTRAINT "SeasonalProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonalBooking" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "propertyId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "guestCount" INTEGER NOT NULL DEFAULT 1,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "nights" INTEGER NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "cleaningFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netRevenue" DOUBLE PRECISION NOT NULL,
    "status" "SeasonalBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "source" TEXT,
    "externalId" TEXT,
    "notes" TEXT,

    CONSTRAINT "SeasonalBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonalPricing" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "pricePerNight" DOUBLE PRECISION NOT NULL,
    "weeklyDiscount" DOUBLE PRECISION,
    "monthlyDiscount" DOUBLE PRECISION,

    CONSTRAINT "SeasonalPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonalBlockedDate" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "SeasonalBlockedDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidatePipeline" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "societyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stages" JSONB NOT NULL,

    CONSTRAINT "CandidatePipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "pipelineId" TEXT,
    "lotId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "stageId" TEXT,
    "score" INTEGER,
    "source" TEXT,
    "status" "CandidateStatus" NOT NULL DEFAULT 'NEW',
    "monthlyIncome" DOUBLE PRECISION,
    "guarantorName" TEXT,
    "desiredMoveIn" TIMESTAMP(3),
    "notes" TEXT,
    "documents" JSONB,
    "tags" JSONB,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateActivity" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidateId" TEXT NOT NULL,
    "type" "CandidateActivityType" NOT NULL,
    "content" TEXT,
    "userId" TEXT,

    CONSTRAINT "CandidateActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "trigger" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "runCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workflowId" TEXT NOT NULL,
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'RUNNING',
    "triggeredBy" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "stepResults" JSONB,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Society_siret_key" ON "Society"("siret");

-- CreateIndex
CREATE INDEX "Society_siret_idx" ON "Society"("siret");

-- CreateIndex
CREATE INDEX "Society_proprietaireId_idx" ON "Society"("proprietaireId");

-- CreateIndex
CREATE INDEX "Proprietaire_userId_idx" ON "Proprietaire"("userId");

-- CreateIndex
CREATE INDEX "ProprietaireAssocie_proprietaireId_idx" ON "ProprietaireAssocie"("proprietaireId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserSociety_societyId_idx" ON "UserSociety"("societyId");

-- CreateIndex
CREATE INDEX "UserSociety_userId_idx" ON "UserSociety"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSociety_userId_societyId_key" ON "UserSociety"("userId", "societyId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "AuditLog_societyId_createdAt_idx" ON "AuditLog"("societyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_societyId_entity_entityId_idx" ON "AuditLog"("societyId", "entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "Building_societyId_idx" ON "Building"("societyId");

-- CreateIndex
CREATE INDEX "Building_societyId_city_idx" ON "Building"("societyId", "city");

-- CreateIndex
CREATE INDEX "AdditionalAcquisition_buildingId_idx" ON "AdditionalAcquisition"("buildingId");

-- CreateIndex
CREATE INDEX "AdditionalAcquisition_societyId_idx" ON "AdditionalAcquisition"("societyId");

-- CreateIndex
CREATE INDEX "Diagnostic_buildingId_idx" ON "Diagnostic"("buildingId");

-- CreateIndex
CREATE INDEX "Diagnostic_expiresAt_idx" ON "Diagnostic"("expiresAt");

-- CreateIndex
CREATE INDEX "Lot_buildingId_idx" ON "Lot"("buildingId");

-- CreateIndex
CREATE INDEX "Lot_status_idx" ON "Lot"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_buildingId_number_key" ON "Lot"("buildingId", "number");

-- CreateIndex
CREATE INDEX "Maintenance_buildingId_idx" ON "Maintenance"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "Lease_leaseNumber_key" ON "Lease"("leaseNumber");

-- CreateIndex
CREATE INDEX "Lease_societyId_idx" ON "Lease"("societyId");

-- CreateIndex
CREATE INDEX "Lease_lotId_idx" ON "Lease"("lotId");

-- CreateIndex
CREATE INDEX "Lease_tenantId_idx" ON "Lease"("tenantId");

-- CreateIndex
CREATE INDEX "Lease_societyId_status_idx" ON "Lease"("societyId", "status");

-- CreateIndex
CREATE INDEX "Lease_endDate_idx" ON "Lease"("endDate");

-- CreateIndex
CREATE INDEX "Lease_leaseTemplateId_idx" ON "Lease"("leaseTemplateId");

-- CreateIndex
CREATE INDEX "Lease_isThirdPartyManaged_idx" ON "Lease"("isThirdPartyManaged");

-- CreateIndex
CREATE INDEX "LeaseAmendment_leaseId_idx" ON "LeaseAmendment"("leaseId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaseAmendment_leaseId_amendmentNumber_key" ON "LeaseAmendment"("leaseId", "amendmentNumber");

-- CreateIndex
CREATE INDEX "DepositMovement_leaseId_idx" ON "DepositMovement"("leaseId");

-- CreateIndex
CREATE INDEX "Inspection_leaseId_idx" ON "Inspection"("leaseId");

-- CreateIndex
CREATE INDEX "InspectionRoom_inspectionId_idx" ON "InspectionRoom"("inspectionId");

-- CreateIndex
CREATE INDEX "InspectionPhoto_inspectionRoomId_idx" ON "InspectionPhoto"("inspectionRoomId");

-- CreateIndex
CREATE INDEX "Tenant_societyId_idx" ON "Tenant"("societyId");

-- CreateIndex
CREATE INDEX "Tenant_societyId_isActive_idx" ON "Tenant"("societyId", "isActive");

-- CreateIndex
CREATE INDEX "Tenant_email_idx" ON "Tenant"("email");

-- CreateIndex
CREATE INDEX "TenantContact_tenantId_idx" ON "TenantContact"("tenantId");

-- CreateIndex
CREATE INDEX "Guarantee_tenantId_idx" ON "Guarantee"("tenantId");

-- CreateIndex
CREATE INDEX "Guarantee_bankExpiresAt_idx" ON "Guarantee"("bankExpiresAt");

-- CreateIndex
CREATE INDEX "Guarantee_gliExpiresAt_idx" ON "Guarantee"("gliExpiresAt");

-- CreateIndex
CREATE INDEX "TenantDocument_tenantId_idx" ON "TenantDocument"("tenantId");

-- CreateIndex
CREATE INDEX "TenantDocument_status_idx" ON "TenantDocument"("status");

-- CreateIndex
CREATE INDEX "TenantDocument_expiresAt_idx" ON "TenantDocument"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenantPortalAccess_tenantId_key" ON "TenantPortalAccess"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantPortalAccess_token_key" ON "TenantPortalAccess"("token");

-- CreateIndex
CREATE INDEX "TenantPortalAccess_token_idx" ON "TenantPortalAccess"("token");

-- CreateIndex
CREATE INDEX "InseeIndex_indexType_year_quarter_idx" ON "InseeIndex"("indexType", "year", "quarter");

-- CreateIndex
CREATE UNIQUE INDEX "InseeIndex_indexType_year_quarter_key" ON "InseeIndex"("indexType", "year", "quarter");

-- CreateIndex
CREATE INDEX "RentRevision_leaseId_idx" ON "RentRevision"("leaseId");

-- CreateIndex
CREATE INDEX "RentRevision_leaseId_effectiveDate_idx" ON "RentRevision"("leaseId", "effectiveDate");

-- CreateIndex
CREATE INDEX "RentRevision_leaseId_isValidated_idx" ON "RentRevision"("leaseId", "isValidated");

-- CreateIndex
CREATE INDEX "SocietyChargeCategory_societyId_idx" ON "SocietyChargeCategory"("societyId");

-- CreateIndex
CREATE INDEX "SocietyChargeCategory_isGlobal_idx" ON "SocietyChargeCategory"("isGlobal");

-- CreateIndex
CREATE UNIQUE INDEX "SocietyChargeCategory_societyId_name_key" ON "SocietyChargeCategory"("societyId", "name");

-- CreateIndex
CREATE INDEX "ChargeCategory_societyId_idx" ON "ChargeCategory"("societyId");

-- CreateIndex
CREATE INDEX "ChargeCategory_buildingId_idx" ON "ChargeCategory"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeCategory_buildingId_name_key" ON "ChargeCategory"("buildingId", "name");

-- CreateIndex
CREATE INDEX "Charge_societyId_idx" ON "Charge"("societyId");

-- CreateIndex
CREATE INDEX "Charge_buildingId_idx" ON "Charge"("buildingId");

-- CreateIndex
CREATE INDEX "Charge_categoryId_idx" ON "Charge"("categoryId");

-- CreateIndex
CREATE INDEX "Charge_societyId_date_idx" ON "Charge"("societyId", "date");

-- CreateIndex
CREATE INDEX "AllocationKey_categoryId_idx" ON "AllocationKey"("categoryId");

-- CreateIndex
CREATE INDEX "AllocationKeyEntry_lotId_idx" ON "AllocationKeyEntry"("lotId");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationKeyEntry_allocationKeyId_lotId_key" ON "AllocationKeyEntry"("allocationKeyId", "lotId");

-- CreateIndex
CREATE INDEX "ChargeProvision_leaseId_idx" ON "ChargeProvision"("leaseId");

-- CreateIndex
CREATE INDEX "ChargeProvision_lotId_idx" ON "ChargeProvision"("lotId");

-- CreateIndex
CREATE INDEX "ChargeRegularization_leaseId_idx" ON "ChargeRegularization"("leaseId");

-- CreateIndex
CREATE INDEX "ChargeRegularization_societyId_idx" ON "ChargeRegularization"("societyId");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeRegularization_leaseId_fiscalYear_key" ON "ChargeRegularization"("leaseId", "fiscalYear");

-- CreateIndex
CREATE INDEX "MeterReading_lotId_idx" ON "MeterReading"("lotId");

-- CreateIndex
CREATE INDEX "MeterReading_lotId_meterType_readAt_idx" ON "MeterReading"("lotId", "meterType", "readAt");

-- CreateIndex
CREATE INDEX "Invoice_societyId_idx" ON "Invoice"("societyId");

-- CreateIndex
CREATE INDEX "Invoice_societyId_status_idx" ON "Invoice"("societyId", "status");

-- CreateIndex
CREATE INDEX "Invoice_societyId_invoiceType_status_idx" ON "Invoice"("societyId", "invoiceType", "status");

-- CreateIndex
CREATE INDEX "Invoice_societyId_issueDate_idx" ON "Invoice"("societyId", "issueDate");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");

-- CreateIndex
CREATE INDEX "Invoice_leaseId_idx" ON "Invoice"("leaseId");

-- CreateIndex
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

-- CreateIndex
CREATE INDEX "Invoice_creditNoteForId_idx" ON "Invoice"("creditNoteForId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_societyId_invoiceNumber_key" ON "Invoice"("societyId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "BankConnection_powensUserId_key" ON "BankConnection"("powensUserId");

-- CreateIndex
CREATE INDEX "BankConnection_societyId_idx" ON "BankConnection"("societyId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_powensAccountId_key" ON "BankAccount"("powensAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_qontoAccountId_key" ON "BankAccount"("qontoAccountId");

-- CreateIndex
CREATE INDEX "BankAccount_societyId_idx" ON "BankAccount"("societyId");

-- CreateIndex
CREATE INDEX "BankTransaction_bankAccountId_idx" ON "BankTransaction"("bankAccountId");

-- CreateIndex
CREATE INDEX "BankTransaction_bankAccountId_transactionDate_idx" ON "BankTransaction"("bankAccountId", "transactionDate");

-- CreateIndex
CREATE INDEX "BankTransaction_isReconciled_idx" ON "BankTransaction"("isReconciled");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_bankAccountId_externalId_key" ON "BankTransaction"("bankAccountId", "externalId");

-- CreateIndex
CREATE INDEX "BankReconciliation_transactionId_idx" ON "BankReconciliation"("transactionId");

-- CreateIndex
CREATE INDEX "BankReconciliation_paymentId_idx" ON "BankReconciliation"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "BankReconciliation_transactionId_paymentId_key" ON "BankReconciliation"("transactionId", "paymentId");

-- CreateIndex
CREATE INDEX "MatchingRule_societyId_idx" ON "MatchingRule"("societyId");

-- CreateIndex
CREATE INDEX "AccountingAccount_societyId_idx" ON "AccountingAccount"("societyId");

-- CreateIndex
CREATE INDEX "AccountingAccount_societyId_type_idx" ON "AccountingAccount"("societyId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingAccount_societyId_code_key" ON "AccountingAccount"("societyId", "code");

-- CreateIndex
CREATE INDEX "JournalEntry_societyId_idx" ON "JournalEntry"("societyId");

-- CreateIndex
CREATE INDEX "JournalEntry_societyId_journalType_entryDate_idx" ON "JournalEntry"("societyId", "journalType", "entryDate");

-- CreateIndex
CREATE INDEX "JournalEntryLine_journalEntryId_idx" ON "JournalEntryLine"("journalEntryId");

-- CreateIndex
CREATE INDEX "JournalEntryLine_accountId_idx" ON "JournalEntryLine"("accountId");

-- CreateIndex
CREATE INDEX "JournalEntryLine_lettrage_idx" ON "JournalEntryLine"("lettrage");

-- CreateIndex
CREATE INDEX "JournalEntryLine_letteringCode_idx" ON "JournalEntryLine"("letteringCode");

-- CreateIndex
CREATE INDEX "FiscalYear_societyId_idx" ON "FiscalYear"("societyId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYear_societyId_year_key" ON "FiscalYear"("societyId", "year");

-- CreateIndex
CREATE INDEX "ReminderScenario_societyId_idx" ON "ReminderScenario"("societyId");

-- CreateIndex
CREATE INDEX "ReminderStep_scenarioId_idx" ON "ReminderStep"("scenarioId");

-- CreateIndex
CREATE INDEX "Reminder_leaseId_idx" ON "Reminder"("leaseId");

-- CreateIndex
CREATE INDEX "Reminder_createdAt_idx" ON "Reminder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_tenantId_key" ON "Contact"("tenantId");

-- CreateIndex
CREATE INDEX "Contact_societyId_idx" ON "Contact"("societyId");

-- CreateIndex
CREATE INDEX "Contact_contactType_idx" ON "Contact"("contactType");

-- CreateIndex
CREATE INDEX "Contact_tenantId_idx" ON "Contact"("tenantId");

-- CreateIndex
CREATE INDEX "ContactNote_contactId_idx" ON "ContactNote"("contactId");

-- CreateIndex
CREATE INDEX "Message_societyId_idx" ON "Message"("societyId");

-- CreateIndex
CREATE INDEX "Message_isRead_idx" ON "Message"("isRead");

-- CreateIndex
CREATE INDEX "LetterTemplate_societyId_idx" ON "LetterTemplate"("societyId");

-- CreateIndex
CREATE UNIQUE INDEX "LetterTemplate_societyId_name_key" ON "LetterTemplate"("societyId", "name");

-- CreateIndex
CREATE INDEX "Announcement_societyId_idx" ON "Announcement"("societyId");

-- CreateIndex
CREATE INDEX "Announcement_status_idx" ON "Announcement"("status");

-- CreateIndex
CREATE INDEX "Announcement_lotId_idx" ON "Announcement"("lotId");

-- CreateIndex
CREATE INDEX "AnnouncementPhoto_announcementId_idx" ON "AnnouncementPhoto"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementPublication_announcementId_idx" ON "AnnouncementPublication"("announcementId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementPublication_announcementId_platform_key" ON "AnnouncementPublication"("announcementId", "platform");

-- CreateIndex
CREATE INDEX "Document_societyId_idx" ON "Document"("societyId");

-- CreateIndex
CREATE INDEX "Document_buildingId_idx" ON "Document"("buildingId");

-- CreateIndex
CREATE INDEX "Document_lotId_idx" ON "Document"("lotId");

-- CreateIndex
CREATE INDEX "Document_leaseId_idx" ON "Document"("leaseId");

-- CreateIndex
CREATE INDEX "Document_tenantId_idx" ON "Document"("tenantId");

-- CreateIndex
CREATE INDEX "Document_expiresAt_idx" ON "Document"("expiresAt");

-- CreateIndex
CREATE INDEX "Document_aiStatus_idx" ON "Document"("aiStatus");

-- CreateIndex
CREATE INDEX "GdprRequest_societyId_idx" ON "GdprRequest"("societyId");

-- CreateIndex
CREATE INDEX "GdprRequest_status_idx" ON "GdprRequest"("status");

-- CreateIndex
CREATE INDEX "GdprRequest_requesterEmail_idx" ON "GdprRequest"("requesterEmail");

-- CreateIndex
CREATE INDEX "Loan_societyId_idx" ON "Loan"("societyId");

-- CreateIndex
CREATE INDEX "Loan_societyId_status_idx" ON "Loan"("societyId", "status");

-- CreateIndex
CREATE INDEX "Loan_buildingId_idx" ON "Loan"("buildingId");

-- CreateIndex
CREATE INDEX "LoanAmortizationLine_loanId_idx" ON "LoanAmortizationLine"("loanId");

-- CreateIndex
CREATE INDEX "LoanAmortizationLine_loanId_dueDate_idx" ON "LoanAmortizationLine"("loanId", "dueDate");

-- CreateIndex
CREATE INDEX "BudgetLine_societyId_idx" ON "BudgetLine"("societyId");

-- CreateIndex
CREATE INDEX "BudgetLine_societyId_year_idx" ON "BudgetLine"("societyId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_societyId_year_month_accountId_key" ON "BudgetLine"("societyId", "year", "month", "accountId");

-- CreateIndex
CREATE INDEX "Consent_email_purpose_idx" ON "Consent"("email", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureRequest_envelopeId_key" ON "SignatureRequest"("envelopeId");

-- CreateIndex
CREATE INDEX "SignatureRequest_societyId_idx" ON "SignatureRequest"("societyId");

-- CreateIndex
CREATE INDEX "SignatureRequest_societyId_status_idx" ON "SignatureRequest"("societyId", "status");

-- CreateIndex
CREATE INDEX "SignatureRequest_leaseId_idx" ON "SignatureRequest"("leaseId");

-- CreateIndex
CREATE UNIQUE INDEX "SepaMandate_gocardlessId_key" ON "SepaMandate"("gocardlessId");

-- CreateIndex
CREATE INDEX "SepaMandate_societyId_idx" ON "SepaMandate"("societyId");

-- CreateIndex
CREATE INDEX "SepaMandate_tenantId_idx" ON "SepaMandate"("tenantId");

-- CreateIndex
CREATE INDEX "SepaMandate_gocardlessId_idx" ON "SepaMandate"("gocardlessId");

-- CreateIndex
CREATE INDEX "Notification_userId_societyId_idx" ON "Notification"("userId", "societyId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_societyId_idx" ON "Notification"("societyId");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Dataroom_shareToken_key" ON "Dataroom"("shareToken");

-- CreateIndex
CREATE INDEX "Dataroom_societyId_idx" ON "Dataroom"("societyId");

-- CreateIndex
CREATE INDEX "Dataroom_shareToken_idx" ON "Dataroom"("shareToken");

-- CreateIndex
CREATE INDEX "Dataroom_expiresAt_idx" ON "Dataroom"("expiresAt");

-- CreateIndex
CREATE INDEX "DataroomDocument_dataroomId_idx" ON "DataroomDocument"("dataroomId");

-- CreateIndex
CREATE UNIQUE INDEX "DataroomDocument_dataroomId_documentId_key" ON "DataroomDocument"("dataroomId", "documentId");

-- CreateIndex
CREATE INDEX "DataroomAccess_dataroomId_idx" ON "DataroomAccess"("dataroomId");

-- CreateIndex
CREATE INDEX "DataroomAccess_dataroomId_createdAt_idx" ON "DataroomAccess"("dataroomId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_societyId_key" ON "Subscription"("societyId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_societyId_idx" ON "Subscription"("societyId");

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "ReportSchedule_societyId_idx" ON "ReportSchedule"("societyId");

-- CreateIndex
CREATE INDEX "ReportSchedule_isActive_nextRunAt_idx" ON "ReportSchedule"("isActive", "nextRunAt");

-- CreateIndex
CREATE INDEX "PropertyValuation_buildingId_idx" ON "PropertyValuation"("buildingId");

-- CreateIndex
CREATE INDEX "PropertyValuation_societyId_idx" ON "PropertyValuation"("societyId");

-- CreateIndex
CREATE INDEX "PropertyValuation_societyId_buildingId_idx" ON "PropertyValuation"("societyId", "buildingId");

-- CreateIndex
CREATE INDEX "AiValuationAnalysis_valuationId_idx" ON "AiValuationAnalysis"("valuationId");

-- CreateIndex
CREATE INDEX "ExpertReport_valuationId_idx" ON "ExpertReport"("valuationId");

-- CreateIndex
CREATE INDEX "ComparableSale_valuationId_idx" ON "ComparableSale"("valuationId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsolidatedReport_valuationId_key" ON "ConsolidatedReport"("valuationId");

-- CreateIndex
CREATE INDEX "RentValuation_leaseId_idx" ON "RentValuation"("leaseId");

-- CreateIndex
CREATE INDEX "RentValuation_societyId_idx" ON "RentValuation"("societyId");

-- CreateIndex
CREATE INDEX "RentValuation_societyId_leaseId_idx" ON "RentValuation"("societyId", "leaseId");

-- CreateIndex
CREATE INDEX "RentAiAnalysis_rentValuationId_idx" ON "RentAiAnalysis"("rentValuationId");

-- CreateIndex
CREATE INDEX "ComparableRent_rentValuationId_idx" ON "ComparableRent"("rentValuationId");

-- CreateIndex
CREATE UNIQUE INDEX "RentConsolidatedReport_rentValuationId_key" ON "RentConsolidatedReport"("rentValuationId");

-- CreateIndex
CREATE INDEX "LeaseTemplate_societyId_idx" ON "LeaseTemplate"("societyId");

-- CreateIndex
CREATE INDEX "LeaseTemplate_societyId_leaseType_idx" ON "LeaseTemplate"("societyId", "leaseType");

-- CreateIndex
CREATE UNIQUE INDEX "LeaseTemplate_societyId_name_key" ON "LeaseTemplate"("societyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");

-- CreateIndex
CREATE INDEX "Ticket_societyId_idx" ON "Ticket"("societyId");

-- CreateIndex
CREATE INDEX "Ticket_societyId_status_idx" ON "Ticket"("societyId", "status");

-- CreateIndex
CREATE INDEX "Ticket_tenantId_idx" ON "Ticket"("tenantId");

-- CreateIndex
CREATE INDEX "Ticket_ticketNumber_idx" ON "Ticket"("ticketNumber");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_idx" ON "TicketMessage"("ticketId");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "ManagementReport_societyId_idx" ON "ManagementReport"("societyId");

-- CreateIndex
CREATE INDEX "ManagementReport_leaseId_idx" ON "ManagementReport"("leaseId");

-- CreateIndex
CREATE INDEX "ManagementReport_periodStart_idx" ON "ManagementReport"("periodStart");

-- CreateIndex
CREATE INDEX "Copropriete_societyId_idx" ON "Copropriete"("societyId");

-- CreateIndex
CREATE INDEX "CoproLot_coproprieteId_idx" ON "CoproLot"("coproprieteId");

-- CreateIndex
CREATE INDEX "CoproBudget_coproprieteId_idx" ON "CoproBudget"("coproprieteId");

-- CreateIndex
CREATE UNIQUE INDEX "CoproBudget_coproprieteId_year_key" ON "CoproBudget"("coproprieteId", "year");

-- CreateIndex
CREATE INDEX "CoproAssembly_coproprieteId_idx" ON "CoproAssembly"("coproprieteId");

-- CreateIndex
CREATE INDEX "CoproAssembly_date_idx" ON "CoproAssembly"("date");

-- CreateIndex
CREATE INDEX "CoproResolution_assemblyId_idx" ON "CoproResolution"("assemblyId");

-- CreateIndex
CREATE INDEX "CoproVote_resolutionId_idx" ON "CoproVote"("resolutionId");

-- CreateIndex
CREATE UNIQUE INDEX "CoproVote_resolutionId_lotId_key" ON "CoproVote"("resolutionId", "lotId");

-- CreateIndex
CREATE INDEX "SeasonalProperty_societyId_idx" ON "SeasonalProperty"("societyId");

-- CreateIndex
CREATE INDEX "SeasonalProperty_lotId_idx" ON "SeasonalProperty"("lotId");

-- CreateIndex
CREATE INDEX "SeasonalBooking_propertyId_idx" ON "SeasonalBooking"("propertyId");

-- CreateIndex
CREATE INDEX "SeasonalBooking_checkIn_idx" ON "SeasonalBooking"("checkIn");

-- CreateIndex
CREATE INDEX "SeasonalBooking_checkOut_idx" ON "SeasonalBooking"("checkOut");

-- CreateIndex
CREATE INDEX "SeasonalPricing_propertyId_idx" ON "SeasonalPricing"("propertyId");

-- CreateIndex
CREATE INDEX "SeasonalPricing_startDate_endDate_idx" ON "SeasonalPricing"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "SeasonalBlockedDate_propertyId_idx" ON "SeasonalBlockedDate"("propertyId");

-- CreateIndex
CREATE INDEX "CandidatePipeline_societyId_idx" ON "CandidatePipeline"("societyId");

-- CreateIndex
CREATE INDEX "Candidate_societyId_idx" ON "Candidate"("societyId");

-- CreateIndex
CREATE INDEX "Candidate_pipelineId_idx" ON "Candidate"("pipelineId");

-- CreateIndex
CREATE INDEX "Candidate_status_idx" ON "Candidate"("status");

-- CreateIndex
CREATE INDEX "CandidateActivity_candidateId_idx" ON "CandidateActivity"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateActivity_createdAt_idx" ON "CandidateActivity"("createdAt");

-- CreateIndex
CREATE INDEX "Workflow_societyId_idx" ON "Workflow"("societyId");

-- CreateIndex
CREATE INDEX "WorkflowRun_workflowId_idx" ON "WorkflowRun"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowRun_createdAt_idx" ON "WorkflowRun"("createdAt");

-- AddForeignKey
ALTER TABLE "Society" ADD CONSTRAINT "Society_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Society" ADD CONSTRAINT "Society_proprietaireId_fkey" FOREIGN KEY ("proprietaireId") REFERENCES "Proprietaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proprietaire" ADD CONSTRAINT "Proprietaire_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProprietaireAssocie" ADD CONSTRAINT "ProprietaireAssocie_proprietaireId_fkey" FOREIGN KEY ("proprietaireId") REFERENCES "Proprietaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSociety" ADD CONSTRAINT "UserSociety_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSociety" ADD CONSTRAINT "UserSociety_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdditionalAcquisition" ADD CONSTRAINT "AdditionalAcquisition_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdditionalAcquisition" ADD CONSTRAINT "AdditionalAcquisition_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnostic" ADD CONSTRAINT "Diagnostic_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_leaseTemplateId_fkey" FOREIGN KEY ("leaseTemplateId") REFERENCES "LeaseTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_managingContactId_fkey" FOREIGN KEY ("managingContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseAmendment" ADD CONSTRAINT "LeaseAmendment_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositMovement" ADD CONSTRAINT "DepositMovement_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRoom" ADD CONSTRAINT "InspectionRoom_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionPhoto" ADD CONSTRAINT "InspectionPhoto_inspectionRoomId_fkey" FOREIGN KEY ("inspectionRoomId") REFERENCES "InspectionRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantContact" ADD CONSTRAINT "TenantContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guarantee" ADD CONSTRAINT "Guarantee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantDocument" ADD CONSTRAINT "TenantDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPortalAccess" ADD CONSTRAINT "TenantPortalAccess_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentRevision" ADD CONSTRAINT "RentRevision_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocietyChargeCategory" ADD CONSTRAINT "SocietyChargeCategory_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeCategory" ADD CONSTRAINT "ChargeCategory_societyChargeCategoryId_fkey" FOREIGN KEY ("societyChargeCategoryId") REFERENCES "SocietyChargeCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeCategory" ADD CONSTRAINT "ChargeCategory_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeCategory" ADD CONSTRAINT "ChargeCategory_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ChargeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationKey" ADD CONSTRAINT "AllocationKey_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ChargeCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationKeyEntry" ADD CONSTRAINT "AllocationKeyEntry_allocationKeyId_fkey" FOREIGN KEY ("allocationKeyId") REFERENCES "AllocationKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationKeyEntry" ADD CONSTRAINT "AllocationKeyEntry_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeProvision" ADD CONSTRAINT "ChargeProvision_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeProvision" ADD CONSTRAINT "ChargeProvision_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeRegularization" ADD CONSTRAINT "ChargeRegularization_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeRegularization" ADD CONSTRAINT "ChargeRegularization_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_creditNoteForId_fkey" FOREIGN KEY ("creditNoteForId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankConnection" ADD CONSTRAINT "BankConnection_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "BankConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "BankTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingAccount" ADD CONSTRAINT "AccountingAccount_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AccountingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalYear" ADD CONSTRAINT "FiscalYear_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalYear" ADD CONSTRAINT "FiscalYear_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderScenario" ADD CONSTRAINT "ReminderScenario_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderStep" ADD CONSTRAINT "ReminderStep_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ReminderScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterTemplate" ADD CONSTRAINT "LetterTemplate_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementPhoto" ADD CONSTRAINT "AnnouncementPhoto_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementPublication" ADD CONSTRAINT "AnnouncementPublication_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GdprRequest" ADD CONSTRAINT "GdprRequest_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanAmortizationLine" ADD CONSTRAINT "LoanAmortizationLine_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AccountingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SepaMandate" ADD CONSTRAINT "SepaMandate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dataroom" ADD CONSTRAINT "Dataroom_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dataroom" ADD CONSTRAINT "Dataroom_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomDocument" ADD CONSTRAINT "DataroomDocument_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomDocument" ADD CONSTRAINT "DataroomDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomAccess" ADD CONSTRAINT "DataroomAccess_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyValuation" ADD CONSTRAINT "PropertyValuation_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyValuation" ADD CONSTRAINT "PropertyValuation_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiValuationAnalysis" ADD CONSTRAINT "AiValuationAnalysis_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "PropertyValuation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertReport" ADD CONSTRAINT "ExpertReport_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "PropertyValuation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparableSale" ADD CONSTRAINT "ComparableSale_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "PropertyValuation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidatedReport" ADD CONSTRAINT "ConsolidatedReport_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "PropertyValuation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentValuation" ADD CONSTRAINT "RentValuation_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentValuation" ADD CONSTRAINT "RentValuation_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentAiAnalysis" ADD CONSTRAINT "RentAiAnalysis_rentValuationId_fkey" FOREIGN KEY ("rentValuationId") REFERENCES "RentValuation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparableRent" ADD CONSTRAINT "ComparableRent_rentValuationId_fkey" FOREIGN KEY ("rentValuationId") REFERENCES "RentValuation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentConsolidatedReport" ADD CONSTRAINT "RentConsolidatedReport_rentValuationId_fkey" FOREIGN KEY ("rentValuationId") REFERENCES "RentValuation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseTemplate" ADD CONSTRAINT "LeaseTemplate_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementReport" ADD CONSTRAINT "ManagementReport_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementReport" ADD CONSTRAINT "ManagementReport_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Copropriete" ADD CONSTRAINT "Copropriete_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoproLot" ADD CONSTRAINT "CoproLot_coproprieteId_fkey" FOREIGN KEY ("coproprieteId") REFERENCES "Copropriete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoproBudget" ADD CONSTRAINT "CoproBudget_coproprieteId_fkey" FOREIGN KEY ("coproprieteId") REFERENCES "Copropriete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoproAssembly" ADD CONSTRAINT "CoproAssembly_coproprieteId_fkey" FOREIGN KEY ("coproprieteId") REFERENCES "Copropriete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoproResolution" ADD CONSTRAINT "CoproResolution_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "CoproAssembly"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoproVote" ADD CONSTRAINT "CoproVote_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "CoproResolution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoproVote" ADD CONSTRAINT "CoproVote_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "CoproLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonalProperty" ADD CONSTRAINT "SeasonalProperty_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonalBooking" ADD CONSTRAINT "SeasonalBooking_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "SeasonalProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonalPricing" ADD CONSTRAINT "SeasonalPricing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "SeasonalProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonalBlockedDate" ADD CONSTRAINT "SeasonalBlockedDate_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "SeasonalProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidatePipeline" ADD CONSTRAINT "CandidatePipeline_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "CandidatePipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateActivity" ADD CONSTRAINT "CandidateActivity_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

