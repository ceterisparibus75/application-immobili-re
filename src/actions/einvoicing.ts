"use server";

/**
 * Server Actions — Facturation Électronique
 *
 * Deux systèmes gérés :
 *
 * ① Chorus Pro (B2G) — facturation vers les entités publiques
 *    Via PISTE OAuth2 + compte technique Chorus Pro
 *    → submitInvoiceToChorusPro, checkChorusProStatus
 *
 * ② Plateforme Agréée PA (B2B) — réforme sept. 2026, norme XP Z12-013
 *    Via auth propre à la PA (OAuth2 ou API key), sans PISTE
 *    → syncReceivedInvoices, submitInvoice, acknowledgeInvoice, refuseInvoice,
 *       markInvoiceInPayment, lookupDirectory, registerSocietyInPPF
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { getPAClient, PAClientError, isEInvoicingConfigured, type StatusUpdate } from "@/lib/pa-client";
import { generateFacturXml } from "@/lib/einvoice-generator";
import {
  getChorusProClient,
  ChorusProError,
  isChorusProConfigured,
} from "@/lib/chorus-pro-client";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

const STORAGE_BUCKET = "documents";

function getSupabase() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Guards de configuration
// ---------------------------------------------------------------------------

function requireEInvoicing(): ActionResult<never> | null {
  if (!isEInvoicingConfigured()) {
    return {
      success: false,
      error:
        "La facturation électronique B2B n'est pas configurée. Vérifiez PA_API_BASE_URL et les credentials PA.",
    };
  }
  return null;
}

function requireChorusPro(): ActionResult<never> | null {
  if (!isChorusProConfigured()) {
    return {
      success: false,
      error:
        "Chorus Pro n'est pas configuré. Vérifiez PISTE_CLIENT_ID, CHORUS_PRO_TECH_ACCOUNT et CHORUS_PRO_TECH_PASSWORD.",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Synchronisation des factures reçues (polling)
// ---------------------------------------------------------------------------

/**
 * Synchronise les factures électroniques reçues depuis la PA partenaire.
 * Crée ou met à jour les SupplierInvoice correspondantes.
 * Appelé par le cron /api/cron/sync-einvoices (toutes les heures) et depuis l'UI.
 */
export async function syncReceivedInvoices(
  societyId: string
): Promise<ActionResult<{ created: number; updated: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const guard = requireEInvoicing();
    if (guard) return guard as ActionResult<{ created: number; updated: number }>;

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const society = await prisma.society.findFirst({
      where: { id: societyId },
      select: { siret: true, ppfRegisteredAt: true },
    });
    if (!society?.siret)
      return { success: false, error: "Le SIRET de la société est requis pour la facturation électronique." };
    if (!society.ppfRegisteredAt)
      return { success: false, error: "La société n'est pas encore inscrite à l'Annuaire PPF." };

    return await _syncForSociety(societyId, society.siret, session.user.id);
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[syncReceivedInvoices]", error);
    return { success: false, error: "Erreur lors de la synchronisation" };
  }
}

