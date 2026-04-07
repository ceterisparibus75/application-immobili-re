/**
 * Client API Powens (ex-Budget Insight) — Open Banking PSD2
 * Sandbox: https://mtggroupe-sandbox.biapi.pro/2.0/
 * Documentation: https://docs.powens.com/api-reference/
 */

import { env } from "@/lib/env";

function baseUrl(): string {
  return `https://${env.POWENS_DOMAIN}.biapi.pro/2.0`;
}

function basicAuth(): string {
  return Buffer.from(`${env.POWENS_CLIENT_ID}:${env.POWENS_CLIENT_SECRET}`).toString("base64");
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PowensConnector {
  id: number;
  name: string;
  slug?: string;
  country?: string;
  capabilities?: string[];
  hidden?: boolean;
  bank_icon?: { data?: string; url?: string };
  bic?: string;
  logo?: string;
}

export interface PowensInitResponse {
  auth_token: string;
  id_user: number;
}

export interface PowensAccount {
  id: number;
  id_user: number;
  id_connection?: number;
  name?: string;
  iban?: string;
  balance?: number;
  coming?: number;
  type?: string;
  disabled?: boolean;
  currency?: { id: string };
}

export interface PowensTransaction {
  id: number;
  id_account: number;
  date: string;
  value_date?: string;
  value: number;
  label?: string;
  original_wording?: string;
  simplified_wording?: string;
  type?: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function initPowensUser(): Promise<PowensInitResponse> {
  const res = await fetch(`${baseUrl()}/auth/init`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`[powens] initUser (${res.status}): ${txt}`);
  }
  return res.json() as Promise<PowensInitResponse>;
}

export async function getPowensWebviewCode(userToken: string): Promise<string> {
  const res = await fetch(`${baseUrl()}/auth/token/code?type=singleAccess`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`[powens] getCode (${res.status}): ${txt}`);
  }
  const data = (await res.json()) as { code: string };
  return data.code;
}

export async function exchangePowensCode(
  code: string
): Promise<{ access_token: string; id_user: number }> {
  const res = await fetch(`${baseUrl()}/auth/token/access`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`[powens] exchangeCode (${res.status}): ${txt}`);
  }
  return res.json() as Promise<{ access_token: string; id_user: number }>;
}

export function buildPowensWebviewUrl(params: {
  code: string;
  state: string;
  redirectUri: string;
  connectorId?: number;
}): string {
  const q = new URLSearchParams({
    domain: env.POWENS_DOMAIN,
    client_id: env.POWENS_CLIENT_ID,
    redirect_uri: params.redirectUri,
    code: params.code,
    state: params.state,
  });
  if (params.connectorId) q.set("connector_ids", String(params.connectorId));
  return `https://webview.powens.com/fr/connect?${q.toString()}`;
}

// ─── Connecteurs (banques disponibles) ───────────────────────────────────────

export async function getPowensConnectors(): Promise<PowensConnector[]> {
  const res = await fetch(`${baseUrl()}/connectors?country_codes=FR&features=bank`, {
    headers: { Authorization: `Basic ${basicAuth()}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`[powens] getConnectors (${res.status})`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  const raw: PowensConnector[] = Array.isArray(data)
    ? (data as PowensConnector[])
    : (data.connectors ?? []);

  return raw
    .filter((c) => !c.hidden)
    .map((c) => ({
      ...c,
      bic: c.slug ?? String(c.id),
      logo: c.bank_icon?.url ?? undefined,
    }));
}

// ─── Comptes ──────────────────────────────────────────────────────────────────

export async function getPowensUserAccounts(
  userId: number,
  userToken: string
): Promise<PowensAccount[]> {
  const res = await fetch(`${baseUrl()}/users/${userId}/accounts`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`[powens] getAccounts (${res.status}): ${txt}`);
  }
  // Powens retourne { accounts: [...] } ou directement un tableau
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  return (Array.isArray(data) ? data : (data.accounts ?? data.data ?? [])) as PowensAccount[];
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getPowensTransactions(
  userId: number,
  accountId: number,
  userToken: string,
  dateFrom?: string
): Promise<PowensTransaction[]> {
  const params = new URLSearchParams({ limit: "500" });
  if (dateFrom) params.set("min_date", dateFrom);

  const res = await fetch(
    `${baseUrl()}/users/${userId}/accounts/${accountId}/transactions?${params}`,
    { headers: { Authorization: `Bearer ${userToken}` } }
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`[powens] getTransactions (${res.status}): ${txt}`);
  }
  const data = (await res.json()) as { transactions: PowensTransaction[] };
  return data.transactions ?? [];
}
