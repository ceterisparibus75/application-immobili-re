import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import {
  createSeasonalProperty,
  updateSeasonalProperty,
  deleteSeasonalProperty,
  createBooking,
  cancelBooking,
  createPricing,
  deletePricing,
  createBlockedDate,
} from "./seasonal";
import { createAuditLog } from "@/lib/audit";

const SOCIETY_ID = "society-1";
const PROP_ID = "cproperty01";
const BOOKING_ID = "cbooking012";
const PRICING_ID = "cpricing012";

const buildValidProperty = () => ({
  name: "Appartement Côte d'Azur",
  address: "5 avenue de la Mer",
  city: "Nice",
  postalCode: "06000",
  country: "France",
  propertyType: "APARTMENT" as const,
  capacity: 4,
  bedrooms: 2,
  bathrooms: 1,
  checkInTime: "15:00",
  checkOutTime: "11:00",
  minStay: 1,
});

// ─── createSeasonalProperty ───────────────────────────────────────────────────

describe("createSeasonalProperty", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await createSeasonalProperty(SOCIETY_ID, buildValidProperty());
    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("erreur si role insuffisant (min GESTIONNAIRE requis)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await createSeasonalProperty(SOCIETY_ID, buildValidProperty());
    expect(r.success).toBe(false);
  });

  it("crée la propriété et l'audit log", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.seasonalProperty.create.mockResolvedValue({ id: PROP_ID } as never);

    const r = await createSeasonalProperty(SOCIETY_ID, buildValidProperty());
    expect(r.success).toBe(true);
    expect(r.data?.id).toBe(PROP_ID);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE", entity: "SeasonalProperty" })
    );
  });
});

// ─── updateSeasonalProperty ───────────────────────────────────────────────────

describe("updateSeasonalProperty", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await updateSeasonalProperty(SOCIETY_ID, { id: PROP_ID, name: "Nouveau nom" });
    expect(r.success).toBe(false);
  });

  it("met à jour la propriété", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.seasonalProperty.update.mockResolvedValue({ id: PROP_ID } as never);

    const r = await updateSeasonalProperty(SOCIETY_ID, { id: PROP_ID, name: "Nouveau nom" });
    expect(r.success).toBe(true);
    expect(r.data?.id).toBe(PROP_ID);
  });
});

// ─── deleteSeasonalProperty ───────────────────────────────────────────────────

describe("deleteSeasonalProperty", () => {
  it("erreur si role GESTIONNAIRE (min ADMIN_SOCIETE requis)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await deleteSeasonalProperty(SOCIETY_ID, PROP_ID);
    expect(r.success).toBe(false);
  });

  it("supprime avec succès en tant qu'ADMIN_SOCIETE", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.seasonalProperty.delete.mockResolvedValue({ id: PROP_ID } as never);

    const r = await deleteSeasonalProperty(SOCIETY_ID, PROP_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.seasonalProperty.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PROP_ID, societyId: SOCIETY_ID } })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE", entity: "SeasonalProperty" })
    );
  });
});

// ─── createBooking ────────────────────────────────────────────────────────────

describe("createBooking", () => {
  const validInput = {
    propertyId: PROP_ID,
    guestName: "Jean Dupont",
    checkIn: "2026-07-01",
    checkOut: "2026-07-08",
    totalPrice: 700,
    cleaningFee: 50,
    platformFee: 70,
    guestCount: 2,
  };

  beforeEach(() => {
    prismaMock.seasonalBooking.findFirst.mockResolvedValue(null); // pas de chevauchement
    prismaMock.seasonalBooking.create.mockResolvedValue({ id: BOOKING_ID } as never);
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await createBooking(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("erreur si role insuffisant (min GESTIONNAIRE requis)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await createBooking(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
  });

  it("erreur si chevauchement de réservation", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.seasonalBooking.findFirst.mockResolvedValue({ id: "cother012345" } as never);

    const r = await createBooking(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Ce créneau est déjà réservé");
  });

  it("calcule correctement le nombre de nuits (checkIn 1er, checkOut 8 = 7 nuits)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await createBooking(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    expect(prismaMock.seasonalBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nights: 7 }),
      })
    );
  });

  it("calcule le revenu net = totalPrice − platformFee", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    await createBooking(SOCIETY_ID, validInput);
    // netRevenue = 700 - 70 = 630
    expect(prismaMock.seasonalBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ netRevenue: 630 }),
      })
    );
  });

  it("crée la réservation et son audit log", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const r = await createBooking(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    expect(r.data?.id).toBe(BOOKING_ID);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE", entity: "SeasonalBooking" })
    );
  });
});

// ─── cancelBooking ────────────────────────────────────────────────────────────

describe("cancelBooking", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await cancelBooking(SOCIETY_ID, BOOKING_ID);
    expect(r.success).toBe(false);
  });

  it("passe le statut à CANCELLED", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.seasonalBooking.update.mockResolvedValue({} as never);

    const r = await cancelBooking(SOCIETY_ID, BOOKING_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.seasonalBooking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BOOKING_ID },
        data: { status: "CANCELLED" },
      })
    );
  });
});

// ─── createPricing / deletePricing ───────────────────────────────────────────

describe("createPricing", () => {
  const validInput = {
    propertyId: PROP_ID,
    name: "Haute saison été",
    startDate: "2026-07-01",
    endDate: "2026-08-31",
    pricePerNight: 120,
  };

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await createPricing(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
  });

  it("crée le tarif avec conversion des dates", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.seasonalPricing.create.mockResolvedValue({ id: PRICING_ID } as never);

    const r = await createPricing(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    // Les dates doivent être converties en objets Date
    expect(prismaMock.seasonalPricing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        }),
      })
    );
  });
});

describe("deletePricing", () => {
  it("supprime le tarif", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.seasonalPricing.delete.mockResolvedValue({} as never);

    const r = await deletePricing(SOCIETY_ID, PRICING_ID);
    expect(r.success).toBe(true);
  });
});

// ─── createBlockedDate ────────────────────────────────────────────────────────

describe("createBlockedDate", () => {
  const validInput = {
    propertyId: PROP_ID,
    startDate: "2026-12-24",
    endDate: "2026-12-26",
    reason: "Usage personnel Noël",
  };

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await createBlockedDate(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
  });

  it("bloque les dates avec conversion en objets Date", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.seasonalBlockedDate.create.mockResolvedValue({ id: "cblocked0123" } as never);

    const r = await createBlockedDate(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    expect(prismaMock.seasonalBlockedDate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
          reason: "Usage personnel Noël",
        }),
      })
    );
  });
});
