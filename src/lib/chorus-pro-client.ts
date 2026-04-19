/**
 * Client Chorus Pro — Facturation B2G (Business to Government)
 *
 * Accès via PISTE (Bearer token OAuth2) + compte technique Chorus Pro.
 * Permet l'émission de factures vers les entités publiques (État, collectivités,
 * hôpitaux…) et la consultation des factures déposées.
 *
 * Prérequis :
 *   1. Créer une application sur piste.gouv.fr
 *   2. Souscrire à l'API "Factures" (cpro.factures) en sandbox
 *   3. Créer un compte technique dans le portail Chorus Pro (portail.chorus-pro.gouv.fr)
 *      → Espace "Compte technique EDI & API" → noter l'identifiant et le mot de passe
 *   4. Récupérer l'ID utilisateur interne (affiché dans le profil du compte technique)
 *
 * Variables d'environnement :
 *   PISTE_CLIENT_ID, PISTE_CLIENT_SECRET, PISTE_ENV      ← OAuth2 PISTE
 *   CHORUS_PRO_TECH_ACCOUNT                              ← ex. "TECH_1_xxxxx@cpro.fr"
 *   CHORUS_PRO_TECH_PASSWORD                             ← mot de passe du compte technique
 *   CHORUS_PRO_TECH_USER_ID                              ← ID numérique interne Chorus Pro
 *
 * Documentation :
 *   https://communaute.chorus-pro.gouv.fr/documentation/
 *   https://piste.gouv.fr → Applications → Abonnements → Factures
 */

import { env } from "@/lib/env";
import { getPisteToken, invalidatePisteToken } from "@/lib/piste";

// ---------------------------------------------------------------------------
// URLs par environnement
// ---------------------------------------------------------------------------

