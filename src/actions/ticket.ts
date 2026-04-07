"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { checkSubscriptionActive } from "@/lib/plan-limits";
import { createAuditLog } from "@/lib/audit";
import {
  createTicketSchema,
  updateTicketSchema,
  addTicketCommentSchema,
  type CreateTicketInput,
  type UpdateTicketInput,
  type AddTicketCommentInput,
} from "@/validations/ticket";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getTickets(societyId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId, "LECTURE");

  return prisma.ticket.findMany({
    where: { societyId },
    include: {
      tenant: { select: { id: true, firstName: true, lastName: true, companyName: true, entityType: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      lot: { select: { id: true, number: true, building: { select: { id: true, name: true } } } },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTicket(societyId: string, ticketId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireSocietyAccess(session.user.id, societyId, "LECTURE");

  return prisma.ticket.findFirst({
    where: { id: ticketId, societyId },
    include: {
      tenant: { select: { id: true, firstName: true, lastName: true, companyName: true, entityType: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      lot: { select: { id: true, number: true, building: { select: { id: true, name: true } } } },
      lease: { select: { id: true, leaseType: true, startDate: true, endDate: true } },
      comments: {
        include: { author: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createTicket(
  societyId: string,
  input: CreateTicketInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const subCheck = await checkSubscriptionActive(societyId);
    if (!subCheck.active) return { success: false, error: subCheck.message };

    const parsed = createTicketSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const data = parsed.data;

    // Vérifier que le locataire appartient à la société
    const tenant = await prisma.tenant.findFirst({
      where: { id: data.tenantId, societyId, isActive: true },
    });
    if (!tenant) return { success: false, error: "Locataire introuvable ou inactif" };

    // Générer la référence : TK-YYYY-NNNN
    const year = new Date().getFullYear();
    const lastTicket = await prisma.ticket.findFirst({
      where: {
        societyId,
        reference: { startsWith: `TK-${year}-` },
      },
      orderBy: { reference: "desc" },
      select: { reference: true },
    });

    let nextNumber = 1;
    if (lastTicket) {
      const parts = lastTicket.reference.split("-");
      const lastNum = parseInt(parts[2], 10);
      if (!isNaN(lastNum)) nextNumber = lastNum + 1;
    }
    const reference = `TK-${year}-${String(nextNumber).padStart(4, "0")}`;

    const ticket = await prisma.ticket.create({
      data: {
        reference,
        title: data.title,
        description: data.description,
        type: data.type,
        priority: data.priority ?? "NORMALE",
        status: "OUVERT",
        tenantId: data.tenantId,
        lotId: data.lotId ?? null,
        leaseId: data.leaseId ?? null,
        assignedToId: data.assignedToId ?? null,
        contractorId: data.contractorId ?? null,
        societyId,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Ticket",
      entityId: ticket.id,
    });

    revalidatePath("/tickets");
    return { success: true, data: { id: ticket.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createTicket]", error);
    return { success: false, error: "Erreur lors de la création du ticket" };
  }
}

export async function updateTicket(
  societyId: string,
  input: UpdateTicketInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateTicketSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { id, ...data } = parsed.data;

    const existing = await prisma.ticket.findFirst({
      where: { id, societyId },
    });
    if (!existing) return { success: false, error: "Ticket introuvable" };

    const resolvedAt =
      data.status === "CLOTURE" && existing.status !== "CLOTURE"
        ? new Date()
        : data.status && data.status !== "CLOTURE"
          ? null
          : undefined;

    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        ...data,
        ...(resolvedAt !== undefined ? { resolvedAt } : {}),
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Ticket",
      entityId: ticket.id,
    });

    revalidatePath("/tickets");
    revalidatePath(`/tickets/${id}`);
    return { success: true, data: { id: ticket.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateTicket]", error);
    return { success: false, error: "Erreur lors de la mise à jour du ticket" };
  }
}

export async function closeTicket(
  societyId: string,
  ticketId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const existing = await prisma.ticket.findFirst({
      where: { id: ticketId, societyId },
    });
    if (!existing) return { success: false, error: "Ticket introuvable" };
    if (existing.status === "CLOTURE") return { success: false, error: "Ce ticket est déjà clôturé" };

    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: "CLOTURE", resolvedAt: new Date() },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Ticket",
      entityId: ticketId,
      details: { action: "close" },
    });

    revalidatePath("/tickets");
    revalidatePath(`/tickets/${ticketId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[closeTicket]", error);
    return { success: false, error: "Erreur lors de la clôture du ticket" };
  }
}

export async function assignTicket(
  societyId: string,
  ticketId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const existing = await prisma.ticket.findFirst({
      where: { id: ticketId, societyId },
    });
    if (!existing) return { success: false, error: "Ticket introuvable" };

    await prisma.ticket.update({
      where: { id: ticketId },
      data: { assignedToId: userId },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Ticket",
      entityId: ticketId,
      details: { action: "assign", assignedToId: userId },
    });

    revalidatePath("/tickets");
    revalidatePath(`/tickets/${ticketId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[assignTicket]", error);
    return { success: false, error: "Erreur lors de l'assignation du ticket" };
  }
}

export async function addComment(
  societyId: string,
  input: AddTicketCommentInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "LECTURE");

    const parsed = addTicketCommentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const data = parsed.data;

    // Vérifier que le ticket appartient à la société
    const ticket = await prisma.ticket.findFirst({
      where: { id: data.ticketId, societyId },
    });
    if (!ticket) return { success: false, error: "Ticket introuvable" };

    const comment = await prisma.ticketComment.create({
      data: {
        content: data.content,
        ticketId: data.ticketId,
        authorId: session.user.id,
        isInternal: data.isInternal ?? false,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "TicketComment",
      entityId: comment.id,
    });

    revalidatePath(`/tickets/${data.ticketId}`);
    return { success: true, data: { id: comment.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[addComment]", error);
    return { success: false, error: "Erreur lors de l'ajout du commentaire" };
  }
}