// Logique partagée avec le cron
export async function _syncForSociety(
  societyId: string,
  siret: string,
  userId = "system"
): Promise<ActionResult<{ created: number; updated: number }>> {
  const pa = getPAClient()!;
  const supabase = getSupabase();
  let created = 0;
  let updated = 0;
  let page = 0;
  let hasMore = true;

  // Récupérer la date du dernier sync pour un polling incrémental
  const lastSync = await prisma.supplierInvoice.findFirst({
    where: { societyId, ppfInvoiceId: { not: null } },
    orderBy: { ppfSyncedAt: "desc" },
    select: { ppfSyncedAt: true },
  });
  const since = lastSync?.ppfSyncedAt?.toISOString();

  while (hasMore) {
    const result = await pa.searchFlows({
      siret,
      statuses: ["MISE_A_DISPOSITION", "RECUE", "REFUSEE", "EN_COURS_DE_PAIEMENT", "PAYEE"],
      dateFrom: since,
      page,
      pageSize: 50,
    });

    const flows = result.flows ?? [];
    if (flows.length < 50) hasMore = false;
    page++;

    for (const flow of flows) {
      const existing = await prisma.supplierInvoice.findFirst({
        where: { ppfInvoiceId: flow.flowId },
        select: { id: true, ppfStatus: true },
      });

      if (existing) {
        if (existing.ppfStatus !== flow.status) {
          const statusMap: Record<string, "PENDING_REVIEW" | "VALIDATED" | "REJECTED" | "PAID"> = {
            MISE_A_DISPOSITION: "PENDING_REVIEW",
            RECUE: "PENDING_REVIEW",
            REFUSEE: "REJECTED",
            EN_COURS_DE_PAIEMENT: "VALIDATED",
            PAYEE: "PAID",
          };
          await prisma.supplierInvoice.update({
            where: { id: existing.id },
            data: {
              ppfStatus: flow.status,
              ppfSyncedAt: new Date(),
              status: statusMap[flow.status] ?? "PENDING_REVIEW",
            },
          });
          updated++;
        }
        continue;
      }

      // Nouvelle facture — télécharger le fichier
      let storagePath = "";
      let xmlStoragePath: string | null = null;

      const year = new Date(flow.issueDate).getFullYear();
      const safeName = flow.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);

      if (supabase) {
        // Document original (Factur-X PDF ou XML)
        const docBuffer = await pa.downloadFlowDocument(flow.flowId, "Original");
        if (docBuffer) {
          const isXml = flow.format === "UBL" || flow.format === "CII";
          const ext = isXml ? "xml" : "pdf";
          const path = `supplier-invoices/${societyId}/${year}/${safeName}_${flow.flowId}.${ext}`;
          const mime = isXml ? "application/xml" : "application/pdf";
          const { error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(path, docBuffer, { contentType: mime, upsert: false });
          if (!error) {
            if (isXml) xmlStoragePath = path;
            else storagePath = path;
          }
        }

        // Version lisible PDF (si format XML)
        if (flow.format !== "FACTURX") {
          const pdfBuffer = await pa.downloadFlowDocument(flow.flowId, "ReadableView");
          if (pdfBuffer) {
            const pdfPath = `supplier-invoices/${societyId}/${year}/${safeName}_${flow.flowId}.pdf`;
            const { error } = await supabase.storage
              .from(STORAGE_BUCKET)
              .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: false });
            if (!error) storagePath = pdfPath;
          }
        }
      }

      await prisma.supplierInvoice.create({
        data: {
          societyId,
          invoiceNumber: flow.invoiceNumber,
          invoiceDate: new Date(flow.issueDate),
          dueDate: flow.dueDate ? new Date(flow.dueDate) : null,
          amountTTC: flow.totalTTC,
          currency: flow.currency ?? "EUR",
          supplierName: flow.seller.name,
          supplierSiret: flow.seller.siret ?? null,
          fileName: `${safeName}.${storagePath.endsWith(".xml") ? "xml" : "pdf"}`,
          fileUrl: storagePath,
          storagePath,
          source: "ppf_einvoice",
          ppfInvoiceId: flow.flowId,
          ppfStatus: flow.status,
          ppfSyncedAt: new Date(),
          ...(xmlStoragePath ? { xmlStoragePath } : {}),
          status: "PENDING_REVIEW",
        },
      });
      created++;
    }
  }

  if (created > 0 || updated > 0) {
    await createAuditLog({
      societyId,
      userId,
      action: "UPDATE",
      entity: "SupplierInvoice",
      entityId: societyId,
      details: { created, updated, source: "ppf_einvoice" },
    });
    revalidatePath("/banque/factures-fournisseurs");
  }

  return { success: true, data: { created, updated } };
}

// ---------------------------------------------------------------------------
// Émettre une facture vers un destinataire B2B
// ---------------------------------------------------------------------------

/**
 * Soumet une facture client (Invoice) vers la PA pour routage B2B vers le destinataire.
 * Génère le PDF Factur-X et le dépose sur la PA.
 */
