import { describe, it, expect } from "vitest"
import { formatCurrency, formatDate, formatDateTime, getLogoProxyUrl, cn } from "@/lib/utils"

describe("formatCurrency", () => {
  it("formate un montant en euros fr-FR", () => {
    const result = formatCurrency(1234.5)
    expect(result).toMatch(/1[\s\u00a0\u202f]234[,.]50/)
    expect(result).toContain("€")
  })
  it("formate zero", () => {
    const result = formatCurrency(0)
    expect(result).toMatch(/0[,.]00/)
    expect(result).toContain("€")
  })
})

describe("formatDate", () => {
  it("formate une date en dd/MM/yyyy", () => {
    expect(formatDate(new Date(2024, 0, 15))).toBe("15/01/2024")
  })
})

describe("formatDateTime", () => {
  it("formate une date avec heure", () => {
    const result = formatDateTime(new Date(2024, 0, 15))
    expect(result).toMatch(/15\/01\/2024/)
  })
})

describe("getLogoProxyUrl", () => {
  it("retourne null si null", () => { expect(getLogoProxyUrl(null)).toBeNull() })
  it("retourne null si undefined", () => { expect(getLogoProxyUrl(undefined)).toBeNull() })
  it("proxifie un chemin relatif", () => {
    expect(getLogoProxyUrl("/uploads/logo.png")).toBe("/api/storage/view?path=%2Fuploads%2Flogo.png")
  })
})

describe("cn", () => {
  it("merge des classes", () => { expect(cn("a", "b", false as unknown as string | undefined)).toBe("a b") })
})
