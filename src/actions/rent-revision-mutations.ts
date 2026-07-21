"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import type { IndexType } from "@/generated/prisma/client";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import {
  validateRevisionSchema,
  rejectRevisionSchema,
  createManualRevisionSchema,
  type CreateManualRevisionInput,
} from "@/validations/rent-revision";
import {
  calculateNewRent,
  parseBaseIndexQuarter,
  getNextRevisionDate,
  getLatestIndex,
} from "@/actions/rent-revision-shared";
import { previewCatchUpRevisions } from "@/actions/rent-revision-queries";

export async function validateRevision(
  societyId: string,
  revisionId: string
): Promise<ActionResult<{ newRentHT: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = validateRevisionSchema.safeParse({ revisionId });
    if (!parsed.success)
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };

    const revision = await prisma.rentRevision.findFirst({
      where: { id: revisionId, lease: { societyId } },
      include: { lease: true },
    });

    if (!revision) return { success: false, error: "Révision introuvable" };
    if (revision.isValidated)
      return { success: false, error: "Cette révision est déjà validée" };

    // Rechercher le trimestre correspondant au nouvel indice
    const matchingIndex = await prisma.inseeIndex.findFirst({
      where: {
        indexType: revision.indexType,
        value: revision.newIndexValue,
      },
      orderBy: { year: "desc" },
    });
    const newBaseIndexQuarter = matchingIndex
      ? `T${matchingIndex.quarter} ${matchingIndex.year}`
      : null;

    await prisma.$transaction([
      prisma.rentRevision.update({
        where: { id: revisionId },
        data: {
          isValidated: true,
          validatedAt: new Date(),
          validatedBy: context.userId,
        },
      }),
      prisma.lease.update({
        where: { id: revision.leaseId },
        data: {
          currentRentHT: revision.newRentHT,
          baseIndexValue: revision.newIndexValue,
          ...(newBaseIndexQuarter ? { baseIndexQuarter: newBaseIndexQuarter } : {}),
        },
      }),
    ]);

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "RentRevision",
      entityId: revisionId,
      details: {
        action: "validate",
        leaseId: revision.leaseId,
        previousRentHT: revision.previousRentHT,
        newRentHT: revision.newRentHT,
        indexType: revision.indexType,
        baseIndex: revision.baseIndexValue,
        newIndex: revision.newIndexValue,
      },
    });

    revalidatePath("/baux");
    revalidatePath(`/baux/${revision.leaseId}`);
    revalidatePath("/baux/revisions");
    revalidatePath("/indices");

    return { success: true, data: { newRentHT: revision.newRentHT } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError)
      return { success: false, error: error.message };
    if (error instanceof ForbiddenError)
      return { success: false, error: error.message };
    console.error("[validateRevision]", error);
    return {
      success: false,
      error: "Erreur lors de la validation de la révision",
    };
  }
}

export async function rejectRevision(
  societyId: string,
  revisionId: string
): Promise<ActionResult<void>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = rejectRevisionSchema.safeParse({ revisionId });
    if (!parsed.success)
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };

    const revision = await prisma.rentRevision.findFirst({
      where: { id: revisionId, lease: { societyId } },
    });

    if (!revision) return { success: false, error: "Révision introuvable" };
    if (revision.isValidated)
      return {
        success: false,
        error: "Impossible de rejeter une révision déjà validée",
      };

    await prisma.rentRevision.delete({ where: { id: revisionId } });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "RentRevision",
      entityId: revisionId,
      details: {
        action: "reject",
        leaseId: revision.leaseId,
        indexType: revision.indexType,
      },
    });

    revalidatePath("/baux");
    revalidatePath("/baux/revisions");
    revalidatePath("/indices");

    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError)
      return { success: false, error: error.message };
    if (error instanceof ForbiddenError)
      return { success: false, error: error.message };
    console.error("[rejectRevision]", error);
    return { success: false, error: "Erreur lors du rejet de la révision" };
  }
}