export async function submitInvoice(
  societyId: string,
  invoiceId: string
): Promise<ActionResult<{ flowId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const guard = requireEInvoicing();
    if (guard) return guard as ActionResult<{ flowId: string }>;

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
      include: {
        society: true,
        tenant: true,
        lines: true,
        lease: { include: { lot: { include: { building: true } } } },
      },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };

    const soc = invoice.society;
    if (!soc?.siret) return { success: false, error: "SIRET de la société requis" };

    const tenantSiret =
      invoice.tenant.entityType === "PERSONNE_MORALE" ? invoice.tenant.siret ?? undefined : undefined;
    const tenantName =
      invoice.tenant.entityType === "PERSONNE_MORALE"
        ? (invoice.tenant.companyName ?? "---")
        : `${invoice.tenant.firstName ?? ""} ${invoice.tenant.lastName ?? ""}`.trim() || "---";
    const tenantAddress =
      invoice.tenant.entityType === "PERSONNE_MORALE"
        ? invoice.tenant.companyAddress
        : invoice.tenant.personalAddress;

    // Générer directement le XML CII (norme EN 16931) — SUPER PDP n'accepte pas le PDF
    const xmlString = await generateFacturXml({
      invoiceNumber: invoice.invoiceNumber,
      invoiceType: invoice.invoiceType,
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      periodStart: invoice.periodStart?.toISOString() ?? null,
      periodEnd: invoice.periodEnd?.toISOString() ?? null,
      totalHT: invoice.totalHT,
      totalVAT: invoice.totalVAT,
      totalTTC: invoice.totalTTC,
      previousBalance: 0,
      isAvoir: invoice.invoiceType === "AVOIR",
      society: soc
        ? {
            name: soc.name,
            addressLine1: soc.addressLine1,
            postalCode: soc.postalCode,
            city: soc.city,
            country: soc.country,
            vatNumber: soc.vatNumber,
            email: soc.email ?? null,
            siret: soc.siret ?? null,
          }
        : null,
      tenant: { name: tenantName, address: tenantAddress ?? null },
      lines: invoice.lines.map((l) => ({
        label: l.label,
        totalHT: l.totalHT,
        vatRate: l.vatRate,
        totalTTC: l.totalTTC,
      })),
      payments: [],
    });
    const xmlBuffer = Buffer.from(xmlString, "utf-8");

    // Soumettre à la PA (format CII XML — standard Peppol B2B)
    // Model B : si PA_MANDATAIRE_SIRET est configuré, MyGestia agit comme SC mandataire.
    // mandantSiret = SIRET de la société cliente (vendeur réel sur la facture).
    const pa = getPAClient()!;
    const result = await pa.submitInvoice(xmlBuffer, {
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate.toISOString().split("T")[0],
      seller: { siren: soc.siret.slice(0, 9), siret: soc.siret, name: soc.name },
      buyer: {
        siren: tenantSiret ? tenantSiret.slice(0, 9) : "000000000",
        siret: tenantSiret,
        name: tenantName,
      },
      format: "CII",
      profile: "BASIC",
      totalHT: invoice.totalHT,
      totalTTC: invoice.totalTTC,
      currency: "EUR",
      dueDate: invoice.dueDate.toISOString().split("T")[0],
      mandantSiret: soc.siret, // SIRET société cliente (vendeur réel) — pour mode SC mandataire
    });

    // Stocker le flowId dans la facture
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        einvoiceXmlUrl: result.flowId,
        einvoiceGeneratedAt: new Date(),
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "GENERATE_PDF",
      entity: "Invoice",
      entityId: invoiceId,
      details: { invoiceNumber: invoice.invoiceNumber, flowId: result.flowId, format: "facturx-basic" },
    });

    revalidatePath(`/facturation/${invoiceId}`);
    return { success: true, data: { flowId: result.flowId } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    if (error instanceof PAClientError)
      return { success: false, error: `Erreur PA (${error.status}): ${error.body}` };
    console.error("[submitInvoice]", error);
    return { success: false, error: "Erreur lors de la soumission de la facture" };
  }
}

