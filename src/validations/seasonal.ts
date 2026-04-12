import { z } from "zod";

/* ─── Property ──────────────────────────────────────────────────────── */

export const createSeasonalPropertySchema = z.object({
  name: z.string().min(1, "Nom requis").max(200),
  description: z.string().max(5000).optional(),
  address: z.string().min(1, "Adresse requise").max(300),
  city: z.string().min(1, "Ville requise").max(100),
  postalCode: z.string().min(5).max(10),
  country: z.string().default("France"),
  propertyType: z.enum(["APARTMENT", "HOUSE", "VILLA", "STUDIO", "ROOM", "GITE", "CHALET"]).default("APARTMENT"),
  capacity: z.number().int().min(1, "Capacité requise"),
  bedrooms: z.number().int().min(0),
  bathrooms: z.number().int().min(0),
  area: z.number().positive().optional(),
  amenities: z.array(z.string()).optional(),
  checkInTime: z.string().default("15:00"),
  checkOutTime: z.string().default("11:00"),
  minStay: z.number().int().min(1).default(1),
  lotId: z.string().cuid().optional(),
});

export const updateSeasonalPropertySchema = createSeasonalPropertySchema.partial().extend({
  id: z.string().cuid(),
});

export type CreateSeasonalPropertyInput = z.infer<typeof createSeasonalPropertySchema>;
export type UpdateSeasonalPropertyInput = z.infer<typeof updateSeasonalPropertySchema>;

/* ─── Booking ───────────────────────────────────────────────────────── */

export const createBookingSchema = z.object({
  propertyId: z.string().cuid(),
  guestName: z.string().min(1, "Nom du voyageur requis").max(200),
  guestEmail: z.string().email().optional().or(z.literal("")),
  guestPhone: z.string().max(30).optional(),
  guestCount: z.number().int().min(1).default(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  totalPrice: z.number().min(0),
  cleaningFee: z.number().min(0).default(0),
  platformFee: z.number().min(0).default(0),
  source: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

/* ─── Pricing ───────────────────────────────────────────────────────── */

export const createPricingSchema = z.object({
  propertyId: z.string().cuid(),
  name: z.string().min(1, "Nom de la période requis").max(100),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  pricePerNight: z.number().min(0),
  weeklyDiscount: z.number().min(0).max(100).optional(),
  monthlyDiscount: z.number().min(0).max(100).optional(),
});

export type CreatePricingInput = z.infer<typeof createPricingSchema>;

/* ─── Blocked dates ─────────────────────────────────────────────────── */

export const createBlockedDateSchema = z.object({
  propertyId: z.string().cuid(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().max(200).optional(),
});

export type CreateBlockedDateInput = z.infer<typeof createBlockedDateSchema>;
