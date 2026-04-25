import { describe, it, expect } from "vitest"
import { formatCurrency, formatDate, formatDateTime, getLogoProxyUrl, buildLenderMapping, cn } from "@/lib/utils"

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
  it("proxifie une URL Supabase signée (upload/sign)", () => {
    const url = "https://xxx.supabase.co/storage/v1/object/upload/sign/documents/societies/logo.png?token=abc"
    expect(getLogoProxyUrl(url)).toBe("/api/storage/view?path=societies%2Flogo.png")
  })
  it("proxifie une URL Supabase publique", () => {
    const url = "https://xxx.supabase.co/storage/v1/object/public/documents/logos/test.jpg"
    expect(getLogoProxyUrl(url)).toBe("/api/storage/view?path=logos%2Ftest.jpg")
  })
  it("retourne l'URL telle quelle si non Supabase", () => {
    const url = "https://external.cdn.com/logo.png"
    expect(getLogoProxyUrl(url)).toBe(url)
  })
})

describe("buildLenderMapping", () => {
  it("mappe une liste vide sur une map vide", () => {
    expect(buildLenderMapping([])).toEqual(new Map())
  })

  it("regroupe des noms identiques", () => {
    const mapping = buildLenderMapping(["LCL", "LCL"])
    expect(mapping.get("LCL")).toBe("LCL")
  })

  it("regroupe des noms qui partagent des tokens", () => {
    const mapping = buildLenderMapping(["LCL - Crédit Lyonnais", "LCL"])
    expect(mapping.get("LCL")).toBe("LCL - Crédit Lyonnais")
    expect(mapping.get("LCL - Crédit Lyonnais")).toBe("LCL - Crédit Lyonnais")
  })

  it("garde des noms distincts séparés", () => {
    const mapping = buildLenderMapping(["Société Générale", "BNP Paribas"])
    expect(mapping.get("Société Générale")).toBe("Société Générale")
    expect(mapping.get("BNP Paribas")).toBe("BNP Paribas")
  })
})

describe("cn", () => {
  it("merge des classes", () => { expect(cn("a", "b", false as unknown as string | undefined)).toBe("a b") })
})
