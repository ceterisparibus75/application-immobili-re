import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import {
  createLeaseAmendment,
  getLeaseAmendments,
  renewLease,
} from "./lease-amendment";
import { createAuditLog } from "@/lib/audit";

const SOCIETY_ID = "society-1";
const LEASE_ID = "lease-1";
const AMENDMENT_ID = "amendment-1";

const buildLease = (overrides = {}) => ({
  id: LEASE_ID,
  societyId: SOCIETY_ID,
  status: "EN_COURS",
  currentRentHT: 1800,
  endDate: new Date("2026-12-31T00:00:00.000Z"),
  _count: { amendments: 2 },
  ...overrides,
});

describe("createLeaseAmendment", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock)
    );
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();

    const r = await createLeaseAmendment(SOCIETY_ID, {
      leaseId: LEASE_ID,
      effectiveDate: "2026-01-01",
      description: "Révision du loyer",
      amendmentType: "AVENANT_LOYER",
      newRentHT: 1950,
    });

    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("erreur si rôle insuffisant", async () => {
    mockAuthSession(UserRole.LECTURE);

    const r = await createLeaseAmendment(SOCIETY_ID, {
      leaseId: LEASE_ID,
      effectiveDate: "2026-01-01",
      description: "Révision du loyer",
      amendmentType: "AVENANT_LOYER",
      newRentHT: 1950,
    });

    expect(r.success).toBe(false);
    expect(r.error).toContain("Permissions");
  });

  it("erreur si bail introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.lease.findFirst.mockResolvedValue(null);

    const r = await createLeaseAmendment(SOCIETY_ID, {
      leaseId: LEASE_ID,
      effectiveDate: "2026-01-01",
      description: "Révision du loyer",
      amendmentType: "AVENANT_LOYER",
      newRentHT: 1950,
    });

    expect(r.success).toBe(false);
    expect(r.error).toBe("Bail introuvable");
  });

  it("crée un avenant et met à jour le bail si loyer et date changent", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.lease.findFirst.mockResolvedValue(buildLease() as never);
    prismaMock.leaseAmendment.create.mockResolvedValue({
      id: AMENDMENT_ID,
      amendmentNumber: 3,
    } as never);
    prismaMock.lease.update.mockResolvedValue({ id: LEASE_ID } as never);

    const r = await createLeaseAmendment(SOCIETY_ID, {
      leaseId: LEASE_ID,
      effectiveDate: "2027-01-01",
      description: "Révision annuelle",
      amendmentType: "AVENANT_LOYER",
      newRentHT: 1950,
      newEndDate: "2027-12-31",
      otherChanges: { index: "ILC" },
    });

    expect(r.success).toBe(true);
    expect(r.data).toEqual({ id: AMENDMENT_ID, amendmentNumber: 3 });
    expect(prismaMock.leaseAmendment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leaseId: LEASE_ID,
        amendmentNumber: 3,
        description: "Révision annuelle",
        amendmentType: "AVENANT_LOYER",
        previousRentHT: 1800,
        newRentHT: 1950,
        previousEndDate: new Date("2026-12-31T00:00:00.000Z"),
        newEndDate: new Date("2027-12-31"),
        otherChanges: { index: "ILC" },
      }),
    });
    expect(prismaMock.lease.update).toHaveBeenCalledWith({
      where: { id: LEASE_ID },
      data: {
        currentRentHT: 1950,
        endDate: new Date("2027-12-31"),
      },
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        societyId: SOCIETY_ID,
        userId: "user-1",
        action: "CREATE",
        entity: "LeaseAmendment",
        entityId: AMENDMENT_ID,
      })
    );
  });

  it("crée un avenant sans modifier le bail si aucun changement n'est fourni", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.lease.findFirst.mockResolvedValue(buildLease() as never);
    prismaMock.leaseAmendment.create.mockResolvedValue({
      id: AMENDMENT_ID,
      amendmentNumber: 3,
    } as never);

    const r = await createLeaseAmendment(SOCIETY_ID, {
      leaseId: LEASE_ID,
      effectiveDate: "2026-06-01",
      description: "Avenant divers",
      amendmentType: "AVENANT_DIVERS",
    });

    expect(r.success).toBe(true);
    expect(prismaMock.lease.update).not.toHaveBeenCalled();
  });
});

describe("renewLease", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock)
    );
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();

    const r = await renewLease(SOCIETY_ID, {
      leaseId: LEASE_ID,
      newEndDate: "2027-12-31",
    });

    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("erreur si bail introuvable ou inactif", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.lease.findFirst.mockResolvedValue(null);

    const r = await renewLease(SOCIETY_ID, {
      leaseId: LEASE_ID,
      newEndDate: "2027-12-31",
    });

    expect(r.success).toBe(false);
    expect(r.error).toBe("Bail introuvable ou inactif");
  });

  it("erreur si la nouvelle date de fin n'est pas postérieure", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.lease.findFirst.mockResolvedValue(buildLease() as never);

    const r = await renewLease(SOCIETY_ID, {
      leaseId: LEASE_ID,
      newEndDate: "2026-12-31",
    });

    expect(r.success).toBe(false);
    expect(r.error).toBe("La nouvelle date de fin doit être postérieure à l'actuelle");
  });

  it("renouvelle le bail via un avenant de renouvellement", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.lease.findFirst
      .mockResolvedValueOnce(buildLease({ _count: undefined }) as never)
      .mockResolvedValueOnce(buildLease() as never);
    prismaMock.leaseAmendment.create.mockResolvedValue({
      id: AMENDMENT_ID,
      amendmentNumber: 3,
    } as never);
    prismaMock.lease.update.mockResolvedValue({ id: LEASE_ID } as never);

    const r = await renewLease(SOCIETY_ID, {
      leaseId: LEASE_ID,
      newEndDate: "2027-12-31",
      newRentHT: 2100,
    });

    expect(r.success).toBe(true);
    expect(r.data).toEqual({ id: LEASE_ID, amendmentId: AMENDMENT_ID });
    expect(prismaMock.leaseAmendment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leaseId: LEASE_ID,
        amendmentType: "RENOUVELLEMENT",
        newRentHT: 2100,
        newEndDate: new Date("2027-12-31"),
      }),
    });
  });
});

describe("getLeaseAmendments", () => {
  it("retourne un tableau vide si non authentifié", async () => {
    mockUnauthenticated();

    const r = await getLeaseAmendments(SOCIETY_ID, LEASE_ID);

    expect(r).toEqual([]);
  });

  it("retourne les avenants du bail triés par numéro décroissant", async () => {
    mockAuthSession(UserRole.LECTURE);
    prismaMock.leaseAmendment.findMany.mockResolvedValue([
      { id: "amendment-2", amendmentNumber: 2 },
      { id: "amendment-1", amendmentNumber: 1 },
    ] as never);

    const r = await getLeaseAmendments(SOCIETY_ID, LEASE_ID);

    expect(r).toEqual([
      { id: "amendment-2", amendmentNumber: 2 },
      { id: "amendment-1", amendmentNumber: 1 },
    ]);
    expect(prismaMock.leaseAmendment.findMany).toHaveBeenCalledWith({
      where: { leaseId: LEASE_ID, lease: { societyId: SOCIETY_ID } },
      orderBy: { amendmentNumber: "desc" },
    });
  });
});
