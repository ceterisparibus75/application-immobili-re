import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { encrypt, decrypt } from "@/lib/encryption"

describe("encrypt / decrypt", () => {
  it("round-trip : decrypt(encrypt(x)) === x", () => {
    const texte = "FR76 3000 4000 0400 0001 2345 678"
    expect(decrypt(encrypt(texte))).toBe(texte)
  })

  it("deux chiffrements du meme texte produisent des IVs differents", () => {
    const texte = "secret"
    const e1 = encrypt(texte)
    const e2 = encrypt(texte)
    expect(e1).not.toBe(e2)
  })

  it("format invalide -> throws", () => {
    expect(() => decrypt("invalide")).toThrow("Invalid encrypted text format")
  })
})

describe("ENCRYPTION_KEY manquante", () => {
  let original: string | undefined
  beforeEach(() => { original = process.env.ENCRYPTION_KEY })
  afterEach(() => { process.env.ENCRYPTION_KEY = original })

  it("encrypt sans ENCRYPTION_KEY -> throws", () => {
    delete process.env.ENCRYPTION_KEY
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY is not defined in environment variables")
  })

  it("ENCRYPTION_KEY mauvaise longueur -> throws", () => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(16).toString("base64")
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY must be 32 bytes encoded in base64")
  })
})
