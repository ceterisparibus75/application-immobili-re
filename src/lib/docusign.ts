/**
 * Client DocuSign eSignature REST API v2.1
 *
 * Auth : JWT Grant (server-to-server)
 * Variables d'env requises :
 *   DOCUSIGN_API_KEY         — Integration Key (Client ID) DocuSign
 *   DOCUSIGN_ACCOUNT_ID      — Account ID DocuSign
 *   DOCUSIGN_USER_ID         — User ID pour l'impersonation JWT
 *   DOCUSIGN_PRIVATE_KEY     — Cle privee RSA en base64 (sans header/footer PEM)
 *   DOCUSIGN_BASE_URL        — URL API (defaut : https://demo.docusign.net/restapi/v2.1)
 *   DOCUSIGN_AUTH_URL        — URL auth (defaut : https://account-d.docusign.com)
 *   DOCUSIGN_WEBHOOK_SECRET  — Secret HMAC pour valider les webhooks Connect
 */

import { SignJWT, importPKCS8 } from "jose";
import { createHmac, timingSafeEqual } from "crypto";

// ── Configuration ─────────────────────────────────────────────────

function cfg() {
  const apiKey = process.env.DOCUSIGN_API_KEY;
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  const userId = process.env.DOCUSIGN_USER_ID;
  const privateKeyB64 = process.env.DOCUSIGN_PRIVATE_KEY;
  const baseUrl = process.env.DOCUSIGN_BASE_URL ?? "https://demo.docusign.net/restapi/v2.1";
  const authUrl = process.env.DOCUSIGN_AUTH_URL ?? "https://account-d.docusign.com";

  if (!apiKey || !accountId || !userId || !privateKeyB64) {
    throw new Error(
      "DocuSign non configure : definir DOCUSIGN_API_KEY, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_USER_ID, DOCUSIGN_PRIVATE_KEY"
    );
  }

  // Reconstruire le PEM depuis la cle base64
  const privateKeyPem =
    "-----BEGIN RSA PRIVATE KEY-----\n" +
    (privateKeyB64.match(/.{1,64}/g) ?? []).join("\n") +
    "\n-----END RSA PRIVATE KEY-----";

  return { apiKey, accountId, userId, privateKeyPem, baseUrl, authUrl };
}

// ── Gestion du token (cache module-level pour warm lambdas) ───────

