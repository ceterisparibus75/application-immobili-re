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

  it("utilise 'NORMALE' par défaut si priority absente → B2 arm1 L71", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(buildTenant() as never);
    const inputWithoutPriority = { subject: "Test", description: "Desc", category: "PLOMBERIE" as const };
    const r = await createTicketFromPortal(TENANT_ID, SOCIETY_ID, inputWithoutPriority);
    expect(r.success).toBe(true);
    expect(prismaMock.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ priority: "NORMALE" }) })
    );
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


// ─── createTicketFromPortal — branches manquantes ─────────────────────────────

describe("createTicketFromPortal — branches manquantes", () => {
  beforeEach(() => {
    prismaMock.ticket.count.mockResolvedValue(0);
    prismaMock.ticket.create.mockResolvedValue({ id: TICKET_ID } as never);
    prismaMock.ticketMessage.create.mockResolvedValue({ id: MESSAGE_ID } as never);
    prismaMock.userSociety.findMany.mockResolvedValue([] as never);
  });

  it("retourne une erreur Zod si input invalide (ligne 50)", async () => {
    const r = await createTicketFromPortal(TENANT_ID, SOCIETY_ID, { subject: "", description: "", category: "PLOMBERIE" as const, priority: "NORMALE" as const });
    expect(r.success).toBe(false);
  });

  it("retourne une erreur generique si la BDD echoue (lignes 112-113)", async () => {
    prismaMock.tenant.findFirst.mockRejectedValue(new Error("DB error"));
    const r = await createTicketFromPortal(TENANT_ID, SOCIETY_ID, validCreateInput);
    expect(r.success).toBe(false);
    expect(r.error).toContain("Erreur");
  });

  it("PERSONNE_MORALE avec companyName → authorName depuis companyName (lignes 78 TRUE, 79 left)", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(buildTenant({ entityType: "PERSONNE_MORALE", companyName: "SCI Test" }) as never);
    const r = await createTicketFromPortal(TENANT_ID, SOCIETY_ID, validCreateInput);
    expect(r.success).toBe(true);
    expect(prismaMock.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorName: "SCI Test" }) })
    );
  });

  it("PERSONNE_MORALE companyName null, email present → fallback email (ligne 79 middle)", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(buildTenant({ entityType: "PERSONNE_MORALE", companyName: null, email: "sci@example.com" }) as never);
    const r = await createTicketFromPortal(TENANT_ID, SOCIETY_ID, validCreateInput);
    expect(r.success).toBe(true);
    expect(prismaMock.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorName: "sci@example.com" }) })
    );
  });

  it("PERSONNE_MORALE sans nom ni email + sans priority/location → 'Locataire' + fallbacks (lignes 71/73 right, 79 right)", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(buildTenant({ entityType: "PERSONNE_MORALE", companyName: null, email: null }) as never);
    const r = await createTicketFromPortal(TENANT_ID, SOCIETY_ID, { subject: "Test", description: "Desc", category: "PLOMBERIE" as const });
    expect(r.success).toBe(true);
    expect(prismaMock.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ priority: "NORMALE", location: null }) })
    );
    expect(prismaMock.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorName: "Locataire" }) })
    );
  });

  it("PERSONNE_PHYSIQUE noms null, email present → trim vide → email (ligne 80 binary counts[1])", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(buildTenant({ firstName: null, lastName: null, email: "alice@example.com" }) as never);
    const r = await createTicketFromPortal(TENANT_ID, SOCIETY_ID, validCreateInput);
    expect(r.success).toBe(true);
    expect(prismaMock.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorName: "alice@example.com" }) })
    );
  });

  it("PERSONNE_PHYSIQUE noms null, email null → 'Locataire' (ligne 80 binary counts[2], email ?? right)", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(buildTenant({ firstName: null, lastName: null, email: null }) as never);
    const r = await createTicketFromPortal(TENANT_ID, SOCIETY_ID, validCreateInput);
    expect(r.success).toBe(true);
    expect(prismaMock.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorName: "Locataire" }) })
    );
  });
});

// ─── addTicketMessageFromPortal — branches manquantes ─────────────────────────

