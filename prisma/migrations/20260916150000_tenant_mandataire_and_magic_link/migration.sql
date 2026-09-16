-- Mandataires du locataire (comptables, gérants…) qui peuvent accéder au
-- portail au nom du locataire
CREATE TABLE IF NOT EXISTS "TenantMandataire" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT,
    "canAccessPortal" BOOLEAN NOT NULL DEFAULT true,
    "receivesInvoices" BOOLEAN NOT NULL DEFAULT true,
    "receivesQuittances" BOOLEAN NOT NULL DEFAULT true,
    "receivesReminders" BOOLEAN NOT NULL DEFAULT true,
    "receivesDocuments" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "TenantMandataire_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantMandataire_tenantId_email_key" ON "TenantMandataire"("tenantId", "email");
CREATE INDEX IF NOT EXISTS "TenantMandataire_email_idx" ON "TenantMandataire"("email");
CREATE INDEX IF NOT EXISTS "TenantMandataire_tenantId_idx" ON "TenantMandataire"("tenantId");

-- FK vers Tenant (cascade on delete)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TenantMandataire_tenantId_fkey'
    ) THEN
        ALTER TABLE "TenantMandataire"
            ADD CONSTRAINT "TenantMandataire_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- Magic link portail à usage unique
CREATE TABLE IF NOT EXISTS "PortalMagicLink" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "mandataireId" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "PortalMagicLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PortalMagicLink_token_key" ON "PortalMagicLink"("token");
CREATE INDEX IF NOT EXISTS "PortalMagicLink_token_idx" ON "PortalMagicLink"("token");
CREATE INDEX IF NOT EXISTS "PortalMagicLink_tenantId_idx" ON "PortalMagicLink"("tenantId");
CREATE INDEX IF NOT EXISTS "PortalMagicLink_expiresAt_idx" ON "PortalMagicLink"("expiresAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PortalMagicLink_tenantId_fkey'
    ) THEN
        ALTER TABLE "PortalMagicLink"
            ADD CONSTRAINT "PortalMagicLink_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PortalMagicLink_mandataireId_fkey'
    ) THEN
        ALTER TABLE "PortalMagicLink"
            ADD CONSTRAINT "PortalMagicLink_mandataireId_fkey"
            FOREIGN KEY ("mandataireId") REFERENCES "TenantMandataire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;
