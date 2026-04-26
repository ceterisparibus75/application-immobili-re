-- RLS multi-tenant MyGestia
-- Date: 2026-04-26
--
-- Objectif:
--   Ajouter une isolation PostgreSQL/Supabase par société sur les tables qui
--   portent un `societyId` direct.
--
-- Principe:
--   L'application doit poser `app.current_society_id` dans la session ou la
--   transaction PostgreSQL avant d'utiliser un rôle soumis à RLS:
--
--     SELECT set_config('app.current_society_id', '<society-id>', true);
--
--   Les connexions propriétaires/superuser peuvent contourner RLS tant que
--   FORCE ROW LEVEL SECURITY n'est pas activé. Cette migration n'active pas
--   FORCE RLS pour éviter une rupture applicative avant branchement explicite
--   du contexte tenant côté Prisma.

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_society_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('app.current_society_id', true), '')
$$;

DO $$
DECLARE
  table_name text;
  required_society_tables text[] := ARRAY[
    'AccountingAccount',
    'AdditionalAcquisition',
    'Announcement',
    'AuditLog',
    'BankAccount',
    'BankConnection',
    'BudgetLine',
    'Building',
    'Candidate',
    'CandidatePipeline',
    'Charge',
    'ChargeCategory',
    'ChargeRegularization',
    'Copropriete',
    'Dataroom',
    'Document',
    'FiscalYear',
    'GdprRequest',
    'Invoice',
    'JournalEntry',
    'Lease',
    'LeaseTemplate',
    'LetterTemplate',
    'Loan',
    'ManagementReport',
    'MatchingRule',
    'Notification',
    'PAOAuthState',
    'PropertyValuation',
    'ReminderScenario',
    'RentValuation',
    'ReportSchedule',
    'SeasonalProperty',
    'SepaMandate',
    'SignatureRequest',
    'Subscription',
    'SupplierInboxConfig',
    'SupplierInvoice',
    'Tenant',
    'ThirdPartyStatement',
    'Ticket',
    'TransactionAutoTag',
    'UserSociety',
    'Workflow'
  ];
  optional_society_tables text[] := ARRAY[
    'Contact',
    'Message',
    'SocietyChargeCategory'
  ];
BEGIN
  FOREACH table_name IN ARRAY required_society_tables LOOP
    IF to_regclass(format('%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('DROP POLICY IF EXISTS mygestia_tenant_isolation ON %I', table_name);
      EXECUTE format(
        'CREATE POLICY mygestia_tenant_isolation ON %I
           USING ("societyId" = app.current_society_id())
           WITH CHECK ("societyId" = app.current_society_id())',
        table_name
      );
    END IF;
  END LOOP;

  FOREACH table_name IN ARRAY optional_society_tables LOOP
    IF to_regclass(format('%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('DROP POLICY IF EXISTS mygestia_tenant_isolation ON %I', table_name);
      EXECUTE format(
        'CREATE POLICY mygestia_tenant_isolation ON %I
           USING ("societyId" IS NULL OR "societyId" = app.current_society_id())
           WITH CHECK ("societyId" IS NULL OR "societyId" = app.current_society_id())',
        table_name
      );
    END IF;
  END LOOP;
END $$;

-- Table Society: l'identifiant de ligne est lui-même le scope tenant.
ALTER TABLE "Society" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mygestia_society_self ON "Society";
CREATE POLICY mygestia_society_self ON "Society"
  USING ("id" = app.current_society_id())
  WITH CHECK ("id" = app.current_society_id());
