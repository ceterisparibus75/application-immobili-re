"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import type { ActionResult } from "@/actions/society";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

export type OnboardingStepKey =
  | "society_profile"
  | "first_lease"
  | "bank_account"
  | "sender_email"
  | "first_invoice_sent";

export interface OnboardingStep {
  key: OnboardingStepKey;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  done: boolean;
  optional?: boolean;
}

export interface OnboardingProgress {
  steps: OnboardingStep[];
  completed: number;
  total: number;
  percent: number;
  allRequiredDone: boolean;
}

/**
 * Calcule l'état d'onboarding pour la société active.
 *
 * Chaque étape est un signal simple observé sur la base : on ne stocke pas
 * l'état d'onboarding séparément (source de vérité = données réelles), ce
 * qui évite qu'une case cochée à la main mente sur un état invalide.
 */
export async function getOnboardingProgress(
  societyId: string
): Promise<ActionResult<OnboardingProgress>> {
  try {
    await requireSocietyActionContext(societyId, "LECTURE");

    const [society, activeLeaseCount, bankAccountCount, sentInvoiceCount] = await Promise.all([
      prisma.society.findUnique({
        where: { id: societyId },
        select: {
          siret: true,
          email: true,
          senderStatus: true,
          ibanEncrypted: true,
        },
      }),
      prisma.lease.count({ where: { societyId, status: "EN_COURS", deletedAt: null } }),
      prisma.bankAccount.count({ where: { societyId } }),
      prisma.invoice.count({
        where: {
          societyId,
          sentAt: { not: null },
          invoiceType: { notIn: ["AVOIR", "QUITTANCE"] },
        },
      }),
    ]);

    if (!society) return { success: false, error: "Société introuvable" };

    // Profil société complet : SIRET + email de contact (les 2 champs qui
    // bloquent les factures électroniques EN 16931 — BT-30 + BT-34).
    const profileDone = Boolean(society.siret && society.email);

    const steps: OnboardingStep[] = [
      {
        key: "society_profile",
        title: "Complétez le profil société",
        description: "SIRET + email de contact — obligatoires pour émettre des factures électroniques.",
        href: `/societes/${societyId}/modifier`,
        ctaLabel: "Compléter le profil",
        done: profileDone,
      },
      {
        key: "first_lease",
        title: "Créez votre premier bail",
        description: "Immeuble, lot, locataire et conditions financières en une opération guidée.",
        href: "/baux/nouveau/complet",
        ctaLabel: "Assistant guidé",
        done: activeLeaseCount > 0,
      },
      {
        key: "bank_account",
        title: "Reliez un compte bancaire",
        description: "Rapprochement automatique des virements avec les paiements locataires.",
        href: "/banque",
        ctaLabel: "Ajouter un compte",
        done: bankAccountCount > 0,
      },
      {
        key: "sender_email",
        title: "Personnalisez votre adresse expéditrice",
        description: "Envoyez factures et quittances depuis votre propre email au lieu de noreply@mygestia.immo.",
        href: "/parametres/facturation",
        ctaLabel: "Configurer l'expéditeur",
        done: society.senderStatus === "verified",
        optional: true,
      },
      {
        key: "first_invoice_sent",
        title: "Envoyez une première facture",
        description: "Générez un appel de loyer et transmettez-le au locataire.",
        href: "/facturation",
        ctaLabel: "Aller sur la facturation",
        done: sentInvoiceCount > 0,
      },
    ];

    const required = steps.filter((s) => !s.optional);
    const completed = steps.filter((s) => s.done).length;
    const requiredDone = required.filter((s) => s.done).length;
    const total = steps.length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    return {
      success: true,
      data: {
        steps,
        completed,
        total,
        percent,
        allRequiredDone: requiredDone === required.length,
      },
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getOnboardingProgress]", error);
    return { success: false, error: "Erreur lors du calcul de l'onboarding" };
  }
}
