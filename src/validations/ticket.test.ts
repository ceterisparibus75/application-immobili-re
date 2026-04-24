import { describe, it, expect } from "vitest";
import {
  createTicketSchema,
  createTicketMessageSchema,
  updateTicketSchema,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from "./ticket";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";

describe("TICKET constants", () => {
  it("TICKET_CATEGORIES contient les 10 catégories", () => {
    expect(TICKET_CATEGORIES).toHaveLength(10);
    expect(TICKET_CATEGORIES).toContain("MAINTENANCE");
    expect(TICKET_CATEGORIES).toContain("AUTRE");
  });

  it("TICKET_PRIORITIES contient 4 niveaux", () => {
    expect(TICKET_PRIORITIES).toHaveLength(4);
  });

  it("TICKET_STATUSES contient 5 statuts", () => {
    expect(TICKET_STATUSES).toHaveLength(5);
    expect(TICKET_STATUSES).toContain("OUVERT");
    expect(TICKET_STATUSES).toContain("FERME");
  });

  it("TICKET_CATEGORY_LABELS couvre toutes les catégories", () => {
    for (const cat of TICKET_CATEGORIES) {
      expect(TICKET_CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });

  it("TICKET_PRIORITY_LABELS couvre toutes les priorités", () => {
    for (const p of TICKET_PRIORITIES) {
      expect(TICKET_PRIORITY_LABELS[p]).toBeTruthy();
    }
  });

  it("TICKET_STATUS_LABELS couvre tous les statuts", () => {
    for (const s of TICKET_STATUSES) {
      expect(TICKET_STATUS_LABELS[s]).toBeTruthy();
    }
  });
});

describe("createTicketSchema", () => {
  const validTicket = {
    subject: "Fuite d'eau dans la cuisine",
    description: "Il y a une fuite sous l'évier depuis ce matin.",
    category: "PLOMBERIE" as const,
  };

  it("accepte un ticket minimal valide", () => {
    expect(createTicketSchema.safeParse(validTicket).success).toBe(true);
  });

  it("accepte un ticket complet", () => {
    const result = createTicketSchema.safeParse({
      ...validTicket,
      priority: "URGENTE",
      lotId: VALID_CUID,
      location: "Cuisine, sous l'évier",
    });
    expect(result.success).toBe(true);
  });

  it("priority vaut NORMALE par défaut", () => {
    const result = createTicketSchema.safeParse(validTicket);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.priority).toBe("NORMALE");
  });

  it("rejette un sujet vide", () => {
    const result = createTicketSchema.safeParse({ ...validTicket, subject: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/sujet est requis/);
    }
  });

  it("rejette un sujet trop long (> 200 chars)", () => {
    const result = createTicketSchema.safeParse({ ...validTicket, subject: "X".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejette une description vide", () => {
    const result = createTicketSchema.safeParse({ ...validTicket, description: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/description est requise/);
    }
  });

  it("rejette une catégorie invalide", () => {
    const result = createTicketSchema.safeParse({ ...validTicket, category: "JARDIN" });
    expect(result.success).toBe(false);
  });

  it("accepte toutes les catégories valides", () => {
    for (const category of TICKET_CATEGORIES) {
      expect(createTicketSchema.safeParse({ ...validTicket, category }).success).toBe(true);
    }
  });

  it("rejette une priorité invalide", () => {
    const result = createTicketSchema.safeParse({ ...validTicket, priority: "EXTREME" });
    expect(result.success).toBe(false);
  });

  it("accepte lotId null", () => {
    expect(createTicketSchema.safeParse({ ...validTicket, lotId: null }).success).toBe(true);
  });
});

describe("createTicketMessageSchema", () => {
  it("accepte un message valide", () => {
    expect(createTicketMessageSchema.safeParse({ ticketId: VALID_CUID, content: "Bonjour." }).success).toBe(true);
  });

  it("rejette un contenu vide", () => {
    const result = createTicketMessageSchema.safeParse({ ticketId: VALID_CUID, content: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/message est requis/);
    }
  });

  it("rejette un ticketId non CUID", () => {
    const result = createTicketMessageSchema.safeParse({ ticketId: "bad", content: "Bonjour." });
    expect(result.success).toBe(false);
  });

  it("rejette un contenu trop long (> 5000 chars)", () => {
    const result = createTicketMessageSchema.safeParse({ ticketId: VALID_CUID, content: "X".repeat(5001) });
    expect(result.success).toBe(false);
  });
});

describe("updateTicketSchema", () => {
  it("accepte une mise à jour de statut", () => {
    expect(updateTicketSchema.safeParse({ id: VALID_CUID, status: "RESOLU" }).success).toBe(true);
  });

  it("accepte une mise à jour de priorité", () => {
    expect(updateTicketSchema.safeParse({ id: VALID_CUID, priority: "HAUTE" }).success).toBe(true);
  });

  it("rejette si id absent", () => {
    expect(updateTicketSchema.safeParse({ status: "RESOLU" }).success).toBe(false);
  });

  it("rejette un statut invalide", () => {
    const result = updateTicketSchema.safeParse({ id: VALID_CUID, status: "ARCHIVE" });
    expect(result.success).toBe(false);
  });

  it("accepte assignedToId null", () => {
    expect(updateTicketSchema.safeParse({ id: VALID_CUID, assignedToId: null }).success).toBe(true);
  });
});
