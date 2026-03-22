// ─── GoCardless Bank Account Data API (PSD2) ──────────────────────────────────
// Documentation : https://bankaccountdata.gocardless.com/api/v2/
// Fournit l'accès Open Banking aux comptes bancaires européens

const BASE_URL = "https://bankaccountdata.gocardless.com/api/v2";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GocardlessToken {
  access: string;
  refresh: string;
  access_expires: number;
  refresh_expires: number;
}

export interface GocardlessInstitution {
  id: string;
  name: string;
  bic: string;
  transaction_total_days: string;
  countries: string[];
  logo: string;
}

export interface GocardlessAgreement {
  id: string;
  max_historical_days: number;
  access_valid_for_days: number;
  access_scope: string[];
  accepted: string | null;
  institution_id: string;
}

export interface GocardlessRequisition {
  id: string;
  status: string;
  link: string;
  accounts: string[];
  institution_id: string;
  agreement: string;
  reference: string;
  redirect: string;
}

export interface GocardlessAccount {
  id: string;
  iban: string;
  institution_id: string;
  status: string;
  name: string;
  currency: string;
  ownerName: string;
}

export interface GocardlessTransaction {
  transactionId: string;
  bookingDate: string;
  valueDate?: string;
  transactionAmount: {
    amount: string;
    currency: string;
  };
  remittanceInformationUnstructured?: string;
  creditorName?: string;
  debtorName?: string;
}

export interface GocardlessTransactionsResponse {
  transactions: {
    booked: GocardlessTransaction[];
    pending: GocardlessTransaction[];
  };
}

// ─── Cache token en mémoire ────────────────────────────────────────────────────

interface TokenCache {
  token: GocardlessToken;
  fetchedAt: number;
}

const globalForGocardless = globalThis as unknown as {
  gocardlessTokenCache: TokenCache | undefined;
};

async function getAccessToken(): Promise<string> {
  const now = Date.now() / 1000;
  const cached = globalForGocardless.gocardlessTokenCache;

  // Utiliser le token en cache si encore valide (marge 60s)
  if (cached && now < cached.fetchedAt + cached.token.access_expires - 60) {
    return cached.token.access;
  }

  // Tenter un refresh si refresh token encore valide
  if (cached && now < cached.fetchedAt + cached.token.refresh_expires - 60) {
    try {
      const refreshed = await fetchNewToken(cached.token.refresh, true);
      globalForGocardless.gocardlessTokenCache = { token: refreshed, fetchedAt: now };
      return refreshed.access;
    } catch {
      // Si refresh échoue, on refait une auth complète
    }
  }

  // Authentification complète
  const token = await fetchNewToken();
  globalForGocardless.gocardlessTokenCache = { token, fetchedAt: now };
  return token.access;
}

async function fetchNewToken(refreshToken?: string, isRefresh = false): Promise<GocardlessToken> {
  const secretId = process.env.GOCARDLESS_SECRET_ID;
  const secretKey = process.env.GOCARDLESS_SECRET_KEY;

  if (!secretId || !secretKey) {
    throw new Error("GOCARDLESS_SECRET_ID et GOCARDLESS_SECRET_KEY sont requis");
  }

  const url = isRefresh ? `${BASE_URL}/token/refresh/` : `${BASE_URL}/token/new/`;
  const body = isRefresh
    ? JSON.stringify({ refresh: refreshToken })
    : JSON.stringify({ secret_id: secretId, secret_key: secretKey });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[GoCardless] Erreur d'authentification", err);
    throw new Error(err?.detail ?? "Erreur d'authentification GoCardless");
  }

  return res.json() as Promise<GocardlessToken>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function gocardlessFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`[GoCardless] Erreur ${res.status} sur ${path}`, err);
    throw new Error(err?.detail ?? `Erreur GoCardless: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Liste les institutions bancaires disponibles pour un pays.
 * country = "FR" pour la France
 */
export async function getInstitutions(country = "FR"): Promise<GocardlessInstitution[]> {
  return gocardlessFetch<GocardlessInstitution[]>(`/institutions/?country=${country}`);
}

/**
 * Crée un accord d'accès aux données bancaires (valide 90 jours).
 */
export async function createAgreement(institutionId: string): Promise<GocardlessAgreement> {
  return gocardlessFetch<GocardlessAgreement>("/agreements/enduser/", {
    method: "POST",
    body: JSON.stringify({
      institution_id: institutionId,
      max_historical_days: 90,
      access_valid_for_days: 90,
      access_scope: ["balances", "details", "transactions"],
    }),
  });
}

/**
 * Crée une réquisition (session d'autorisation) pour un utilisateur.
 * Retourne un lien d'autorisation à envoyer à l'utilisateur.
 */
export async function createRequisition(
  institutionId: string,
  agreementId: string,
  redirectUrl: string,
  reference: string
): Promise<GocardlessRequisition> {
  return gocardlessFetch<GocardlessRequisition>("/requisitions/", {
    method: "POST",
    body: JSON.stringify({
      redirect: redirectUrl,
      institution_id: institutionId,
      agreement: agreementId,
      reference,
      user_language: "FR",
    }),
  });
}

/**
 * Récupère le statut d'une réquisition et les IDs de comptes liés.
 * Statuts : CR (créé), LN (lié), RJ (rejeté), ER (erreur), EX (expiré), SU (suspendu)
 */
export async function getRequisition(requisitionId: string): Promise<GocardlessRequisition> {
  return gocardlessFetch<GocardlessRequisition>(`/requisitions/${requisitionId}/`);
}

/**
 * Récupère les détails d'un compte bancaire (IBAN, nom, etc.)
 */
export async function getAccountDetails(accountId: string): Promise<GocardlessAccount> {
  const response = await gocardlessFetch<{ account: GocardlessAccount }>(
    `/accounts/${accountId}/details/`
  );
  return response.account;
}

/**
 * Récupère les transactions d'un compte bancaire.
 * dateFrom et dateTo au format YYYY-MM-DD
 */
export async function getAccountTransactions(
  accountId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<GocardlessTransactionsResponse> {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const query = params.toString() ? `?${params.toString()}` : "";
  return gocardlessFetch<GocardlessTransactionsResponse>(
    `/accounts/${accountId}/transactions/${query}`
  );
}
