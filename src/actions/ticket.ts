"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { createInternalNotification as createNotification } from "@/lib/notifications-internal";
import {
  createTicketSchema,
  createTicketMessageSchema,
  updateTicketSchema,
  type CreateTicketInput,
  type CreateTicketMessageInput,
  type UpdateTicketInput,
} from "@/validations/ticket";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

// ── Generation numero de ticket ─────────────────────────────────

async function generateTicketNumber(societyId: string): Promise<string> {
  const currentYear = new Date().getFullYear();
  const count = await prisma.ticket.count({
    where: {
      societyId,
      createdAt: {
        gte: new Date(`${currentYear}-01-01`),
        lt: new Date(`${currentYear + 1}-01-01`),
      },
    },
  });
  const paddedNumber = String(count + 1).padStart(4, "0");
  return `TK-${currentYear}-${paddedNumber}`;
}

// ── Creation ticket depuis le portail locataire ──────────────────

export async function createTicketFromPortal(
  tenantId: string,
  societyId: string,
  input: CreateTicketInput
): Promise<ActionResult<{ id: string; ticketNumber: string }>> {
  try {
    const parsed = createTicketSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const data = parsed.data;

    // Verifier que le locataire appartient a la societe
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, societyId, isActive: true },
    });
    if (!tenant) return { success: false, error: "Locataire introuvable" };

    const ticketNumber = await generateTicketNumber(societyId);

    const ticket = await prisma.ticket.create({
      data: {
        societyId,
        tenantId,
        ticketNumber,
        subject: data.subject,
        description: data.description,
        category: data.category,
        priority: data.priority ?? "NORMALE",
        lotId: data.lotId ?? null,
        location: data.location ?? null,
      },
    });

    // Creer le premier message automatique
    const tenantName = tenant.entityType === "PERSONNE_MORALE"
      ? (tenant.companyName ?? tenant.email ?? "Locataire")
      : (`${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || (tenant.email ?? "Locataire"));

    await prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        authorType: "TENANT",
        authorId: tenantId,
        authorName: tenantName,
        content: data.description,
      },
    });

    // Notifier les gestionnaires de la societe
    const managers = await prisma.userSociety.findMany({
      where: { societyId, role: { in: ["ADMIN_SOCIETE", "GESTIONNAIRE"] } },
      select: { userId: true },
    });

    for (const manager of managers) {
      await createNotification({
        societyId,
        userId: manager.userId,
        type: "TICKET_CREATED",
        title: `Nouveau ticket : ${data.subject}`,
        message: `${tenantName} a cree le ticket ${ticketNumber}`,
        link: `/tickets/${ticket.id}`,
      });
    }

    revalidatePath("/tickets");
    return { success: true, data: { id: ticket.id, ticketNumber } };
  } catch (error) {
    console.error("[createTicketFromPortal]", error);
    return { success: false, error: "Erreur lors de la creation du ticket" };
  }
}

// ── Ajout de message depuis le portail locataire ─────────────────

export async function addTicketMessageFromPortal(
  tenantId: string,
  input: CreateTicketMessageInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createTicketMessageSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: parsed.data.ticketId, tenantId },
      include: { tenant: true },
    });
    if (!ticket) return { success: false, error: "Ticket introuvable" };
    if (ticket.status === "FERME") return { success: false, error: "Ce ticket est ferme" };

    const tenantName = ticket.tenant.entityType === "PERSONNE_MORALE"
      ? (ticket.tenant.companyName ?? "Locataire")
      : `${ticket.tenant.firstName ?? ""} ${ticket.tenant.lastName ?? ""}`.trim() || "Locataire";

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        authorType: "TENANT",
        authorId: tenantId,
        authorName: tenantName,
        content: parsed.data.content,
      },
    });

    // Reouvrir si le ticket etait en attente
    if (ticket.status === "EN_ATTENTE" || ticket.status === "RESOLU") {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: "EN_COURS" },
      });
    }

    // Notifier le gestionnaire assigne
    if (ticket.assignedToId) {
      await createNotification({
        societyId: ticket.societyId,
        userId: ticket.assignedToId,
        type: "TICKET_REPLY",
        title: `Reponse sur ${ticket.ticketNumber}`,
        message: `${tenantName} a repondu au ticket "${ticket.subject}"`,
        link: `/tickets/${ticket.id}`,
      });
    }

    revalidatePath(`/tickets/${ticket.id}`);
    return { success: true, data: { id: message.id } };
  } catch (error) {
    console.error("[addTicketMessageFromPortal]", error);
    return { success: false, error: "Erreur lors de l'ajout du message" };
  }
}

// ── Actions gestionnaire (manager side) ──────────────────────────

export async function addTicketMessageFromManager(
  societyId: string,
  input: CreateTicketMessageInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createTicketMessageSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: parsed.data.ticketId, societyId },
    });
    if (!ticket) return { success: false, error: "Ticket introuvable" };

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        authorType: "MANAGER",
        authorId: session.user.id,
        authorName: user?.name ?? user?.email ?? "Gestionnaire",
        content: parsed.data.content,
      },
    });

    // Marquer le ticket en cours si il etait ouvert
    if (ticket.status === "OUVERT") {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: "EN_COURS", assignedToId: session.user.id },
      });
    }

    revalidatePath(`/tickets/${ticket.id}`);
    revalidatePath("/tickets");
    return { success: true, data: { id: message.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[addTicketMessageFromManager]", error);
    return { success: false, error: "Erreur lors de l'ajout du message" };
  }
}

export async function updateTicket(
  societyId: string,
  input: UpdateTicketInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateTicketSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const { id, ...data } = parsed.data;

    const ticket = await prisma.ticket.findFirst({
      where: { id, societyId },
    });
    if (!ticket) return { success: false, error: "Ticket introuvable" };

    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === "RESOLU") {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = session.user.id;
      }
      if (data.status === "FERME") {
        updateData.closedAt = new Date();
        updateData.closedBy = session.user.id;
      }
    }
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId;

    await prisma.ticket.update({ where: { id }, data: updateData });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Ticket",
      entityId: id,
      details: { updatedFields: Object.keys(data) },
    });

    revalidatePath(`/tickets/${id}`);
    revalidatePath("/tickets");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateTicket]", error);
    return { success: false, error: "Erreur lors de la mise a jour" };
  }
}

export async function getTickets(societyId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.ticket.findMany({
    where: { societyId },
    include: {
      tenant: {
        select: {
          id: true,
          entityType: true,
          companyName: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      _count: { select: { messages: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function getTicketById(societyId: string, ticketId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.ticket.findFirst({
    where: { id: ticketId, societyId },
    include: {
      tenant: {
        select: {
          id: true,
          entityType: true,
          companyName: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

// ── Tickets du locataire (portail) ───────────────────────────────

export async function getPortalTickets(tenantId: string) {
  return prisma.ticket.findMany({
    where: { tenantId },
    include: {
      _count: { select: { messages: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function getPortalTicketById(tenantId: string, ticketId: string) {
  return prisma.ticket.findFirst({
    where: { id: ticketId, tenantId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}
