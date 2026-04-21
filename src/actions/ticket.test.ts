import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notifications-internal", () => ({
  createInternalNotification: vi.fn().mockResolvedValue({ id: "notif-1" }),
}));

import {
  addTicketMessageFromManager,
  addTicketMessageFromPortal,
  createTicketFromPortal,
  getPortalTicketById,
  getPortalTickets,
  getTicketById,
  getTickets,
  updateTicket,
} from "./ticket";
import { createAuditLog } from "@/lib/audit";
import { createInternalNotification } from "@/lib/notifications-internal";

const SOCIETY_ID = "society-1";
const TENANT_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const TICKET_ID = "clh3x2z4k0001qh8g7z1y2v3u";
const MESSAGE_ID = "clh3x2z4k0002qh8g7z1y2v3v";
const MANAGER_ID = "user-manager-1";

const validCreateInput = {
  subject: "Fuite dans la cuisine",
  description: "Une fuite est apparue sous l'évier.",
  category: "PLOMBERIE" as const,
  priority: "HAUTE" as const,
  location: "Cuisine",
};

const validMessageInput = {
  ticketId: TICKET_ID,
  content: "Pouvez-vous intervenir rapidement ?",
};

const validUpdateInput = {
  id: TICKET_ID,
  status: "RESOLU" as const,
  priority: "URGENTE" as const,
  assignedToId: "clh3x2z4k0003qh8g7z1y2v3w",
};

const buildTenant = (overrides = {}) => ({
  id: TENANT_ID,
  societyId: SOCIETY_ID,
  entityType: "PERSONNE_PHYSIQUE",
  firstName: "Alice",
  lastName: "Durand",
  companyName: null,
  email: "alice@example.com",
  isActive: true,
  ...overrides,
});

const buildTicket = (overrides = {}) => ({
  id: TICKET_ID,
  societyId: SOCIETY_ID,
  tenantId: TENANT_ID,
  ticketNumber: "TK-2026-0001",
  subject: validCreateInput.subject,
  description: validCreateInput.description,
  category: validCreateInput.category,
  priority: validCreateInput.priority,
  status: "OUVERT",
  lotId: null,
  location: validCreateInput.location,
  assignedToId: null,
  tenant: buildTenant(),
  ...overrides,
});

describe("createTicketFromPortal", () => {
  beforeEach(() => {
    prismaMock.ticket.count.mockResolvedValue(0);
    prismaMock.ticket.create.mockResolvedValue({ id: TICKET_ID } as never);
    prismaMock.ticketMessage.create.mockResolvedValue({ id: MESSAGE_ID } as never);
    prismaMock.userSociety.findMany.mockResolvedValue([
      { userId: MANAGER_ID },
      { userId: "user-manager-2" },
    ] as never);
  });

  it("retourne une erreur si le locataire est introuvable", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(null);

    const r = await createTicketFromPortal(TENANT_ID, SOCIETY_ID, validCreateInput);

    expect(r.success).toBe(false);
    expect(r.error).toBe("Locataire introuvable");
  });

  it("crée un ticket, un premier message et notifie les gestionnaires", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(buildTenant() as never);

    const r = await createTicketFromPortal(TENANT_ID, SOCIETY_ID, validCreateInput);

    expect(r.success).toBe(true);
    expect(r.data).toEqual({ id: TICKET_ID, ticketNumber: "TK-2026-0001" });
    expect(prismaMock.ticket.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        societyId: SOCIETY_ID,
        tenantId: TENANT_ID,
        ticketNumber: "TK-2026-0001",
      }),
    });
    expect(prismaMock.ticketMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticketId: TICKET_ID,
        authorType: "TENANT",
        authorId: TENANT_ID,
        authorName: "Alice Durand",
      }),
    });
    expect(createInternalNotification).toHaveBeenCalledTimes(2);
  });
});

describe("addTicketMessageFromPortal", () => {
  beforeEach(() => {
    prismaMock.ticketMessage.create.mockResolvedValue({ id: MESSAGE_ID } as never);
  });

  it("retourne une erreur si le ticket est fermé", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(buildTicket({ status: "FERME" }) as never);

    const r = await addTicketMessageFromPortal(TENANT_ID, validMessageInput);

    expect(r.success).toBe(false);
    expect(r.error).toBe("Ce ticket est ferme");
  });

  it("réouvre un ticket en attente et notifie le gestionnaire assigné", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(
      buildTicket({ status: "EN_ATTENTE", assignedToId: MANAGER_ID }) as never
    );
    prismaMock.ticket.update.mockResolvedValue({ id: TICKET_ID } as never);

    const r = await addTicketMessageFromPortal(TENANT_ID, validMessageInput);

    expect(r.success).toBe(true);
    expect(r.data).toEqual({ id: MESSAGE_ID });
    expect(prismaMock.ticket.update).toHaveBeenCalledWith({
      where: { id: TICKET_ID },
      data: { status: "EN_COURS" },
    });
    expect(createInternalNotification).toHaveBeenCalledWith({
      societyId: SOCIETY_ID,
      userId: MANAGER_ID,
      type: "TICKET_REPLY",
      title: "Reponse sur TK-2026-0001",
      message: 'Alice Durand a repondu au ticket "Fuite dans la cuisine"',
      link: `/tickets/${TICKET_ID}`,
    });
  });
});