export async function createManualRevision(
  societyId: string,
  input: CreateManualRevisionInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = createManualRevisionSchema.safeParse(input);
    if (!parsed.success)
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };

    const lease = await prisma.lease.findFirst({
      where: { id: parsed.data.leaseId, societyId, status: "EN_COURS" },
    });

    if (!lease) return { success: false, error: "Bail introuvable ou inactif" };
    if (!lease.indexType)
      return { success: false, error: "Ce bail n’a pas de clause d’indexation" };
    if (!lease.baseIndexValue)
      return { success: false, error: "Aucun indice de base défini sur ce bail" };

    const newRentHT = calculateNewRent(
      lease.currentRentHT,
      lease.baseIndexValue,
      parsed.data.newIndexValue,
      lease.indexType ?? undefined
    );

    const variationPct = ((parsed.data.newIndexValue - lease.baseIndexValue) / lease.baseIndexValue) * 100;
    const formula = `${lease.currentRentHT.toFixed(2)} × (${parsed.data.newIndexValue} / ${lease.baseIndexValue}) = ${newRentHT.toFixed(2)} [${variationPct >= 0 ? "+" : ""}${variationPct.toFixed(2)}%]`;

    const revision = await prisma.rentRevision.create({
      data: {
        leaseId: lease.id,
        effectiveDate: new Date(parsed.data.effectiveDate),
        previousRentHT: lease.currentRentHT,
        newRentHT,
        indexType: lease.indexType,
        baseIndexValue: lease.baseIndexValue,
        newIndexValue: parsed.data.newIndexValue,
        formula,
        isValidated: false,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "RentRevision",
      entityId: revision.id,
      details: {
        leaseId: lease.id,
        previousRentHT: lease.currentRentHT,
        newRentHT,
        indexType: lease.indexType,
        formula,
      },
    });

    revalidatePath(`/baux/${lease.id}`);
    revalidatePath("/baux/revisions");
    revalidatePath("/indices");

    return { success: true, data: { id: revision.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError)
      return { success: false, error: error.message };
    if (error instanceof ForbiddenError)
      return { success: false, error: error.message };
    console.error("[createManualRevision]", error);
    return {
      success: false,
      error: "Erreur lors de la création de la révision",
    };
  }
}

