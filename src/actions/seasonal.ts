"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
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

/* ─── Property CRUD ─────────────────────────────────────────────────── */

export async function createSeasonalProperty(
  societyId: string,
  input: CreateSeasonalPropertyInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createSeasonalPropertySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const property = await prisma.seasonalProperty.create({
      data: { societyId, ...parsed.data },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "SeasonalProperty",
      entityId: property.id,
    });

    revalidatePath("/saisonnier");
    return { success: true, data: { id: property.id } };
  } catch (error) {
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateSeasonalPropertySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const { id, ...data } = parsed.data;
    await prisma.seasonalProperty.update({ where: { id, societyId }, data });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "SeasonalProperty",
      entityId: id,
    });

    revalidatePath("/saisonnier");
    return { success: true, data: { id } };
  } catch (error) {
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    await prisma.seasonalProperty.delete({ where: { id: propertyId, societyId } });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "SeasonalProperty",
      entityId: propertyId,
    });

    revalidatePath("/saisonnier");
    return { success: true };
  } catch (error) {
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createBookingSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const checkIn = new Date(parsed.data.checkIn);
    const checkOut = new Date(parsed.data.checkOut);
    const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
    const netRevenue = parsed.data.totalPrice - parsed.data.platformFee;

    // Check for overlapping bookings
    const overlap = await prisma.seasonalBooking.findFirst({
      where: {
        propertyId: parsed.data.propertyId,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        OR: [
          { checkIn: { lt: checkOut }, checkOut: { gt: checkIn } },
        ],
      },
    });

    if (overlap) {
      return { success: false, error: "Ce créneau est déjà réservé" };
    }

    const booking = await prisma.seasonalBooking.create({
      data: {
        ...parsed.data,
        checkIn,
        checkOut,
        nights,
        netRevenue,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "SeasonalBooking",
      entityId: booking.id,
    });

    revalidatePath("/saisonnier");
    return { success: true, data: { id: booking.id } };
  } catch (error) {
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    await prisma.seasonalBooking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED" },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "SeasonalBooking",
      entityId: bookingId,
    });

    revalidatePath("/saisonnier");
    return { success: true };
  } catch (error) {
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createPricingSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const pricing = await prisma.seasonalPricing.create({
      data: {
        ...parsed.data,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
      },
    });

    revalidatePath("/saisonnier");
    return { success: true, data: { id: pricing.id } };
  } catch (error) {
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    await prisma.seasonalPricing.delete({ where: { id: pricingId } });

    revalidatePath("/saisonnier");
    return { success: true };
  } catch (error) {
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createBlockedDateSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const blocked = await prisma.seasonalBlockedDate.create({
      data: {
        ...parsed.data,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
      },
    });

    revalidatePath("/saisonnier");
    return { success: true, data: { id: blocked.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createBlockedDate]", error);
    return { success: false, error: "Erreur lors du blocage des dates" };
  }
}
