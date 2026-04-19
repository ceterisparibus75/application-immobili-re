/**
 * Client générique Plateforme Agréée (PA) — norme AFNOR XP Z12-013
 *
 * Implémente les deux services de la norme :
 *   - Flow Service      : émission, réception, statuts des factures électroniques
 *   - Directory Service : consultation de l'Annuaire PPF (adressage)
 *
 * Ce client est PA-agnostique : toutes les PAs certifiées implémentent
 * la même API XP Z12-013. On peut changer de PA en modifiant PA_API_BASE_URL.
 *
 * Authentification (par ordre de priorité) :
 *   1. PA OAuth2 : PA_AUTH_TOKEN_URL + PA_AUTH_CLIENT_ID + PA_AUTH_CLIENT_SECRET
 *   2. API Key   : PA_API_KEY comme Bearer token
 *
 * Note : L'authentification PISTE n'est PAS utilisée ici. PISTE est réservé
 * aux APIs Chorus Pro (B2G). Les PAs B2B ont leur propre système d'auth.
 *
 * Doc AFNOR XP Z12-013 : https://norminfo.afnor.org
 * Specs DGFiP v3.1 : https://www.impots.gouv.fr/specifications-externes-b2b
 */

import { env } from "@/lib/env";

// ---------------------------------------------------------------------------
// Cache token OAuth2 PA
// ---------------------------------------------------------------------------

interface CachedToken {
  value: string;
  expiresAt: number;
}

let _paTokenCache: CachedToken | null = null;