describe("addTicketMessageFromPortal — branches manquantes", () => {
  beforeEach(() => {
    prismaMock.ticketMessage.create.mockResolvedValue({ id: MESSAGE_ID } as never);
    prismaMock.ticket.update.mockResolvedValue({} as never);
  });

  it("retourne une erreur Zod si input invalide (ligne 126)", async () => {
    const r = await addTicketMessageFromPortal(TENANT_ID, { ticketId: "", content: "" });
    expect(r.success).toBe(false);
  });

  it("retourne une erreur si le ticket est introuvable (ligne 133)", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(null);
    const r = await addTicketMessageFromPortal(TENANT_ID, validMessageInput);
    expect(r.success).toBe(false);
    expect(r.error).toContain("introuvable");
  });

  it("retourne une erreur generique si la BDD echoue (lignes 173-174)", async () => {
    prismaMock.ticket.findFirst.mockRejectedValue(new Error("DB error"));
    const r = await addTicketMessageFromPortal(TENANT_ID, validMessageInput);
    expect(r.success).toBe(false);
    expect(r.error).toContain("Erreur");
  });

  it("PERSONNE_MORALE tenant avec companyName → authorName companyName (lignes 136 TRUE, 137 left)", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(
      buildTicket({ status: "EN_COURS", tenant: buildTenant({ entityType: "PERSONNE_MORALE", companyName: "SCI Lyon" }), assignedToId: null }) as never
    );
    const r = await addTicketMessageFromPortal(TENANT_ID, validMessageInput);
    expect(r.success).toBe(true);
    expect(prismaMock.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorName: "SCI Lyon" }) })
    );
  });

  it("PERSONNE_MORALE tenant companyName null → 'Locataire' (ligne 137 right)", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(
      buildTicket({ status: "EN_COURS", tenant: buildTenant({ entityType: "PERSONNE_MORALE", companyName: null }), assignedToId: null }) as never
    );
    const r = await addTicketMessageFromPortal(TENANT_ID, validMessageInput);
    expect(r.success).toBe(true);
    expect(prismaMock.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorName: "Locataire" }) })
    );
  });

  it("PERSONNE_PHYSIQUE noms null → trim vide → 'Locataire' (ligne 138 right branches)", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(
      buildTicket({ status: "EN_COURS", tenant: buildTenant({ firstName: null, lastName: null }), assignedToId: null }) as never
    );
    const r = await addTicketMessageFromPortal(TENANT_ID, validMessageInput);
    expect(r.success).toBe(true);
    expect(prismaMock.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorName: "Locataire" }) })
    );
  });

  it("status RESOLU → réouvre + || RESOLU right branch (ligne 151 binary right)", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(
      buildTicket({ status: "RESOLU", assignedToId: MANAGER_ID }) as never
    );
    const r = await addTicketMessageFromPortal(TENANT_ID, validMessageInput);
    expect(r.success).toBe(true);
    expect(prismaMock.ticket.update).toHaveBeenCalledWith({
      where: { id: TICKET_ID },
      data: { status: "EN_COURS" },
    });
  });

  it("status OUVERT, sans assignedToId → IF 151 FALSE + IF 159 FALSE (pas de notif)", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(
      buildTicket({ status: "OUVERT", assignedToId: null }) as never
    );
    const r = await addTicketMessageFromPortal(TENANT_ID, validMessageInput);
    expect(r.success).toBe(true);
    expect(prismaMock.ticket.update).not.toHaveBeenCalled();
  });
});

// ─── addTicketMessageFromManager — branches manquantes ────────────────────────