let tokenCache: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.value;
  }

  const { apiKey, userId, privateKeyPem, authUrl } = cfg();

  const privateKey = await importPKCS8(privateKeyPem, "RS256");

  const jwt = await new SignJWT({ scope: "signature impersonation" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(apiKey)
    .setSubject(userId)
    .setAudience(authUrl.replace("https://", ""))
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  const res = await fetch(`${authUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DocuSign OAuth error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return tokenCache.value;
}

// ── Helper HTTP ───────────────────────────────────────────────────

async function docuSignFetch<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const { accountId, baseUrl } = cfg();
  const token = await getAccessToken();

  const res = await fetch(`${baseUrl}/accounts/${accountId}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DocuSign API ${method} ${path} -> ${res.status}: ${err}`);
  }

  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────

export interface DocuSignDocument {
  /** Contenu PDF encode en base64 */
  contentBase64: string;
  /** Nom affiche dans DocuSign */
  name: string;
  /** Identifiant interne ("1", "2", ...) */
  documentId?: string;
}

export interface DocuSignSigner {
  email: string;
  name: string;
  /** Fournir pour la signature embarquee (embedded signing) */
  clientUserId?: string;
  /** Numero de page ou placer la signature (defaut : derniere page) */
  signPage?: number;
  signX?: number;
  signY?: number;
}

export interface CreateEnvelopeOptions {
  subject: string;
  message?: string;
  documents: DocuSignDocument[];
  signers: DocuSignSigner[];
  /** "sent" envoie immediatement, "created" reste en brouillon */
  status?: "sent" | "created";
}

export interface EnvelopeStatus {
  envelopeId: string;
  status: string;
  completedDateTime?: string;
  declinedDateTime?: string;
  voidedDateTime?: string;
  voidedReason?: string;
}

// ── API publique ──────────────────────────────────────────────────

/**
 * Cree une enveloppe DocuSign avec document(s) et signataire(s).
 * Renvoie l'envelopeId cree.
 */
export async function createEnvelope(options: CreateEnvelopeOptions): Promise<string> {
  const { subject, message, documents, signers, status = "sent" } = options;

  const docsPayload = documents.map((d, i) => ({
    documentBase64: d.contentBase64,
    documentId: d.documentId ?? String(i + 1),
    fileExtension: "pdf",
    name: d.name,
  }));

  const signersPayload = signers.map((s, i) => ({
    email: s.email,
    name: s.name,
    recipientId: String(i + 1),
    ...(s.clientUserId ? { clientUserId: s.clientUserId } : {}),
    tabs: {
      signHereTabs: [
        {
          documentId: "1",
          pageNumber: String(s.signPage ?? -1),  // -1 = derniere page DocuSign
          xPosition: String(s.signX ?? 100),
          yPosition: String(s.signY ?? 650),
        },
      ],
    },
  }));

  const body = {
    emailSubject: subject,
    emailBlurb: message ?? "",
    status,
    documents: docsPayload,
    recipients: { signers: signersPayload },
  };

  const res = await docuSignFetch<{ envelopeId: string }>("POST", "/envelopes", body);
  return res.envelopeId;
}

/**
 * Genere une URL de signature embarquee (embedded signing).
 * Requiert que le signataire ait ete cree avec un clientUserId.
 */
export async function getEmbeddedSigningUrl(
  envelopeId: string,
  signer: Pick<DocuSignSigner, "email" | "name" | "clientUserId">,
  returnUrl: string
): Promise<string> {
  const body = {
    authenticationMethod: "none",
    clientUserId: signer.clientUserId,
    email: signer.email,
    returnUrl,
    userName: signer.name,
  };

  const res = await docuSignFetch<{ url: string }>(
    "POST",
    `/envelopes/${envelopeId}/views/recipient`,
    body
  );
  return res.url;
}

/**
 * Recupere le statut d'une enveloppe.
 */
export async function getEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatus> {
  return docuSignFetch<EnvelopeStatus>("GET", `/envelopes/${envelopeId}`);
}

/**
 * Annule (void) une enveloppe.
 */
export async function voidEnvelope(envelopeId: string, reason: string): Promise<void> {
  await docuSignFetch("PUT", `/envelopes/${envelopeId}`, {
    status: "voided",
    voidedReason: reason,
  });
}

/**
 * Telecharge le document signe (PDF) en Buffer.
 * documentId : "combined" pour tous les documents fusionnes.
 */
export async function downloadSignedDocument(
  envelopeId: string,
  documentId: string = "combined"
): Promise<Buffer> {
  const { accountId, baseUrl } = cfg();
  const token = await getAccessToken();

  const res = await fetch(
    `${baseUrl}/accounts/${accountId}/envelopes/${envelopeId}/documents/${documentId}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf" } }
  );

  if (!res.ok) throw new Error(`DocuSign download error ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── Validation webhook Connect ────────────────────────────────────

/**
 * Verifie la signature HMAC-SHA256 d'un webhook DocuSign Connect.
 * Renvoie true si valide, false sinon.
 */
export function validateWebhookSignature(
  rawBody: Buffer,
  signature: string
): boolean {
  const secret = process.env.DOCUSIGN_WEBHOOK_SECRET;
  if (!secret) throw new Error("DOCUSIGN_WEBHOOK_SECRET non defini");

  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");

  try {
    return timingSafeEqual(Buffer.from(signature, "base64"), Buffer.from(expected, "base64"));
  } catch {
    return false;
  }
}