async function getPAOAuth2Token(): Promise<string | null> {
  if (!env.PA_AUTH_TOKEN_URL || !env.PA_AUTH_CLIENT_ID || !env.PA_AUTH_CLIENT_SECRET) {
    return null;
  }

  const now = Date.now();
  if (_paTokenCache && _paTokenCache.expiresAt > now + 5 * 60 * 1000) {
    return _paTokenCache.value;
  }

  const res = await fetch(env.PA_AUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.PA_AUTH_CLIENT_ID,
      client_secret: env.PA_AUTH_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new PAClientError(res.status, "/oauth2/token (PA)", body);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  _paTokenCache = {
    value: data.access_token,
    expiresAt: now + (data.expires_in - 60) * 1000,
  };

  return _paTokenCache.value;
}

function invalidatePAToken(): void {
  _paTokenCache = null;
}

// ---------------------------------------------------------------------------
// Types — Flow Service
// ---------------------------------------------------------------------------

export type InvoiceFormat = "FACTURX" | "UBL" | "CII";
export type InvoiceProfile = "MINIMUM" | "BASIC_WL" | "BASIC" | "EN16931" | "EXTENDED";

export type FlowStatus =
  | "DEPOSEE"
  | "EN_COURS_TRAITEMENT"
  | "VALIDEE"
  | "REJETEE"
  | "TRANSMISE"
  | "MISE_A_DISPOSITION"
  | "RECUE"
  | "REFUSEE"
  | "EN_COURS_DE_PAIEMENT"
  | "PAYEE"
  | "ABANDONNER";

export interface FlowParty {
  siren: string;
  siret?: string;
  name: string;
  vatNumber?: string; // numéro TVA intracommunautaire
}

export interface SubmitInvoiceMetadata {
  invoiceNumber: string;
  issueDate: string;         // ISO 8601 date (YYYY-MM-DD)
  seller: FlowParty;
  buyer: FlowParty;
  format: InvoiceFormat;
  profile: InvoiceProfile;
  totalHT: number;
  totalTTC: number;
  currency: string;          // "EUR"
  dueDate?: string;
  /**
   * Model B — mandataire de transmission (Solution Compatible)
   * SIRET du vendeur réel (société cliente), distinct du SIRET MyGestia
   * qui est lié aux credentials PA. Transmis via X-Seller-Siret pour
   * indiquer à la PA que MyGestia soumet en tant que mandataire.
   */
  mandantSiret?: string;
}

export interface SubmitInvoiceResult {
  flowId: string;
  status: FlowStatus;
  depositedAt: string;
}

export interface Flow {
  flowId: string;
  invoiceNumber: string;
  seller: FlowParty;
  buyer?: FlowParty;
  issueDate: string;
  dueDate?: string;
  totalTTC: number;
  currency: string;
  format?: InvoiceFormat;
  status: FlowStatus;
  depositedAt: string;
  updatedAt?: string;
  downloadUrl?: string;
}

export interface SearchFlowsParams {
  siret: string;             // SIRET du destinataire (réception) ou émetteur (émission)
  statuses?: FlowStatus[];
  dateFrom?: string;         // ISO 8601
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface SearchFlowsResult {
  flows: Flow[];
  total: number;
  page: number;
  pageSize: number;
}

export type DocType = "Original" | "ReadableView" | "Converted";

export interface StatusUpdate {
  status: FlowStatus;
  date: string;              // ISO 8601
  comment?: string;
  reason?: string;           // Obligatoire pour REFUSEE
  paymentDate?: string;      // Pour EN_COURS_DE_PAIEMENT
  paymentAmount?: number;
}

export interface StatusHistory {
  flowId: string;
  currentStatus: FlowStatus;
  history: Array<{
    status: FlowStatus;
    date: string;
    origin: "EMETTEUR" | "PA" | "RECEPTEUR" | "PPF";
    comment?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Types — Directory Service
// ---------------------------------------------------------------------------

export interface DirectoryAddress {
  plateforme: string;       // Nom de la PA
  adresse: string;          // Identifiant e-facture sur cette PA
  actif: boolean;
  dateActivation?: string;
}

export interface DirectoryEntry {
  siren: string;
  siret?: string;
  denomination: string;
  adressesFacturation: DirectoryAddress[];
  niveauReception: "SIREN" | "SIRET";
  inscritAnnuaire: boolean;
}

// ---------------------------------------------------------------------------
// Erreur typée
// ---------------------------------------------------------------------------

export class PAClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: string
  ) {
    super(`PA API ${status} on ${path}: ${body}`);
    this.name = "PAClientError";
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class PAClient {
  private baseUrl: string;

  constructor() {
    if (!env.PA_API_BASE_URL) {
      throw new Error("PA_API_BASE_URL manquant — configurez votre Plateforme Agréée partenaire");
    }
    this.baseUrl = env.PA_API_BASE_URL.replace(/\/$/, "");
  }

  // ── Helpers internes ─────────────────────────────────────────────────────

  private async headers(): Promise<Record<string, string>> {
    const h: Record<string, string> = {
      Accept: "application/json",
    };

    // Priorité 1 : OAuth2 propre à la PA
    const paToken = await getPAOAuth2Token().catch(() => null);
    if (paToken) {
      h["Authorization"] = `Bearer ${paToken}`;
      // Certaines PAs acceptent aussi X-API-Key en complément
      if (env.PA_API_KEY) h["X-API-Key"] = env.PA_API_KEY;
    } else if (env.PA_API_KEY) {
      // Priorité 2 : API key simple
      h["Authorization"] = `Bearer ${env.PA_API_KEY}`;
    }

    return h;
  }

  private async fetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let headers = await this.headers();

    const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers ?? {}) } });

    // Token expiré → invalider le cache et réessayer une fois
    if (res.status === 401) {
      invalidatePAToken();
      headers = await this.headers();
      const retry = await fetch(url, { ...options, headers: { ...headers, ...(options.headers ?? {}) } });
      if (!retry.ok) {
        const body = await retry.text().catch(() => "");
        throw new PAClientError(retry.status, path, body);
      }
      if (retry.status === 204) return undefined as T;
      return retry.json() as Promise<T>;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new PAClientError(res.status, path, body);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  // ── Flow Service — Émission ───────────────────────────────────────────────

  /**
   * Dépose une facture électronique sur SUPER PDP pour routage B2B.
   * Les métadonnées sont embarquées dans le fichier Factur-X (CII XML).
   *
   * @param fileBuffer - Contenu du fichier (Factur-X PDF/A-3b ou UBL XML)
   * @param metadata   - Métadonnées pour nommer le fichier
   */
  async submitInvoice(
    fileBuffer: Buffer,
    metadata: SubmitInvoiceMetadata
  ): Promise<SubmitInvoiceResult> {
    const filename =
      metadata.format === "FACTURX"
        ? `${metadata.invoiceNumber}.pdf`
        : `${metadata.invoiceNumber}.xml`;

    const mimeType =
      metadata.format === "FACTURX" ? "application/pdf" : "application/xml";

    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array(fileBuffer)], { type: mimeType }), filename);

    const headers = await this.headers();

    // Model B — mandataire de transmission (Solution Compatible)
    // Si PA_MANDATAIRE_SIRET est configuré, MyGestia soumet en tant que SC mandataire.
    // On transmet le SIRET du vendeur réel dans X-Seller-Siret (convention AFNOR) et
    // le SIRET MyGestia dans X-Mandataire-Siret pour que la PA autorise la soumission
    // au nom de la société cliente.
    if (env.PA_MANDATAIRE_SIRET) {
      headers["X-Mandataire-Siret"] = env.PA_MANDATAIRE_SIRET;
      if (metadata.mandantSiret) {
        headers["X-Seller-Siret"] = metadata.mandantSiret;
        headers["X-Emitter-Siret"] = metadata.mandantSiret; // alias utilisé par certaines PAs
      }
    }

    const res = await fetch(`${this.baseUrl}/v1.beta/invoices`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new PAClientError(res.status, "/v1.beta/invoices", body);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    return {
      flowId: data.id ?? data.flowId ?? "",
      status: "DEPOSEE",
      depositedAt: data.created_at ?? new Date().toISOString(),
    };
  }

  // ── Flow Service — Réception ──────────────────────────────────────────────

  /**
   * Récupère les factures reçues ou émises (pagination par curseur).
   * SUPER PDP utilise GET /v1.beta/invoices?order=desc&starting_after_id=X
   */
  async searchFlows(params: SearchFlowsParams): Promise<SearchFlowsResult> {
    const qs = new URLSearchParams({ order: "desc" });
    if (params.page && params.page > 0) {
      qs.set("starting_after_id", String(params.page));
    }

    // SUPER PDP retourne { data: [...], count: N, has_before: bool, has_after: bool }
    const raw = await this.fetch<{ data?: unknown[]; count?: number } | unknown[]>(
      `/v1.beta/invoices?${qs.toString()}`
    );

    const invoices = Array.isArray(raw)
      ? raw
      : ((raw as { data?: unknown[] }).data ?? []);

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      flows: invoices.map((i) => mapSuperPdpInvoice(i as any)),
      total: Array.isArray(raw) ? invoices.length : ((raw as { count?: number }).count ?? invoices.length),
      page: params.page ?? 0,
      pageSize: params.pageSize ?? 50,
    };
  }

  /**
   * Télécharge le fichier d'une facture.
   * SUPER PDP retourne les détails via GET /v1.beta/invoices/{id}.
   */
  async downloadFlowDocument(
    flowId: string,
    _docType: DocType = "Original"
  ): Promise<Buffer | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await this.fetch<any>(`/v1.beta/invoices/${flowId}`);
      if (!data?.file_url) return null;

      const headers = await this.headers();
      const res = await fetch(data.file_url, { headers });
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  // ── Flow Service — Statuts ────────────────────────────────────────────────

  /**
   * Émet un événement de cycle de vie sur une facture.
   * SUPER PDP : POST /v1.beta/invoice_events
   */
  async updateFlowStatus(flowId: string, update: StatusUpdate): Promise<void> {
    return this.fetch<void>("/v1.beta/invoice_events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice_id: flowId,
        status_code: mapStatusToSuperPdp(update.status),
        ...(update.comment ? { details: [{ comment: update.comment }] } : {}),
      }),
    });
  }

  /**
   * Consulte le statut actuel d'une facture via son détail.
   */
  async getFlowStatuses(flowId: string): Promise<StatusHistory> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.fetch<any>(`/v1.beta/invoices/${flowId}`);
    const flow = mapSuperPdpInvoice(data);
    return {
      flowId,
      currentStatus: flow.status,
      history: [],
    };
  }

  // ── Directory Service — Annuaire PPF ─────────────────────────────────────

  /**
   * Recherche via l'annuaire PPF — non exposé directement par SUPER PDP.
   * Retourne null si le SIRET n'est pas dans le réseau.
   */
  async lookupBySiret(_siret: string): Promise<DirectoryEntry | null> {
    return null; // SUPER PDP ne propose pas encore de lookup annuaire public
  }

  async lookupBySiren(_siren: string): Promise<DirectoryEntry | null> {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers de mapping SUPER PDP ↔ types internes
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSuperPdpInvoice(d: any): Flow {
  return {
    flowId: d.id ?? "",
    invoiceNumber: d.invoice_number ?? d.number ?? "",
    seller: { siren: "", name: d.seller_name ?? "" },
    buyer: d.buyer_name ? { siren: "", name: d.buyer_name } : undefined,
    issueDate: d.issue_date ?? d.created_at ?? "",
    dueDate: d.due_date ?? undefined,
    totalTTC: d.total_amount ?? 0,
    currency: d.currency_code ?? "EUR",
    status: mapSuperPdpStatus(d.status ?? d.lifecycle_status),
    depositedAt: d.created_at ?? "",
    updatedAt: d.updated_at ?? undefined,
    downloadUrl: d.file_url ?? undefined,
  };
}

function mapSuperPdpStatus(raw: string | undefined): FlowStatus {
  if (!raw) return "DEPOSEE";
  const s = raw.toLowerCase();
  if (s.includes("received") || s.includes("recue")) return "RECUE";
  if (s.includes("paid") || s.includes("paye")) return "PAYEE";
  if (s.includes("reject") || s.includes("refus")) return "REFUSEE";
  if (s.includes("accepted") || s.includes("valid")) return "VALIDEE";
  if (s.includes("transmis")) return "TRANSMISE";
  if (s.includes("payment") || s.includes("paiement")) return "EN_COURS_DE_PAIEMENT";
  return "DEPOSEE";
}

// Mapping FlowStatus → code SUPER PDP (Peppol BIS lifecycle codes)
function mapStatusToSuperPdp(status: FlowStatus): string {
  const map: Record<FlowStatus, string> = {
    DEPOSEE: "fr:1",
    EN_COURS_TRAITEMENT: "fr:1",
    VALIDEE: "fr:212",
    REJETEE: "fr:301",
    TRANSMISE: "fr:1",
    MISE_A_DISPOSITION: "fr:1",
    RECUE: "fr:212",
    REFUSEE: "fr:301",
    EN_COURS_DE_PAIEMENT: "fr:221",
    PAYEE: "fr:222",
    ABANDONNER: "fr:301",
  };
  return map[status] ?? "fr:1";
}

// ---------------------------------------------------------------------------
// Singleton (une instance par process)
// ---------------------------------------------------------------------------

let _paClient: PAClient | null = null;

/**
 * Retourne l'instance partagée du client PA.
 * Retourne null si PA_API_BASE_URL n'est pas configuré.
 */
export function getPAClient(): PAClient | null {
  if (!env.PA_API_BASE_URL) return null;
  if (!_paClient) _paClient = new PAClient();
  return _paClient;
}

// ---------------------------------------------------------------------------
// Utilitaire — vérification de configuration
// ---------------------------------------------------------------------------

export function isEInvoicingConfigured(): boolean {
  return !!(env.PISTE_CLIENT_ID && env.PISTE_CLIENT_SECRET && env.PA_API_BASE_URL);
}
