import { describe, it, expect } from "vitest"
import {
  createSeasonalPropertySchema,
  updateSeasonalPropertySchema,
  createBookingSchema,
  createPricingSchema,
  createBlockedDateSchema,
} from "@/validations/seasonal"

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t"

/* ─── createSeasonalPropertySchema ───────────────────────────────── */

describe("createSeasonalPropertySchema", () => {
  const valid = {
    name: "Villa Soleil",
    address: "45 chemin de la Mer",
    city: "Cannes",
    postalCode: "06400",
    capacity: 6,
    bedrooms: 3,
    bathrooms: 2,
  }

  it("valide une propriete saisonniere correcte", () => {
    const result = createSeasonalPropertySchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it("applique les defauts country, propertyType, checkInTime, checkOutTime, minStay", () => {
    const result = createSeasonalPropertySchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.country).toBe("France")
      expect(result.data.propertyType).toBe("APARTMENT")
      expect(result.data.checkInTime).toBe("15:00")
      expect(result.data.checkOutTime).toBe("11:00")
      expect(result.data.minStay).toBe(1)
    }
  })

  it("accepte tous les types de propriete", () => {
    const types = ["APARTMENT", "HOUSE", "VILLA", "STUDIO", "ROOM", "GITE", "CHALET"]
    for (const propertyType of types) {
      const result = createSeasonalPropertySchema.safeParse({ ...valid, propertyType })
      expect(result.success).toBe(true)
    }
  })

  it("echoue si propertyType est invalide", () => {
    const result = createSeasonalPropertySchema.safeParse({ ...valid, propertyType: "CASTLE" })
    expect(result.success).toBe(false)
  })

  it("echoue si name est vide", () => {
    const result = createSeasonalPropertySchema.safeParse({ ...valid, name: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si name depasse 200 caracteres", () => {
    const result = createSeasonalPropertySchema.safeParse({ ...valid, name: "x".repeat(201) })
    expect(result.success).toBe(false)
  })

  it("echoue si address est vide", () => {
    const result = createSeasonalPropertySchema.safeParse({ ...valid, address: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si city est vide", () => {
    const result = createSeasonalPropertySchema.safeParse({ ...valid, city: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si postalCode trop court", () => {
    const result = createSeasonalPropertySchema.safeParse({ ...valid, postalCode: "064" })
    expect(result.success).toBe(false)
  })

  it("echoue si capacity est 0", () => {
    const result = createSeasonalPropertySchema.safeParse({ ...valid, capacity: 0 })
    expect(result.success).toBe(false)
  })

  it("echoue si capacity est negatif", () => {
    const result = createSeasonalPropertySchema.safeParse({ ...valid, capacity: -1 })
    expect(result.success).toBe(false)
  })

  it("echoue si bedrooms est negatif", () => {
    const result = createSeasonalPropertySchema.safeParse({ ...valid, bedrooms: -1 })
    expect(result.success).toBe(false)
  })

  it("accepte bedrooms a 0", () => {
    const result = createSeasonalPropertySchema.safeParse({ ...valid, bedrooms: 0 })
    expect(result.success).toBe(true)
  })

  it("echoue si bathrooms est negatif", () => {
    const result = createSeasonalPropertySchema.safeParse({ ...valid, bathrooms: -1 })
    expect(result.success).toBe(false)
  })

  it("accepte area positive optionnelle", () => {
    const result = createSeasonalPropertySchema.safeParse({ ...valid, area: 120.5 })
    expect(result.success).toBe(true)
  })

  it("echoue si area est 0", () => {
    const result = createSeasonalPropertySchema.safeParse({ ...valid, area: 0 })
    expect(result.success).toBe(false)
  })

  it("echoue si area est negatif", () => {
    const result = createSeasonalPropertySchema.safeParse({ ...valid, area: -50 })
    expect(result.success).toBe(false)
  })

  it("accepte amenities comme tableau de strings", () => {
    const result = createSeasonalPropertySchema.safeParse({
      ...valid,
      amenities: ["WiFi", "Piscine", "Parking"],
    })
    expect(result.success).toBe(true)
  })

  it("accepte lotId optionnel valide", () => {
    const result = createSeasonalPropertySchema.safeParse({ ...valid, lotId: VALID_CUID })
    expect(result.success).toBe(true)
  })

  it("echoue si lotId est un CUID invalide", () => {
    const result = createSeasonalPropertySchema.safeParse({ ...valid, lotId: "not-a-cuid" })
    expect(result.success).toBe(false)
  })

  it("echoue si minStay est 0", () => {
    const result = createSeasonalPropertySchema.safeParse({ ...valid, minStay: 0 })
    expect(result.success).toBe(false)
  })

  it("echoue si capacity est decimal", () => {
    const result = createSeasonalPropertySchema.safeParse({ ...valid, capacity: 2.5 })
    expect(result.success).toBe(false)
  })
})

/* ─── updateSeasonalPropertySchema ───────────────────────────────── */

describe("updateSeasonalPropertySchema", () => {
  it("requiert un id CUID valide", () => {
    const result = updateSeasonalPropertySchema.safeParse({ id: VALID_CUID })
    expect(result.success).toBe(true)
  })

  it("echoue sans id", () => {
    const result = updateSeasonalPropertySchema.safeParse({ name: "Nouveau nom" })
    expect(result.success).toBe(false)
  })

  it("echoue avec un id invalide", () => {
    const result = updateSeasonalPropertySchema.safeParse({ id: "bad" })
    expect(result.success).toBe(false)
  })

  it("accepte une mise a jour partielle", () => {
    const result = updateSeasonalPropertySchema.safeParse({
      id: VALID_CUID,
      capacity: 8,
    })
    expect(result.success).toBe(true)
  })
})

/* ─── createBookingSchema ────────────────────────────────────────── */

describe("createBookingSchema", () => {
  const valid = {
    propertyId: VALID_CUID,
    guestName: "Pierre Voyageur",
    checkIn: "2025-07-01",
    checkOut: "2025-07-08",
    totalPrice: 1400,
  }

  it("valide une reservation correcte", () => {
    const result = createBookingSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it("applique les defauts guestCount, cleaningFee, platformFee", () => {
    const result = createBookingSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.guestCount).toBe(1)
      expect(result.data.cleaningFee).toBe(0)
      expect(result.data.platformFee).toBe(0)
    }
  })

  it("echoue si guestName est vide", () => {
    const result = createBookingSchema.safeParse({ ...valid, guestName: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si guestName depasse 200 caracteres", () => {
    const result = createBookingSchema.safeParse({ ...valid, guestName: "x".repeat(201) })
    expect(result.success).toBe(false)
  })

  it("echoue si checkIn est vide", () => {
    const result = createBookingSchema.safeParse({ ...valid, checkIn: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si checkOut est vide", () => {
    const result = createBookingSchema.safeParse({ ...valid, checkOut: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si totalPrice est negatif", () => {
    const result = createBookingSchema.safeParse({ ...valid, totalPrice: -100 })
    expect(result.success).toBe(false)
  })

  it("accepte totalPrice a 0", () => {
    const result = createBookingSchema.safeParse({ ...valid, totalPrice: 0 })
    expect(result.success).toBe(true)
  })

  it("echoue si propertyId invalide", () => {
    const result = createBookingSchema.safeParse({ ...valid, propertyId: "bad" })
    expect(result.success).toBe(false)
  })

  it("accepte guestEmail valide", () => {
    const result = createBookingSchema.safeParse({ ...valid, guestEmail: "pierre@test.com" })
    expect(result.success).toBe(true)
  })

  it("accepte guestEmail vide (empty string)", () => {
    const result = createBookingSchema.safeParse({ ...valid, guestEmail: "" })
    expect(result.success).toBe(true)
  })

  it("echoue si guestEmail invalide", () => {
    const result = createBookingSchema.safeParse({ ...valid, guestEmail: "not-email" })
    expect(result.success).toBe(false)
  })

  it("echoue si guestCount est 0", () => {
    const result = createBookingSchema.safeParse({ ...valid, guestCount: 0 })
    expect(result.success).toBe(false)
  })

  it("accepte source et notes optionnels", () => {
    const result = createBookingSchema.safeParse({
      ...valid,
      source: "Airbnb",
      notes: "Arrivée tardive prévue",
    })
    expect(result.success).toBe(true)
  })

  it("echoue si source depasse 50 caracteres", () => {
    const result = createBookingSchema.safeParse({ ...valid, source: "x".repeat(51) })
    expect(result.success).toBe(false)
  })

  it("echoue si notes depasse 2000 caracteres", () => {
    const result = createBookingSchema.safeParse({ ...valid, notes: "x".repeat(2001) })
    expect(result.success).toBe(false)
  })

  it("echoue si cleaningFee est negatif", () => {
    const result = createBookingSchema.safeParse({ ...valid, cleaningFee: -10 })
    expect(result.success).toBe(false)
  })

  it("echoue si platformFee est negatif", () => {
    const result = createBookingSchema.safeParse({ ...valid, platformFee: -5 })
    expect(result.success).toBe(false)
  })
})

/* ─── createPricingSchema ────────────────────────────────────────── */

describe("createPricingSchema", () => {
  const valid = {
    propertyId: VALID_CUID,
    name: "Haute saison",
    startDate: "2025-07-01",
    endDate: "2025-08-31",
    pricePerNight: 200,
  }

  it("valide une tarification correcte", () => {
    const result = createPricingSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it("echoue si name est vide", () => {
    const result = createPricingSchema.safeParse({ ...valid, name: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si name depasse 100 caracteres", () => {
    const result = createPricingSchema.safeParse({ ...valid, name: "x".repeat(101) })
    expect(result.success).toBe(false)
  })

  it("echoue si startDate est vide", () => {
    const result = createPricingSchema.safeParse({ ...valid, startDate: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si endDate est vide", () => {
    const result = createPricingSchema.safeParse({ ...valid, endDate: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si pricePerNight est negatif", () => {
    const result = createPricingSchema.safeParse({ ...valid, pricePerNight: -10 })
    expect(result.success).toBe(false)
  })

  it("accepte pricePerNight a 0", () => {
    const result = createPricingSchema.safeParse({ ...valid, pricePerNight: 0 })
    expect(result.success).toBe(true)
  })

  it("accepte weeklyDiscount optionnelle entre 0 et 100", () => {
    expect(createPricingSchema.safeParse({ ...valid, weeklyDiscount: 0 }).success).toBe(true)
    expect(createPricingSchema.safeParse({ ...valid, weeklyDiscount: 50 }).success).toBe(true)
    expect(createPricingSchema.safeParse({ ...valid, weeklyDiscount: 100 }).success).toBe(true)
  })

  it("echoue si weeklyDiscount > 100", () => {
    const result = createPricingSchema.safeParse({ ...valid, weeklyDiscount: 101 })
    expect(result.success).toBe(false)
  })

  it("echoue si weeklyDiscount < 0", () => {
    const result = createPricingSchema.safeParse({ ...valid, weeklyDiscount: -1 })
    expect(result.success).toBe(false)
  })

  it("accepte monthlyDiscount optionnelle entre 0 et 100", () => {
    expect(createPricingSchema.safeParse({ ...valid, monthlyDiscount: 0 }).success).toBe(true)
    expect(createPricingSchema.safeParse({ ...valid, monthlyDiscount: 100 }).success).toBe(true)
  })

  it("echoue si monthlyDiscount > 100", () => {
    const result = createPricingSchema.safeParse({ ...valid, monthlyDiscount: 101 })
    expect(result.success).toBe(false)
  })

  it("echoue si propertyId invalide", () => {
    const result = createPricingSchema.safeParse({ ...valid, propertyId: "bad" })
    expect(result.success).toBe(false)
  })
})

/* ─── createBlockedDateSchema ────────────────────────────────────── */

describe("createBlockedDateSchema", () => {
  const valid = {
    propertyId: VALID_CUID,
    startDate: "2025-12-20",
    endDate: "2026-01-05",
  }

  it("valide des dates bloquees correctes", () => {
    const result = createBlockedDateSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it("echoue si startDate est vide", () => {
    const result = createBlockedDateSchema.safeParse({ ...valid, startDate: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si endDate est vide", () => {
    const result = createBlockedDateSchema.safeParse({ ...valid, endDate: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si propertyId invalide", () => {
    const result = createBlockedDateSchema.safeParse({ ...valid, propertyId: "bad" })
    expect(result.success).toBe(false)
  })

  it("accepte reason optionnelle", () => {
    const result = createBlockedDateSchema.safeParse({ ...valid, reason: "Travaux de rénovation" })
    expect(result.success).toBe(true)
  })

  it("echoue si reason depasse 200 caracteres", () => {
    const result = createBlockedDateSchema.safeParse({ ...valid, reason: "x".repeat(201) })
    expect(result.success).toBe(false)
  })
})