const CHORUS_PRO_BASE = {
  sandbox: "https://sandbox-api.piste.gouv.fr/cpro/factures/v1",
  production: "https://api.piste.gouv.fr/cpro/factures/v1",
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Syntaxe/format du fichier à déposer.
 * Valeurs Chorus Pro normalisées (spécification AIFE).
 */
export type ChorusProSyntax =
  | "IN_DP_E1_FACTURX"      // Factur-X PDF/A-3b avec CII embarqué (recommandé)
  | "IN_DP_E1_UBL_INVOICE"  // UBL 2.1 XML
  | "IN_DP_E1_CII_INVOICE"  // Cross Industry Invoice (CII) XML
  | "IN_DP_E2_PDF";         // PDF simple sans métadonnées structurées

export interface DepotFluxResult {
  codeRetour: number;
  libelle: string;
  numeroFluxDepot: string; // ex. "CPP0021100000000000000023"
}

export interface ConsultationCRResult {
  codeRetour: number;
  libelle: string;
  statutCR?: string;       // ex. "INTEGRE", "EN_COURS", "REJETE"
  dateDepot?: string;
  fichierCR?: string;      // PDF du compte-rendu encodé en base64
}

export interface RechercheFactureParams {
  dateDepotDebut?: string; // YYYY-MM-DD
  dateDepotFin?: string;
  numeroFluxDepot?: string;
  statut?: string;
  page?: number;
  nbResultatsParPage?: number;
}

export interface FactureB2G {
  numeroFluxDepot: string;
  nomFichier: string;
  syntaxeFlux: string;
  dateDepot: string;
  statutFlux: string;
  codeServiceValideur?: string;
}

export interface RechercheFactureResult {
  codeRetour: number;
  libelle: string;
  listeFacture: FactureB2G[];
  nbResultatsTotal?: number;
}

// ---------------------------------------------------------------------------
// Erreur typée
// ---------------------------------------------------------------------------

export class ChorusProError extends Error {
  constructor(
    public readonly codeRetour: number,
    public readonly libelle: string,
    public readonly path: string,
  ) {
    super(`Chorus Pro [${codeRetour}] ${path}: ${libelle}`);
    this.name = "ChorusProError";
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class ChorusProClient {
  private readonly baseUrl: string;
  private readonly cproAccountHeader: string; // base64("compte:password")
  private readonly techUserId: number;

  constructor() {
    if (!env.CHORUS_PRO_TECH_ACCOUNT || !env.CHORUS_PRO_TECH_PASSWORD) {
      throw new Error(
        "CHORUS_PRO_TECH_ACCOUNT et CHORUS_PRO_TECH_PASSWORD requis pour Chorus Pro"
      );
    }
    const chorusEnv = env.CHORUS_PRO_ENV ?? "sandbox";
    this.baseUrl = CHORUS_PRO_BASE[chorusEnv];
    this.cproAccountHeader = Buffer.from(
      `${env.CHORUS_PRO_TECH_ACCOUNT}:${env.CHORUS_PRO_TECH_PASSWORD}`
    ).toString("base64");
    this.techUserId = env.CHORUS_PRO_TECH_USER_ID
      ? parseInt(env.CHORUS_PRO_TECH_USER_ID, 10)
      : 0;
  }

  // ── Headers ───────────────────────────────────────────────────────────────

  private async headers(): Promise<Record<string, string>> {
    const token = await getPisteToken();
    return {
      Authorization: `Bearer ${token}`,
      "cpro-account": this.cproAccountHeader,
      "Content-Type": "application/json;charset=utf-8",
      Accept: "application/json;charset=utf-8",
    };
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let hdrs = await this.headers();

    const doRequest = async (h: Record<string, string>) =>
      fetch(url, {
        method: "POST",
        headers: h,
        body: JSON.stringify(body),
      });

    let res = await doRequest(hdrs);

    // Token expiré → invalider et réessayer
    if (res.status === 401) {
      invalidatePisteToken();
      hdrs = await this.headers();
      res = await doRequest(hdrs);
    }

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok || (data.codeRetour !== 0 && data.codeRetour !== undefined)) {
      throw new ChorusProError(
        (data.codeRetour as number) ?? res.status,
        (data.libelle as string) ?? "Erreur inconnue",
        path
      );
    }

    return data as T;
  }

  // ── Dépôt de facture ─────────────────────────────────────────────────────

  /**
   * Dépose un fichier de facture sur Chorus Pro.
   * Retourne un numéro de flux qui permet de suivre le traitement.
   *
   * @param fileBuffer  Contenu du fichier (PDF Factur-X ou XML UBL/CII)
   * @param fileName    Nom du fichier (ex. "FAC-2026-001.pdf")
   * @param syntax      Format du fichier — défaut: Factur-X
   */
  async deposerFluxFacture(
    fileBuffer: Buffer,
    fileName: string,
    syntax: ChorusProSyntax = "IN_DP_E1_FACTURX"
  ): Promise<DepotFluxResult> {
    return this.post<DepotFluxResult>("/deposerFluxFacture", {
      idUtilisateurCourant: this.techUserId,
      fichierFlux: fileBuffer.toString("base64"),
      nomFichier: fileName,
      syntaxeFlux: syntax,
      avecSignature: false,
    });
  }

  // ── Suivi du traitement ───────────────────────────────────────────────────

  /**
   * Consulte le compte-rendu de traitement d'un flux déposé.
   * Permet de vérifier si la facture a été intégrée, rejetée ou est en cours.
   *
   * @param numeroFluxDepot  Identifiant retourné par deposerFluxFacture
   */
  async consulterCR(numeroFluxDepot: string): Promise<ConsultationCRResult> {
    return this.post<ConsultationCRResult>("/consulterCR", {
      idUtilisateurCourant: this.techUserId,
      numeroFluxDepot,
    });
  }

  // ── Recherche de factures ─────────────────────────────────────────────────

  /**
   * Recherche les factures déposées en tant que fournisseur (émetteur).
   */
  async rechercherFactureParFournisseur(
    params: RechercheFactureParams
  ): Promise<RechercheFactureResult> {
    return this.post<RechercheFactureResult>("/rechercherFactureParFournisseur", {
      idUtilisateurCourant: this.techUserId,
      dateDepotDebut: params.dateDepotDebut,
      dateDepotFin: params.dateDepotFin,
      numeroFluxDepot: params.numeroFluxDepot,
      statut: params.statut,
      pageCourante: params.page ?? 0,
      nbResultatsParPage: params.nbResultatsParPage ?? 50,
    });
  }

  /**
   * Recherche les factures reçues en tant que destinataire (acheteur public).
   * Utile si MyGestia gère des structures publiques.
   */
  async rechercherFactureParRecipiendaire(
    params: RechercheFactureParams
  ): Promise<RechercheFactureResult> {
    return this.post<RechercheFactureResult>("/rechercherFactureParRecipiendaire", {
      idUtilisateurCourant: this.techUserId,
      dateDepotDebut: params.dateDepotDebut,
      dateDepotFin: params.dateDepotFin,
      numeroFluxDepot: params.numeroFluxDepot,
      statut: params.statut,
      pageCourante: params.page ?? 0,
      nbResultatsParPage: params.nbResultatsParPage ?? 50,
    });
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _chorusProClient: ChorusProClient | null = null;

/**
 * Retourne l'instance partagée du client Chorus Pro.
 * Retourne null si les variables d'environnement ne sont pas configurées.
 */
export function getChorusProClient(): ChorusProClient | null {
  if (!isChorusProConfigured()) return null;
  if (!_chorusProClient) _chorusProClient = new ChorusProClient();
  return _chorusProClient;
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

export function isChorusProConfigured(): boolean {
  return !!(
    env.PISTE_CLIENT_ID &&
    env.PISTE_CLIENT_SECRET &&
    env.CHORUS_PRO_TECH_ACCOUNT &&
    env.CHORUS_PRO_TECH_PASSWORD
  );
}