describe("addTicketMessageFromManager", () => {
  beforeEach(() => {
    prismaMock.ticketMessage.create.mockResolvedValue({ id: MESSAGE_ID } as never);
    prismaMock.user.findUnique.mockResolvedValue({
      name: "Gestionnaire Test",
      email: "gestionnaire@example.com",
    } as never);
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();

    const r = await addTicketMessageFromManager(SOCIETY_ID, validMessageInput);

    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("ajoute un message et assigne le ticket s'il était ouvert", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.ticket.findFirst.mockResolvedValue(buildTicket({ status: "OUVERT" }) as never);
    prismaMock.ticket.update.mockResolvedValue({ id: TICKET_ID } as never);

    const r = await addTicketMessageFromManager(SOCIETY_ID, validMessageInput);

    expect(r.success).toBe(true);
    expect(prismaMock.ticketMessage.create).toHaveBeenCalledWith({
      data: {
        ticketId: TICKET_ID,
        authorType: "MANAGER",
        authorId: "user-1",
        authorName: "Gestionnaire Test",
        content: validMessageInput.content,
      },
    });
    expect(prismaMock.ticket.update).toHaveBeenCalledWith({
      where: { id: TICKET_ID },
      data: { status: "EN_COURS", assignedToId: "user-1" },
    });
  });
});

describe("updateTicket", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated();

    const r = await updateTicket(SOCIETY_ID, validUpdateInput);

    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("met à jour un ticket, ajoute resolvedAt/resolvedBy et écrit l'audit", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.ticket.findFirst.mockResolvedValue(buildTicket() as never);
    prismaMock.ticket.update.mockResolvedValue({ id: TICKET_ID } as never);

    const r = await updateTicket(SOCIETY_ID, validUpdateInput);

    expect(r.success).toBe(true);
    expect(prismaMock.ticket.update).toHaveBeenCalledWith({
      where: { id: TICKET_ID },
      data: expect.objectContaining({
        status: "RESOLU",
        priority: "URGENTE",
        assignedToId: "clh3x2z4k0003qh8g7z1y2v3w",
        resolvedBy: "user-1",
      }),
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        societyId: SOCIETY_ID,
        userId: "user-1",
        action: "UPDATE",
        entity: "Ticket",
        entityId: TICKET_ID,
      })
    );
  });
});

describe("ticket queries", () => {
  it("getTickets retourne [] si non authentifié", async () => {
    mockUnauthenticated();

    const r = await getTickets(SOCIETY_ID);

    expect(r).toEqual([]);
  });

  it("getTickets retourne les tickets de la société", async () => {
    mockAuthSession(UserRole.LECTURE);
    prismaMock.ticket.findMany.mockResolvedValue([{ id: TICKET_ID }] as never);

    const r = await getTickets(SOCIETY_ID);

    expect(r).toEqual([{ id: TICKET_ID }]);
    expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { societyId: SOCIETY_ID } })
    );
  });

  it("getTicketById retourne null si non authentifié", async () => {
    mockUnauthenticated();

    const r = await getTicketById(SOCIETY_ID, TICKET_ID);

    expect(r).toBeNull();
  });

  it("getPortalTickets retourne les tickets du locataire", async () => {
    prismaMock.ticket.findMany.mockResolvedValue([{ id: TICKET_ID }] as never);

    const r = await getPortalTickets(TENANT_ID);

    expect(r).toEqual([{ id: TICKET_ID }]);
    expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_ID } })
    );
  });

  it("getPortalTicketById retourne le ticket du portail avec ses messages", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue({ id: TICKET_ID, messages: [] } as never);

    const r = await getPortalTicketById(TENANT_ID, TICKET_ID);

    expect(r).toEqual({ id: TICKET_ID, messages: [] });
    expect(prismaMock.ticket.findFirst).toHaveBeenCalledWith({
      where: { id: TICKET_ID, tenantId: TENANT_ID },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  });
});
