/**
 * Client API Qonto v2
 * Documentation : https://api-doc.qonto.com/
 * Base URL : https://thirdparty.qonto.com/v2/
 * Auth : Authorization: {slug}:{secret_key}
 */

const BASE_URL = "https://thirdparty.qonto.com/v2";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QontoBankAccount {
  slug: string;
  iban: string;
  bic: string;
  currency: string;
  balance: number;
  balance_cents: number;
  authorized_balance: number;
  authorized_balance_cents: number;
  name: string;
  updated_at: string;
  status: string;
}

export interface QontoOrganization {
  slug: string;
  legal_name: string;
  bank_accounts: QontoBankAccount[];
}

export interface QontoTransaction {
  transaction_id: string;
  amount: number;
  amount_cents: number;
  local_amount: number;
  local_amount_cents: number;
  side: "credit" | "debit";
  operation_type: string;
  currency: string;
  local_currency: string;
  label: string;
  settled_at: string | null;
  emitted_at: string;
  updated_at: string;
  status: string;
  note: string | null;
  reference: string | null;
  vat_amount: number | null;
  vat_amount_cents: number | null;
  vat_rate: number | null;
  initiator_id: string | null;
  category: string;
}

interface QontoTransactionsResponse {
  transactions: QontoTransaction[];
  meta: {
    current_page: number;
    next_page: number | null;
    prev_page: number | null;
    total_pages: number;
    total_count: number;
    per_page: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeader(slug: string, secretKey: string): string {
  return `${slug}:${secretKey}`;
}

async function qontoFetch<T>(
  path: string,
  slug: string,
  secretKey: string,
  params?: URLSearchParams
): Promise<T> {
  const url = params ? `${BASE_URL}${path}?${params}` : `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader(slug, secretKey),
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`[qonto] ${path} (${res.status}): ${txt}`);
  }
  return res.json() as Promise<T>;
}

// ─── Organisation et comptes ─────────────────────────────────────────────────

export async function getQontoOrganization(
  slug: string,
  secretKey: string
): Promise<QontoOrganization> {
  const data = await qontoFetch<{ organization: QontoOrganization }>(
    "/organization",
    slug,
    secretKey
  );
  return data.organization;
}

// ─── Transactions ────────────────────────────────────────────────────────────

export async function getQontoTransactions(
  slug: string,
  secretKey: string,
  bankAccountSlug: string,
  settledAtFrom?: string
): Promise<QontoTransaction[]> {
  const allTransactions: QontoTransaction[] = [];
  let currentPage = 1;

   
  while (true) {
    const params = new URLSearchParams({
      slug: bankAccountSlug,
      per_page: "100",
      current_page: String(currentPage),
      sort_by: "settled_at:asc",
      status: "completed",
    });
    if (settledAtFrom) {
      params.set("settled_at_from", settledAtFrom);
    }

    const data = await qontoFetch<QontoTransactionsResponse>(
      "/transactions",
      slug,
      secretKey,
      params
    );

    allTransactions.push(...data.transactions);

    if (!data.meta.next_page) break;
    currentPage = data.meta.next_page;
  }

  return allTransactions;
}

// ─── Virements sortants (External Transfers) ────────────────────────────────

export interface QontoExternalTransfer {
  id: string;
  transaction_id: string | null;
  status: string; // pending | processing | declined | canceled | settled
  amount: number;
  amount_cents: number;
  currency: string;
  beneficiary_name: string;
  beneficiary_iban: string;
  note: string | null;
  reference: string | null;
  scheduled_date: string | null;
  settled_at: string | null;
}

export interface QontoCreateTransferInput {
  beneficiary_name: string;
  beneficiary_iban: string;   // sans espaces
  beneficiary_bic?: string;
  amount_cents: number;       // centimes ex: 150050 pour 1500.50€
  currency: string;           // "EUR"
  note?: string;
  reference?: string;
  scheduled_date?: string;    // YYYY-MM-DD optionnel
}

export async function createQontoTransfer(
  slug: string,
  secretKey: string,
  bankAccountSlug: string,
  input: QontoCreateTransferInput
): Promise<QontoExternalTransfer> {
  const url = `${BASE_URL}/external_transfers`;
  const body = {
    debit_account: { slug: bankAccountSlug },
    ...input,
    beneficiary_iban: input.beneficiary_iban.replace(/\s/g, ""),
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader(slug, secretKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`[qonto] POST /external_transfers (${res.status}): ${txt}`);
  }
  const data = (await res.json()) as { external_transfer: QontoExternalTransfer };
  return data.external_transfer;
}

export async function getQontoTransfer(
  slug: string,
  secretKey: string,
  transferId: string
): Promise<QontoExternalTransfer> {
  const data = await qontoFetch<{ external_transfer: QontoExternalTransfer }>(
    `/external_transfers/${transferId}`,
    slug,
    secretKey
  );
  return data.external_transfer;
}