export async function detectPendingRevisions(): Promise<{
  created: number;
  errors: string[];
}> {
  const results = { created: 0, errors: [] as string[] };

  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    const leases = await prisma.lease.findMany({
      where: {
        status: "EN_COURS",
        indexType: { not: null },
        // Soit un indice INSEE avec son baseIndexValue, soit POURCENTAGE_FIXE
        // avec son taux annuel — sinon on ne peut rien calculer.
        OR: [
          { baseIndexValue: { not: null } },
          { AND: [{ indexType: "POURCENTAGE_FIXE" }, { fixedAnnualIndexationRate: { not: null } }] },
        ],
      },
      include: {
        rentRevisions: {
          orderBy: { effectiveDate: "desc" },
          take: 1,
        },
        tenant: {
          select: {
            entityType: true,
            companyName: true,
            firstName: true,
            lastName: true,
          },
        },
        lot: {
          select: {
            number: true,
            building: { select: { name: true } },
          },
        },
        society: {
          select: {
            id: true,
            userSocieties: {
              where: { role: { in: ["ADMIN_SOCIETE", "GESTIONNAIRE"] } },
              select: { userId: true },
            },
          },
        },
      },
    });

    for (const lease of leases) {
      try {
        if (!lease.indexType) continue;
        // Indices INSEE : requièrent baseIndexValue ; POURCENTAGE_FIXE : requiert
        // fixedAnnualIndexationRate. On laisse passer chaque cas valable.
        const isFixedRate = lease.indexType === "POURCENTAGE_FIXE";
        if (!isFixedRate && !lease.baseIndexValue) continue;
        if (isFixedRate && lease.fixedAnnualIndexationRate == null) continue;

        const nextRevisionDate = getNextRevisionDate(
          lease.startDate,
          lease.revisionFrequency ?? 12,
          lease.rentRevisions[0]?.effectiveDate,
          lease.entryDate,
          lease.revisionDateBasis,
          lease.revisionCustomMonth,
          lease.revisionCustomDay,
        );

        if (nextRevisionDate > in30Days || nextRevisionDate < threeMonthsAgo) continue;

        const existingPending = await prisma.rentRevision.findFirst({
          where: { leaseId: lease.id, isValidated: false },
        });
        if (existingPending) continue;

        // ── Branche taux fixe : pas d'indice INSEE à interroger ─────────────
        if (isFixedRate) {
          const rate = lease.fixedAnnualIndexationRate!;
          const baseRef = 100;
          const newRef = 100 + rate;
          const newRentHT = calculateNewRent(lease.currentRentHT, baseRef, newRef, "POURCENTAGE_FIXE");
          const formula = `${lease.currentRentHT.toFixed(2)} × (1 + ${rate}%) = ${newRentHT.toFixed(2)} [${rate >= 0 ? "+" : ""}${rate.toFixed(2)}%]`;

          await prisma.rentRevision.create({
            data: {
              leaseId: lease.id,
              effectiveDate: nextRevisionDate,
              previousRentHT: lease.currentRentHT,
              newRentHT,
              indexType: "POURCENTAGE_FIXE",
              baseIndexValue: baseRef,
              newIndexValue: newRef,
              formula,
              isValidated: false,
            },
          });

          const tenantNameFR =
            lease.tenant.entityType === "PERSONNE_MORALE"
              ? (lease.tenant.companyName ?? "—")
              : `${lease.tenant.firstName ?? ""} ${lease.tenant.lastName ?? ""}`.trim() || "—";
          const buildingNameFR = lease.lot?.building?.name ?? "—";
          const lotNumberFR = lease.lot?.number ?? "—";
          for (const userSociety of lease.society.userSocieties) {
            await prisma.notification.create({
              data: {
                userId: userSociety.userId,
                societyId: lease.societyId,
                type: "RENT_REVISION",
                title: "Révision de loyer à valider",
                message: `${buildingNameFR} — Lot ${lotNumberFR} (${tenantNameFR}) : révision contractuelle +${rate}% le ${nextRevisionDate.toLocaleDateString("fr-FR")}. Nouveau loyer : ${newRentHT.toFixed(2)} € HT.`,
                link: "/baux/revisions",
              },
            });
          }
          results.created++;
          continue;
        }

        // ── Branche INSEE (existante) ───────────────────────────────────────
        // Règle : le nouvel indice doit être POSTÉRIEUR à l'année de la base
        // (baseIndexQuarter du bail). Prendre l'année de la révision comme
        // cible conduit à des révisions "vides" quand l'indice cible n'existe
        // pas encore (fallback à baseYear → new = base → 0 % d'évolution).
        // On cherche donc le T{refQuarter} le plus récent avec year > baseYear.
        const baseQuarterInfo = parseBaseIndexQuarter(lease.baseIndexQuarter);
        let newIndex: { value: number; year: number; quarter: number } | null = null;

        if (baseQuarterInfo) {
          const later = await prisma.inseeIndex.findFirst({
            where: {
              indexType: lease.indexType as IndexType,
              quarter: baseQuarterInfo.quarter,
              year: { gt: baseQuarterInfo.year },
            },
            orderBy: { year: "desc" },
          });
          if (later) {
            newIndex = { value: later.value, year: later.year, quarter: later.quarter };
          }
        } else {
          // Pas de trimestre de référence configuré : fallback dernier indice publié
          newIndex = await getLatestIndex(lease.indexType as IndexType);
        }

        if (!newIndex) {
          results.errors.push(`Bail ${lease.id} : aucun indice ${lease.indexType} disponible`);
          continue;
        }

        // Guard TS : la branche INSEE n'est atteinte que si baseIndexValue est non-null
        // (vérifié plus haut quand isFixedRate=false).
        const baseIdx = lease.baseIndexValue!;
        if (newIndex.value === baseIdx) continue;

        const newRentHT = calculateNewRent(lease.currentRentHT, baseIdx, newIndex.value, lease.indexType ?? undefined);
        const variationPct = ((newIndex.value - baseIdx) / baseIdx) * 100;
        const quarterLabel = `T${newIndex.quarter} ${newIndex.year}`;
        const formula = `${lease.currentRentHT.toFixed(2)} × (${newIndex.value} [${quarterLabel}] / ${baseIdx}) = ${newRentHT.toFixed(2)} [${variationPct >= 0 ? "+" : ""}${variationPct.toFixed(2)}%]`;

        await prisma.rentRevision.create({
          data: {
            leaseId: lease.id,
            effectiveDate: nextRevisionDate,
            previousRentHT: lease.currentRentHT,
            newRentHT,
            indexType: lease.indexType as IndexType,
            baseIndexValue: baseIdx,
            newIndexValue: newIndex.value,
            formula,
            isValidated: false,
          },
        });

        const tenantName =
          lease.tenant.entityType === "PERSONNE_MORALE"
            ? (lease.tenant.companyName ?? "—")
            : `${lease.tenant.firstName ?? ""} ${lease.tenant.lastName ?? ""}`.trim() || "—";

        const buildingName = lease.lot?.building?.name ?? "—";
        const lotNumber = lease.lot?.number ?? "—";

        for (const userSociety of lease.society.userSocieties) {
          await prisma.notification.create({
            data: {
              userId: userSociety.userId,
              societyId: lease.societyId,
              type: "RENT_REVISION",
              title: "Révision de loyer à valider",
              message: `${buildingName} — Lot ${lotNumber} (${tenantName}) : révision prévue le ${nextRevisionDate.toLocaleDateString("fr-FR")}. Nouveau loyer proposé : ${newRentHT.toFixed(2)} € HT.`,
              link: "/baux/revisions",
            },
          });
        }

        results.created++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        results.errors.push(`Bail ${lease.id} : ${msg}`);
      }
    }
  } catch (error) {
    console.error("[detectPendingRevisions]", error);
    results.errors.push(error instanceof Error ? error.message : "Erreur globale");
  }

  return results;
}