// ---------------------------------------------------------------------------
// Statut d'une facture émise vers la PA
// ---------------------------------------------------------------------------

/**
 * Récupère le statut actuel d'une facture soumise à la PA B2B.
 * Le flowId est stocké dans invoice.einvoiceXmlUrl (valeur non-path).
 */
export async function getEInvoiceStatus(
  societyId: string,
  invoiceId: string
): Promise<ActionResult<{ currentStatus: string; flowId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const guard = requireEInvoicing();
    if (guard) return guard as ActionResult<{ currentStatus: string; flowId: string }>;

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
      select: { einvoiceXmlUrl: true },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };

    const flowId = invoice.einvoiceXmlUrl;
    if (!flowId || flowId.startsWith("invoices/")) {
      return { success: false, error: "Cette facture n'a pas encore été transmise à la PA" };
    }

    const pa = getPAClient()!;
    const statusHistory = await pa.getFlowStatuses(flowId);

    return {
      success: true,
      data: { currentStatus: statusHistory.currentStatus, flowId },
    };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    if (error instanceof PAClientError)
      return { success: false, error: `Erreur PA (${error.status}): ${error.body}` };
    console.error("[getEInvoiceStatus]", error);
    return { success: false, error: "Impossible de récupérer le statut PA" };
  }
}

// ---------------------------------------------------------------------------
// Statuts sur les factures reçues
// ---------------------------------------------------------------------------

/**
 * Émet l'accusé de réception obligatoire (statut RECUE) sur une facture reçue.
 * Obligation légale : doit être émis dans les délais réglementaires.
 */
export async function acknowledgeInvoice(
  societyId: string,
  supplierInvoiceId: string
): Promise<ActionResult<void>> {
  return _updateFlowStatus(societyId, supplierInvoiceId, {
    status: "RECUE",
    date: new Date().toISOString(),
    comment: "Facture bien reçue",
  });
}

/**
 * Refuse une facture reçue (refus métier).
 */
export async function refuseInvoice(
  societyId: string,
  supplierInvoiceId: string,
  reason: string
): Promise<ActionResult<void>> {
  if (!reason?.trim()) return { success: false, error: "Le motif de refus est obligatoire" };
  return _updateFlowStatus(societyId, supplierInvoiceId, {
    status: "REFUSEE",
    date: new Date().toISOString(),
    reason: "MOTIF_METIER",
    comment: reason,
  });
}

/**
 * Déclare une mise en paiement d'une facture reçue.
 */
export async function markInvoiceInPayment(
  societyId: string,
  supplierInvoiceId: string,
  paymentDate: string,
  paymentAmount: number
): Promise<ActionResult<void>> {
  return _updateFlowStatus(societyId, supplierInvoiceId, {
    status: "EN_COURS_DE_PAIEMENT",
    date: new Date().toISOString(),
    paymentDate,
    paymentAmount,
  });
}

async function _updateFlowStatus(
  societyId: string,
  supplierInvoiceId: string,
  update: StatusUpdate
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const guard = requireEInvoicing();
    if (guard) return guard as ActionResult<void>;

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const inv = await prisma.supplierInvoice.findFirst({
      where: { id: supplierInvoiceId, societyId },
      select: { id: true, ppfInvoiceId: true, invoiceNumber: true },
    });
    if (!inv) return { success: false, error: "Facture introuvable" };
    if (!inv.ppfInvoiceId) return { success: false, error: "Cette facture n'est pas liée au PPF" };

    const pa = getPAClient()!;
    await pa.updateFlowStatus(inv.ppfInvoiceId, update);

    const statusMap: Record<string, "PENDING_REVIEW" | "VALIDATED" | "REJECTED" | "PAID"> = {
      RECUE: "PENDING_REVIEW",
      REFUSEE: "REJECTED",
      EN_COURS_DE_PAIEMENT: "VALIDATED",
      PAYEE: "PAID",
    };

    await prisma.supplierInvoice.update({
      where: { id: supplierInvoiceId },
      data: {
        ppfStatus: update.status,
        ppfSyncedAt: new Date(),
        status: statusMap[update.status] ?? "PENDING_REVIEW",
        ...(update.status === "REFUSEE" ? { rejectionReason: update.comment } : {}),
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "SupplierInvoice",
      entityId: supplierInvoiceId,
      details: { invoiceNumber: inv.invoiceNumber, ppfStatus: update.status },
    });

    revalidatePath("/banque/factures-fournisseurs");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    if (error instanceof PAClientError)
      return { success: false, error: `Erreur PA (${error.status}): ${error.body}` };
    console.error("[_updateFlowStatus]", error);
    return { success: false, error: "Erreur lors de la mise à jour du statut" };
  }
}

