"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  createChargeProvisionSchema,
  updateChargeProvisionSchema,
  type CreateChargeProvisionInput,
  type UpdateChargeProvisionInput,
} from "@/validations/chargeProvision";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

export async function createChargeProvision(
  societyId: string,
  input: CreateChargeProvisionInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createChargeProvisionSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    // Vérifier que le bail appartient bien à cette société
    const lease = await prisma.lease.findFirst({
      where: { id: parsed.data.leaseId, societyId },
    });
    if (!lease) return { success: false, error: "Bail introuvable" };

    const provision = await prisma.chargeProvision.create({
      data: {
        leaseId: parsed.data.leaseId,
        lotId: parsed.data.lotId,
        label: parsed.data.label,
        monthlyAmount: parsed.data.monthlyAmount,
        startDate: new Date(parsed.data.startDate),
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        isActive: true,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "ChargeProvision",
      entityId: provision.id,
      details: { label: parsed.data.label, monthlyAmount: parsed.data.monthlyAmount, leaseId: parsed.data.leaseId },
    });

    revalidatePath(`/baux/${parsed.data.leaseId}`);
    return { success: true, data: { id: provision.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createChargeProvision]", error);
    return { success: false, error: "Erreur lors de la création" };
  }
}

export async function updateChargeProvision(
  societyId: string,
  input: UpdateChargeProvisionInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateChargeProvisionSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    // Vérifier que la provision appartient à cette société (via le bail)
    const provision = await prisma.chargeProvision.findFirst({
      where: { id: parsed.data.id },
      include: { lease: { select: { societyId: true, id: true } } },
    });
    if (!provision || provision.lease.societyId !== societyId)
      return { success: false, error: "Provision introuvable" };

    await prisma.chargeProvision.update({
      where: { id: parsed.data.id },
      data: {
        label: parsed.data.label,
        monthlyAmount: parsed.data.monthlyAmount,
        startDate: new Date(parsed.data.startDate),
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        isActive: parsed.data.isActive ?? true,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "ChargeProvision",
      entityId: parsed.data.id,
      details: { label: parsed.data.label, monthlyAmount: parsed.data.monthlyAmount },
    });

    revalidatePath(`/baux/${provision.lease.id}`);
    return { success: true, data: { id: parsed.data.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateChargeProvision]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function deleteChargeProvision(
  societyId: string,
  provisionId: string
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const provision = await prisma.chargeProvision.findFirst({
      where: { id: provisionId },
      include: { lease: { select: { societyId: true, id: true } } },
    });
    if (!provision || provision.lease.societyId !== societyId)
      return { success: false, error: "Provision introuvable" };

    await prisma.chargeProvision.delete({ where: { id: provisionId } });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "ChargeProvision",
      entityId: provisionId,
      details: { leaseId: provision.leaseId },
    });

    revalidatePath(`/baux/${provision.lease.id}`);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteChargeProvision]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}
