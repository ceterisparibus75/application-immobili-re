"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import {
  createSeasonalPropertySchema,
  updateSeasonalPropertySchema,
  createBookingSchema,
  createPricingSchema,
  createBlockedDateSchema,
  type CreateSeasonalPropertyInput,
  type UpdateSeasonalPropertyInput,
  type CreateBookingInput,
  type CreatePricingInput,
  type CreateBlockedDateInput,
} from "@/validations/seasonal";

function parseStayRange(checkInInput: string, checkOutInput: string) {
  const checkIn = new Date(checkInInput);
  const checkOut = new Date(checkOutInput);

  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
    return { error: "Dates invalides" } as const;
  }

  if (checkOut <= checkIn) {
    return { error: "La date de départ doit être postérieure à la date d'arrivée" } as const;
  }

  const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  return { checkIn, checkOut, nights } as const;
}

async function getSeasonalPropertyInSociety(societyId: string, propertyId: string) {
  return prisma.seasonalProperty.findUnique({
    where: { id: propertyId, societyId },
    select: { id: true, capacity: true, minStay: true },
  });
}

async function hasUnavailableSeasonalPeriod(propertyId: string, checkIn: Date, checkOut: Date) {
  const [bookingOverlap, blockedOverlap] = await Promise.all([
    prisma.seasonalBooking.findFirst({
      where: {
        propertyId,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
      select: { id: true },
    }),
    prisma.seasonalBlockedDate.findFirst({
      where: {
        propertyId,
        startDate: { lt: checkOut },
        endDate: { gt: checkIn },
      },
      select: { id: true },
    }),
  ]);

  return { bookingOverlap, blockedOverlap };
}

/* ─── Property CRUD ─────────────────────────────────────────────────── */

export async function createSeasonalProperty(
  societyId: string,
  input: CreateSeasonalPropertyInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = createSeasonalPropertySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const property = await prisma.seasonalProperty.create({
      data: { societyId, ...parsed.data },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "SeasonalProperty",
      entityId: property.id,
    });

    revalidatePath("/saisonnier");
    return { success: true, data: { id: property.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createSeasonalProperty]", error);
    return { success: false, error: "Erreur lors de la création" };
  }
}

export async function updateSeasonalProperty(
  societyId: string,
  input: UpdateSeasonalPropertyInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = updateSeasonalPropertySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const { id, ...data } = parsed.data;
    await prisma.seasonalProperty.update({ where: { id, societyId }, data });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "SeasonalProperty",
      entityId: id,
    });

    revalidatePath("/saisonnier");
    return { success: true, data: { id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateSeasonalProperty]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function deleteSeasonalProperty(
  societyId: string,
  propertyId: string
): Promise<ActionResult<void>> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    await prisma.seasonalProperty.delete({ where: { id: propertyId, societyId } });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "SeasonalProperty",
      entityId: propertyId,
    });

    revalidatePath("/saisonnier");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteSeasonalProperty]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

/* ─── Bookings ──────────────────────────────────────────────────────── */