// ---------------------------------------------------------------------------
// Consultation de l'Annuaire PPF
// ---------------------------------------------------------------------------

/**
 * Vérifie si une entreprise est inscrite à l'Annuaire PPF et récupère son adresse de facturation.
 * Utile avant d'émettre une facture électronique pour s'assurer que le destinataire est joignable.
 */
export async function lookupDirectory(
  societyId: string,
  siret: string
): Promise<ActionResult<{ inscrit: boolean; denomination?: string; plateforme?: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const guard = requireEInvoicing();
    if (guard) return guard as ActionResult<{ inscrit: boolean }>;

    await requireSocietyAccess(session.user.id, societyId, "LECTURE");

    const pa = getPAClient()!;
    const entry = await pa.lookupBySiret(siret);

    if (!entry || !entry.inscritAnnuaire) {
      return { success: true, data: { inscrit: false } };
    }

    const activeAddress = entry.adressesFacturation.find((a) => a.actif);
    return {
      success: true,
      data: {
        inscrit: true,
        denomination: entry.denomination,
        plateforme: activeAddress?.plateforme,
      },
    };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    if (error instanceof PAClientError)
      return { success: false, error: `Erreur PA (${error.status}): ${error.body}` };
    console.error("[lookupDirectory]", error);
    return { success: false, error: "Erreur lors de la consultation de l'annuaire" };
  }
}

// ---------------------------------------------------------------------------
// Inscription à l'Annuaire PPF
// ---------------------------------------------------------------------------

/**
 * Marque la société comme inscrite à l'Annuaire PPF (via la PA partenaire).
 * L'inscription effective est gérée par la PA lors de la signature du contrat SC.
 */
export async function registerSocietyInPPF(
  societyId: string
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    const guard = requireEInvoicing();
    if (guard) return guard as ActionResult<void>;

    const society = await prisma.society.findFirst({
      where: { id: societyId },
      select: { siret: true, ppfRegisteredAt: true },
    });

    if (!society?.siret)
      return { success: false, error: "SIRET requis pour l'inscription à l'Annuaire PPF." };

    if (society.ppfRegisteredAt)
      return { success: true }; // Déjà inscrite / déclarée

    if (env.PA_MANDATAIRE_SIRET) {
      // Model B — MyGestia est SC mandataire.
      // La société est déclarée sous le contrat MyGestia : pas besoin de vérifier
      // l'annuaire PPF individuellement. On marque directement comme inscrite.
      await prisma.society.update({
        where: { id: societyId },
        data: { ppfRegisteredAt: new Date() },
      });
    } else {
      // Model A (standalone) — vérification via Directory Service
      const pa = getPAClient()!;
      const entry = await pa.lookupBySiret(society.siret);
      if (!entry?.inscritAnnuaire) {
        return {
          success: false,
          error:
            "Cette société n'est pas encore visible dans l'Annuaire PPF. Vérifiez que votre PA partenaire a finalisé l'inscription.",
        };
      }

      await prisma.society.update({
        where: { id: societyId },
        data: { ppfRegisteredAt: new Date() },
      });
    }

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Society",
      entityId: societyId,
      details: { event: "ppf_registered", siret: society.siret },
    });

    revalidatePath("/parametres/facturation");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    if (error instanceof PAClientError)
      return { success: false, error: `Erreur PA (${error.status}): ${error.body}` };
    console.error("[registerSocietyInPPF]", error);
    return { success: false, error: "Erreur lors de l'inscription à l'Annuaire PPF" };
  }
}

