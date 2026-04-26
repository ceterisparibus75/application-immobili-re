import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import { createLegalEvent, updateLegalEvent, deleteLegalEvent, getLegalEventsByLease } from "./legal-event";
import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";

const SOCIETY_ID = "cljhd7fk70000356oa5z7b0js";
const LEASE_ID = "cljhd7fk70000356oa5z7b0jl";
const EVENT_ID = "cljhd7fk70000356oa5z7b0je";

const baseLease = {
  id: LEASE_ID,
  societyId: SOCIETY_ID,
  status: "EN_COURS",
};

const baseEvent = {
  id: EVENT_ID,
  societyId: SOCIETY_ID,
  leaseId: LEASE_ID,
  type: "COMMANDEMENT_PAYER" as const,
  title: "Commandement de payer",
  description: null,
  eventDate: new Date("2026-04-01"),
  dueDate: new Date("2026-05-01"),
  status: "OUVERT" as const,
  resolvedAt: null,
  resolvedNote: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("createLegalEvent", () => {
  beforeEach(() => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
  });

  it("crée un événement juridique valide", async () => {
    prismaMock.lease.findFirst.mockResolvedValue(baseLease as never);
    prismaMock.legalEvent.create.mockResolvedValue(baseEvent as never);

    const result = await createLegalEvent(SOCIETY_ID, {
      leaseId: LEASE_ID,
      type: "COMMANDEMENT_PAYER",
      title: "Commandement de payer",
      eventDate: "2026-04-01",
      dueDate: "2026-05-01",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data?.id).toBe(EVENT_ID);
  });

  it("rejette si le bail n'appartient pas à la société", async () => {
    prismaMock.lease.findFirst.mockResolvedValue(null);

    const result = await createLegalEvent(SOCIETY_ID, {
      leaseId: LEASE_ID,
      type: "CONGE",
      title: "Congé",
      eventDate: "2026-04-01",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Bail introuvable");
  });

  it("rejette si la date est invalide", async () => {
    prismaMock.lease.findFirst.mockResolvedValue(baseLease as never);

    const result = await createLegalEvent(SOCIETY_ID, {
      leaseId: LEASE_ID,
      type: "EVICTION",
      title: "Éviction",
      eventDate: "pas-une-date",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("invalide");
  });

  it("rejette si non authentifié", async () => {
    mockUnauthenticated();

    const result = await createLegalEvent(SOCIETY_ID, {
      leaseId: LEASE_ID,
      type: "CONGE",
      title: "Test",
      eventDate: "2026-04-01",
    });

    expect(result.success).toBe(false);
  });
});

describe("updateLegalEvent", () => {
  beforeEach(() => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
  });

  it("met à jour le statut et pose resolvedAt si RESOLU", async () => {
    prismaMock.legalEvent.findFirst.mockResolvedValue(baseEvent as never);
    prismaMock.legalEvent.update.mockResolvedValue({ ...baseEvent, status: "RESOLU" } as never);

    const result = await updateLegalEvent(SOCIETY_ID, {
      id: EVENT_ID,
      status: "RESOLU",
      resolvedNote: "Réglé à l'amiable",
    });

    expect(result.success).toBe(true);
    const updateCall = prismaMock.legalEvent.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(updateCall.status).toBe("RESOLU");
    expect(updateCall.resolvedAt).toBeInstanceOf(Date);
    expect(updateCall.resolvedNote).toBe("Réglé à l'amiable");
  });

  it("rejette si l'événement n'appartient pas à la société", async () => {
    prismaMock.legalEvent.findFirst.mockResolvedValue(null);

    const result = await updateLegalEvent(SOCIETY_ID, {
      id: EVENT_ID,
      title: "Nouveau titre",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });
});

describe("deleteLegalEvent", () => {
  beforeEach(() => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
  });

  it("supprime un événement existant", async () => {
    prismaMock.legalEvent.findFirst.mockResolvedValue(baseEvent as never);
    prismaMock.legalEvent.delete.mockResolvedValue(baseEvent as never);

    const result = await deleteLegalEvent(SOCIETY_ID, EVENT_ID);

    expect(result.success).toBe(true);
    expect(prismaMock.legalEvent.delete).toHaveBeenCalledWith({ where: { id: EVENT_ID } });
  });

  it("rejette si l'événement n'existe pas", async () => {
    prismaMock.legalEvent.findFirst.mockResolvedValue(null);

    const result = await deleteLegalEvent(SOCIETY_ID, EVENT_ID);

    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });
});

describe("getLegalEventsByLease", () => {
  it("retourne [] si contexte absent", async () => {
    mockUnauthenticated();
    const result = await getLegalEventsByLease(SOCIETY_ID, LEASE_ID);
    expect(result).toEqual([]);
  });

  it("retourne les événements du bail", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.legalEvent.findMany.mockResolvedValue([baseEvent] as never);

    const result = await getLegalEventsByLease(SOCIETY_ID, LEASE_ID);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("COMMANDEMENT_PAYER");
  });
});