export async function createBooking(
  societyId: string,
  input: CreateBookingInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = createBookingSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const property = await getSeasonalPropertyInSociety(societyId, parsed.data.propertyId);
    if (!property) return { success: false, error: "Bien saisonnier introuvable" };

    const range = parseStayRange(parsed.data.checkIn, parsed.data.checkOut);
    if ("error" in range) return { success: false, error: range.error };

    if (range.nights < property.minStay) {
      return { success: false, error: `Séjour minimum : ${property.minStay} nuit${property.minStay > 1 ? "s" : ""}` };
    }

    if (parsed.data.guestCount > property.capacity) {
      return { success: false, error: `La capacité maximale du bien est de ${property.capacity} personne${property.capacity > 1 ? "s" : ""}` };
    }

    const netRevenue = parsed.data.totalPrice - parsed.data.platformFee;

    const overlap = await hasUnavailableSeasonalPeriod(parsed.data.propertyId, range.checkIn, range.checkOut);

    if (overlap.bookingOverlap) {
      return { success: false, error: "Ce créneau est déjà réservé" };
    }
    if (overlap.blockedOverlap) {
      return { success: false, error: "Ce créneau est bloqué dans les indisponibilités" };
    }

    const booking = await prisma.seasonalBooking.create({
      data: {
        ...parsed.data,
        checkIn: range.checkIn,
        checkOut: range.checkOut,
        nights: range.nights,
        netRevenue,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "SeasonalBooking",
      entityId: booking.id,
    });

    revalidatePath("/saisonnier");
    return { success: true, data: { id: booking.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createBooking]", error);
    return { success: false, error: "Erreur lors de la création de la réservation" };
  }
}

export async function cancelBooking(
  societyId: string,
  bookingId: string
): Promise<ActionResult<void>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const booking = await prisma.seasonalBooking.findFirst({
      where: {
        id: bookingId,
        property: { societyId },
      },
      select: { id: true },
    });
    if (!booking) return { success: false, error: "Réservation introuvable" };

    await prisma.seasonalBooking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED" },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "SeasonalBooking",
      entityId: bookingId,
    });

    revalidatePath("/saisonnier");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[cancelBooking]", error);
    return { success: false, error: "Erreur lors de l'annulation" };
  }
}

/* ─── Pricing ───────────────────────────────────────────────────────── */

export async function createPricing(
  societyId: string,
  input: CreatePricingInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = createPricingSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const property = await getSeasonalPropertyInSociety(societyId, parsed.data.propertyId);
    if (!property) return { success: false, error: "Bien saisonnier introuvable" };

    const range = parseStayRange(parsed.data.startDate, parsed.data.endDate);
    if ("error" in range) return { success: false, error: range.error };

    const pricing = await prisma.seasonalPricing.create({
      data: {
        ...parsed.data,
        startDate: range.checkIn,
        endDate: range.checkOut,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "SeasonalPricing",
      entityId: pricing.id,
    });

    revalidatePath("/saisonnier");
    return { success: true, data: { id: pricing.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createPricing]", error);
    return { success: false, error: "Erreur lors de la création" };
  }
}

export async function deletePricing(
  societyId: string,
  pricingId: string
): Promise<ActionResult<void>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const pricing = await prisma.seasonalPricing.findFirst({
      where: {
        id: pricingId,
        property: { societyId },
      },
      select: { id: true },
    });
    if (!pricing) return { success: false, error: "Tarif introuvable" };

    await prisma.seasonalPricing.delete({ where: { id: pricingId } });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "SeasonalPricing",
      entityId: pricingId,
    });

    revalidatePath("/saisonnier");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deletePricing]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

/* ─── Blocked Dates ─────────────────────────────────────────────────── */

export async function createBlockedDate(
  societyId: string,
  input: CreateBlockedDateInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = createBlockedDateSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const property = await getSeasonalPropertyInSociety(societyId, parsed.data.propertyId);
    if (!property) return { success: false, error: "Bien saisonnier introuvable" };

    const range = parseStayRange(parsed.data.startDate, parsed.data.endDate);
    if ("error" in range) return { success: false, error: range.error };

    const overlap = await hasUnavailableSeasonalPeriod(parsed.data.propertyId, range.checkIn, range.checkOut);
    if (overlap.bookingOverlap) {
      return { success: false, error: "Impossible de bloquer une période déjà réservée" };
    }
    if (overlap.blockedOverlap) {
      return { success: false, error: "Cette période est déjà bloquée" };
    }

    const blocked = await prisma.seasonalBlockedDate.create({
      data: {
        ...parsed.data,
        startDate: range.checkIn,
        endDate: range.checkOut,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "SeasonalBlockedDate",
      entityId: blocked.id,
    });

    revalidatePath("/saisonnier");
    return { success: true, data: { id: blocked.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createBlockedDate]", error);
    return { success: false, error: "Erreur lors du blocage des dates" };
  }
}
