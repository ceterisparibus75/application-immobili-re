/**
 * GoCardless Payments API — Prélèvement SEPA
 *
 * Variables d'env requises :
 *   GOCARDLESS_PAYMENTS_KEY  — Clé API GoCardless Payments (Bearer token)
 *   GOCARDLESS_PAYMENTS_ENV  — "sandbox" ou "live" (défaut : sandbox)
 *   GOCARDLESS_PAYMENTS_CREDITOR_ID — ID créditeur SEPA GoCardless
 */

const BASE_URL = process.env.GOCARDLESS_PAYMENTS_ENV === "live"
  ? "https://api.gocardless.com"
  : "https://api-sandbox.gocardless.com";

function headers() {
  const key = process.env.GOCARDLESS_PAYMENTS_KEY;
  if (!key) throw new Error("GOCARDLESS_PAYMENTS_KEY non définie");
  return {
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    "GoCardless-Version": "2015-07-06",
  };
}

async function gcFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GoCardless ${method} ${path} -> ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────

export interface GcCustomer {
  id: string;
  email: string;
  given_name: string;
  family_name: string;
  company_name?: string;
  address_line1?: string;
  city?: string;
  postal_code?: string;
  country_code?: string;
}

export interface GcMandate {
  id: string;
  status: string;
  scheme: string;
  reference: string;
  created_at: string;
  links: { customer: string; customer_bank_account: string };
}

export interface GcPayment {
  id: string;
  status: string;
  amount: number; // centimes
  currency: string;
  charge_date: string;
  description?: string;
  reference?: string;
  links: { mandate: string };
}

export interface CreateMandateInput {
  iban: string;
  accountHolderName: string;
  email: string;
  givenName: string;
  familyName: string;
  companyName?: string;
  addressLine1?: string;
  city?: string;
  postalCode?: string;
}

// ── Clients ────────────────────────────────────────────────

export async function createCustomer(input: {
  email: string;
  givenName: string;
  familyName: string;
  companyName?: string;
  addressLine1?: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;
}): Promise<GcCustomer> {
  const res = await gcFetch<{ customers: GcCustomer }>("POST", "/customers", {
    customers: {
      email: input.email,
      given_name: input.givenName,
      family_name: input.familyName,
      company_name: input.companyName,
      address_line1: input.addressLine1,
      city: input.city,
      postal_code: input.postalCode,
      country_code: input.countryCode ?? "FR",
    },
  });
  return res.customers;
}

// ── Comptes bancaires ──────────────────────────────────────

export async function createBankAccount(input: {
  customerId: string;
  iban: string;
  accountHolderName: string;
}): Promise<{ id: string; iban_suffix: string; bank_name: string }> {
  const res = await gcFetch<{ customer_bank_accounts: { id: string; iban_suffix: string; bank_name: string } }>(
    "POST", "/customer_bank_accounts", {
      customer_bank_accounts: {
        account_number_ending: undefined,
        iban: input.iban,
        account_holder_name: input.accountHolderName,
        links: { customer: input.customerId },
      },
    }
  );
  return res.customer_bank_accounts;
}

// ── Mandats ────────────────────────────────────────────────

export async function createMandate(input: {
  customerBankAccountId: string;
  creditorId?: string;
  reference?: string;
}): Promise<GcMandate> {
  const creditorId = input.creditorId ?? process.env.GOCARDLESS_PAYMENTS_CREDITOR_ID;
  const body: Record<string, unknown> = {
    scheme: "sepa_core",
    links: { customer_bank_account: input.customerBankAccountId },
  };
  if (creditorId) (body.links as Record<string, string>).creditor = creditorId;
  if (input.reference) body.reference = input.reference;
  const res = await gcFetch<{ mandates: GcMandate }>("POST", "/mandates", { mandates: body });
  return res.mandates;
}

export async function getMandate(mandateId: string): Promise<GcMandate> {
  const res = await gcFetch<{ mandates: GcMandate }>("GET", `/mandates/${mandateId}`);
  return res.mandates;
}

export async function cancelMandate(mandateId: string): Promise<void> {
  await gcFetch("POST", `/mandates/${mandateId}/actions/cancel`, {});
}

// ── Paiements ──────────────────────────────────────────────

export async function createPayment(input: {
  mandateId: string;
  amountEuros: number;  // en euros (ex: 1200.00)
  description?: string;
  reference?: string;
  chargeDate?: string;  // format YYYY-MM-DD
}): Promise<GcPayment> {
  const amountCents = Math.round(input.amountEuros * 100);
  const res = await gcFetch<{ payments: GcPayment }>("POST", "/payments", {
    payments: {
      amount: amountCents,
      currency: "EUR",
      description: input.description,
      reference: input.reference,
      charge_date: input.chargeDate,
      links: { mandate: input.mandateId },
    },
  });
  return res.payments;
}

export async function getPayment(paymentId: string): Promise<GcPayment> {
  const res = await gcFetch<{ payments: GcPayment }>("GET", `/payments/${paymentId}`);
  return res.payments;
}

export async function cancelPayment(paymentId: string): Promise<void> {
  await gcFetch("POST", `/payments/${paymentId}/actions/cancel`, {});
}

// ── Full flow: créer un mandat pour un locataire ───────────

export async function createSepaMandateForTenant(input: CreateMandateInput): Promise<{
  customerId: string;
  bankAccountId: string;
  mandateId: string;
  mandateReference: string;
  ibanLast4: string;
  bankName: string;
}> {
  const customer = await createCustomer({
    email: input.email,
    givenName: input.givenName,
    familyName: input.familyName,
    addressLine1: input.addressLine1,
    city: input.city,
    postalCode: input.postalCode,
  });

  const bankAccount = await createBankAccount({
    customerId: customer.id,
    iban: input.iban,
    accountHolderName: input.accountHolderName,
  });

  const mandate = await createMandate({
    customerBankAccountId: bankAccount.id,
  });

  return {
    customerId: customer.id,
    bankAccountId: bankAccount.id,
    mandateId: mandate.id,
    mandateReference: mandate.reference,
    ibanLast4: bankAccount.iban_suffix,
    bankName: bankAccount.bank_name,
  };
}

// ── Validation webhook GoCardless ─────────────────────────

import { createHmac, timingSafeEqual } from "crypto";

export function validateGocardlessWebhook(rawBody: Buffer, signature: string): boolean {
  const secret = process.env.GOCARDLESS_PAYMENTS_WEBHOOK_SECRET;
  if (!secret) throw new Error("GOCARDLESS_PAYMENTS_WEBHOOK_SECRET non définie");

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}