describe("addTicketMessageFromManager — branches manquantes", () => {
  beforeEach(() => {
    prismaMock.ticketMessage.create.mockResolvedValue({ id: MESSAGE_ID } as never);
    prismaMock.ticket.update.mockResolvedValue({} as never);
  });

  it("retourne une erreur Zod si input invalide (ligne 189)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const r = await addTicketMessageFromManager(SOCIETY_ID, { ticketId: "", content: "" });
    expect(r.success).toBe(false);
  });

  it("retourne une erreur si le ticket est introuvable (ligne 195)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.ticket.findFirst.mockResolvedValue(null);
    const r = await addTicketMessageFromManager(SOCIETY_ID, validMessageInput);
    expect(r.success).toBe(false);
    expect(r.error).toContain("introuvable");
  });

  it("retourne une erreur ForbiddenError (ligne 225)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const r = await addTicketMessageFromManager(SOCIETY_ID, validMessageInput);
    expect(r.success).toBe(false);
  });

  it("retourne une erreur generique si la BDD echoue (lignes 226-227)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.ticket.findFirst.mockRejectedValue(new Error("DB error"));
    const r = await addTicketMessageFromManager(SOCIETY_ID, validMessageInput);
    expect(r.success).toBe(false);
    expect(r.error).toContain("Erreur");
  });

  it("user.name null → fallback email (ligne 207 middle branch)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.ticket.findFirst.mockResolvedValue(buildTicket({ status: "EN_COURS" }) as never);
    prismaMock.user.findUnique.mockResolvedValue({ name: null, email: "gestionnaire@example.com" } as never);
    const r = await addTicketMessageFromManager(SOCIETY_ID, validMessageInput);
    expect(r.success).toBe(true);
    expect(prismaMock.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorName: "gestionnaire@example.com" }) })
    );
  });

  it("user null → 'Gestionnaire' (ligne 207 right branch)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.ticket.findFirst.mockResolvedValue(buildTicket({ status: "EN_COURS" }) as never);
    prismaMock.user.findUnique.mockResolvedValue(null as never);
    const r = await addTicketMessageFromManager(SOCIETY_ID, validMessageInput);
    expect(r.success).toBe(true);
    expect(prismaMock.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorName: "Gestionnaire" }) })
    );
  });

  it("ticket status EN_COURS → pas de update (ligne 213 IF FALSE)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.ticket.findFirst.mockResolvedValue(buildTicket({ status: "EN_COURS" }) as never);
    prismaMock.user.findUnique.mockResolvedValue({ name: "Gestionnaire Test", email: "g@example.com" } as never);
    const r = await addTicketMessageFromManager(SOCIETY_ID, validMessageInput);
    expect(r.success).toBe(true);
    expect(prismaMock.ticket.update).not.toHaveBeenCalled();
  });
});

// ─── updateTicket — branches manquantes ───────────────────────────────────────

describe("updateTicket — branches manquantes", () => {
  it("retourne une erreur Zod si input invalide (ligne 240)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const r = await updateTicket(SOCIETY_ID, { id: "" });
    expect(r.success).toBe(false);
  });

  it("retourne une erreur si le ticket est introuvable (ligne 248)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.ticket.findFirst.mockResolvedValue(null);
    const r = await updateTicket(SOCIETY_ID, validUpdateInput);
    expect(r.success).toBe(false);
    expect(r.error).toContain("introuvable");
  });

  it("met a jour le closedAt/closedBy si statut FERME (lignes 258-259)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.ticket.findFirst.mockResolvedValue({ id: TICKET_ID, status: "EN_COURS" } as never);
    prismaMock.ticket.update.mockResolvedValue({} as never);
    const r = await updateTicket(SOCIETY_ID, { id: TICKET_ID, status: "FERME" as const });
    expect(r.success).toBe(true);
    expect(prismaMock.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ closedAt: expect.any(Date) }) })
    );
  });

  it("retourne une erreur ForbiddenError (ligne 281)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const r = await updateTicket(SOCIETY_ID, validUpdateInput);
    expect(r.success).toBe(false);
  });

  it("retourne une erreur generique si la BDD echoue (lignes 282-283)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.ticket.findFirst.mockRejectedValue(new Error("DB error"));
    const r = await updateTicket(SOCIETY_ID, validUpdateInput);
    expect(r.success).toBe(false);
    expect(r.error).toContain("Erreur");
  });

  it("updateTicket sans status → IF 251 FALSE (only priority updated)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.ticket.findFirst.mockResolvedValue(buildTicket({ status: "EN_COURS" }) as never);
    prismaMock.ticket.update.mockResolvedValue({} as never);
    const r = await updateTicket(SOCIETY_ID, { id: TICKET_ID, priority: "HAUTE" as const });
    expect(r.success).toBe(true);
    expect(prismaMock.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ priority: "HAUTE" }) })
    );
    const callData = prismaMock.ticket.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(callData.status).toBeUndefined();
    expect(callData.resolvedAt).toBeUndefined();
  });
});


// ─── getTicketById — retourne le ticket (ligne 314) ──────────────────────────

describe("getTicketById — succes", () => {
  it("retourne le ticket si authentifie (ligne 314)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.ticket.findFirst.mockResolvedValue({ id: TICKET_ID, status: "OUVERT", messages: [] } as never);

    const r = await getTicketById(SOCIETY_ID, TICKET_ID);

    expect(r).not.toBeNull();
    expect(r?.id).toBe(TICKET_ID);
  });
});