// ---------------------------------------------------------------------------
// ① CHORUS PRO — Facturation B2G (Business to Government)
// ---------------------------------------------------------------------------

/**
 * Dépose une facture sur Chorus Pro pour l'envoyer à un acheteur public.
 * Génère le PDF Factur-X et le soumet via le compte technique Chorus Pro.
 *
 * À utiliser quand le destinataire est une entité publique (État, collectivité,
 * hôpital, établissement public…).
 */
export async function submitInvoiceToChorusPro(
  societyId: string,
  invoiceId: string
): Promise<ActionResult<{ numeroFluxDepot: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const guard = requireChorusPro();
    if (guard) return guard as ActionResult<{ numeroFluxDepot: string }>;

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
      include: { society: true, tenant: true },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };

    // Générer le PDF Factur-X
    const pdfRes = await fetch(`${env.AUTH_URL}/api/invoices/${invoiceId}/facturx`, {
      headers: {
        Cookie: `active-society-id=${societyId}`,
        "x-society-id": societyId,
      },
    });
    if (!pdfRes.ok) return { success: false, error: "Échec de la génération Factur-X" };
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

    const fileName = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

    const cpro = getChorusProClient()!;
    const result = await cpro.deposerFluxFacture(pdfBuffer, fileName, "IN_DP_E1_FACTURX");

    // Stocker le numéro de flux dans la facture (réutilise le champ einvoiceXmlUrl)
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        einvoiceXmlUrl: `cpro:${result.numeroFluxDepot}`,
        einvoiceGeneratedAt: new Date(),
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "GENERATE_PDF",
      entity: "Invoice",
      entityId: invoiceId,
      details: {
        invoiceNumber: invoice.invoiceNumber,
        numeroFluxDepot: result.numeroFluxDepot,
        channel: "chorus_pro_b2g",
      },
    });

    revalidatePath(`/facturation/${invoiceId}`);
    return { success: true, data: { numeroFluxDepot: result.numeroFluxDepot } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    if (error instanceof ChorusProError)
      return { success: false, error: `Chorus Pro [${error.codeRetour}]: ${error.libelle}` };
    console.error("[submitInvoiceToChorusPro]", error);
    return { success: false, error: "Erreur lors de la soumission Chorus Pro" };
  }
}

/**
 * Consulte le compte-rendu de traitement Chorus Pro d'une facture déposée.
 * Permet de savoir si la facture a été intégrée, rejetée ou est en cours de traitement.
 */
export async function checkChorusProStatus(
  societyId: string,
  invoiceId: string
): Promise<ActionResult<{ statut: string; libelle: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const guard = requireChorusPro();
    if (guard) return guard as ActionResult<{ statut: string; libelle: string }>;

    await requireSocietyAccess(session.user.id, societyId, "LECTURE");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
      select: { einvoiceXmlUrl: true, invoiceNumber: true },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };

    const numeroFluxDepot = invoice.einvoiceXmlUrl?.replace("cpro:", "");
    if (!numeroFluxDepot?.startsWith("CPP")) {
      return { success: false, error: "Cette facture n'a pas été envoyée via Chorus Pro" };
    }

    const cpro = getChorusProClient()!;
    const cr = await cpro.consulterCR(numeroFluxDepot);

    return {
      success: true,
      data: {
        statut: cr.statutCR ?? "EN_COURS",
        libelle: cr.libelle,
      },
    };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    if (error instanceof ChorusProError)
      return { success: false, error: `Chorus Pro [${error.codeRetour}]: ${error.libelle}` };
    console.error("[checkChorusProStatus]", error);
    return { success: false, error: "Erreur lors de la consultation Chorus Pro" };
  }
}