export async function applyCatchUpRevisions(
  societyId: string,
  leaseId: string
): Promise<ActionResult<{ finalRent: number; stepsCount: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    // Recalculer le preview pour s'assurer de la cohérence
    const preview = await previewCatchUpRevisions(societyId, leaseId);
    if (!preview.success || !preview.data) return { success: false, error: preview.error ?? "Erreur" };

    const { steps, finalRent, finalIndexValue } = preview.data;

    // Vérifier qu'il n'y a pas de révision en attente
    const existing = await prisma.rentRevision.findFirst({
      where: { leaseId, isValidated: false },
    });
    if (existing) {
      return { success: false, error: "Une révision est déjà en attente. Validez-la ou rejetez-la d'abord." };
    }

    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, societyId },
    });
    if (!lease || !lease.indexType) return { success: false, error: "Bail introuvable" };

    // Créer toutes les révisions chaînées + valider + mettre à jour le bail
    await prisma.$transaction(async (tx) => {
      for (const step of steps) {
        const formula = `${step.rentBefore.toFixed(2)} × (${step.toIndex.toFixed(2)} [T${step.quarter} ${step.year}] / ${step.fromIndex.toFixed(2)}) = ${step.rentAfter.toFixed(2)}`;
        await tx.rentRevision.create({
          data: {
            leaseId,
            effectiveDate: new Date(step.effectiveDate),
            previousRentHT: step.rentBefore,
            newRentHT: step.rentAfter,
            indexType: lease.indexType!,
            baseIndexValue: step.fromIndex,
            newIndexValue: step.toIndex,
            formula,
            isValidated: true,
            validatedAt: new Date(),
            validatedBy: context.userId,
          },
        });
      }

      // Mettre à jour le bail avec les valeurs finales + le trimestre de référence
      const lastStep = steps[steps.length - 1];
      await tx.lease.update({
        where: { id: leaseId },
        data: {
          currentRentHT: finalRent,
          baseIndexValue: finalIndexValue,
          baseIndexQuarter: `T${lastStep.quarter} ${lastStep.year}`,
        },
      });
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "RentRevision",
      entityId: leaseId,
      details: {
        action: "catch_up",
        stepsCount: steps.length,
        originalRent: steps[0].rentBefore,
        finalRent,
        originalIndex: steps[0].fromIndex,
        finalIndex: finalIndexValue,
      },
    });

    revalidatePath("/baux");
    revalidatePath(`/baux/${leaseId}`);
    revalidatePath("/indices");

    return { success: true, data: { finalRent, stepsCount: steps.length } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError)
      return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[applyCatchUpRevisions]", error);
    return { success: false, error: "Erreur lors de l'application du rattrapage" };
  }
}

/**
 * Notifie le locataire d'une révision de loyer par email. Le déclenchement
 * est explicitement manuel (laisser la main à l'utilisateur). La révision
 * doit avoir été validée au préalable.
 */
export async function sendRevisionNotification(
  societyId: string,
  revisionId: string
): Promise<ActionResult<{ sent: true }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const revision = await prisma.rentRevision.findFirst({
      where: { id: revisionId, lease: { societyId } },
      include: {
        lease: {
          include: {
            tenant: {
              select: {
                entityType: true,
                companyName: true,
                firstName: true,
                lastName: true,
                email: true,
                billingEmail: true,
              },
            },
            lot: { select: { number: true, building: { select: { name: true, addressLine1: true } } } },
            society: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!revision) return { success: false, error: "Révision introuvable" };
    if (!revision.isValidated) {
      return { success: false, error: "Validez la révision avant de notifier le locataire" };
    }

    const tenant = revision.lease.tenant;
    const to = tenant.billingEmail || tenant.email;
    if (!to) return { success: false, error: "Aucune adresse email pour ce locataire" };

    const tenantName =
      tenant.entityType === "PERSONNE_MORALE"
        ? (tenant.companyName ?? "—")
        : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "—";
    const lotLabel = revision.lease.lot
      ? `${revision.lease.lot.building.name ?? revision.lease.lot.building.addressLine1 ?? "—"} — Lot ${revision.lease.lot.number}`
      : "Lot";
    const society = revision.lease.society;

    const { sendRevisionNotificationEmail } = await import("@/lib/email");
    const result = await sendRevisionNotificationEmail({
      to,
      tenantName,
      societyName: society?.name ?? "Bailleur",
      lotLabel,
      effectiveDate: revision.effectiveDate.toLocaleDateString("fr-FR"),
      previousRentHT: revision.previousRentHT,
      newRentHT: revision.newRentHT,
      indexType: revision.indexType,
      formula: revision.formula ?? `${revision.previousRentHT.toFixed(2)} → ${revision.newRentHT.toFixed(2)} HT`,
      contactEmail: society?.email ?? undefined,
      proofContext: {
        entityType: "RentRevision",
        entityId: revision.id,
        tenantId: revision.lease.tenantId,
        leaseId: revision.lease.id,
      },
    });

    if (!result.success) {
      return { success: false, error: `Envoi échoué : ${result.error ?? "erreur inconnue"}` };
    }

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "SEND_EMAIL",
      entity: "RentRevision",
      entityId: revision.id,
      details: { to, type: "REVISION_NOTIFICATION", resendEmailId: result.emailId ?? null },
    });

    revalidatePath("/indices");
    revalidatePath("/baux/revisions");
    revalidatePath(`/baux/${revision.lease.id}`);

    return { success: true, data: { sent: true } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[sendRevisionNotification]", error);
    return { success: false, error: "Erreur lors de l'envoi de la notification" };
  }
}
