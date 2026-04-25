import { describe, it, expect } from "vitest";
import * as OTPAuth from "otpauth";
import {
  generateTOTPSecret,
  generateTOTPUri,
  generateQRCode,
  generateRecoveryCodes,
  encryptTOTPSecret,
  decryptTOTPSecret,
  encryptRecoveryCodes,
  decryptRecoveryCodes,
  verifyTOTP,
} from "./two-factor";

describe("generateTOTPSecret", () => {
  it("retourne une chaîne base32 non vide", () => {
    const secret = generateTOTPSecret();
    expect(typeof secret).toBe("string");
    expect(secret.length).toBeGreaterThan(0);
  });

  it("génère des secrets différents à chaque appel", () => {
    const s1 = generateTOTPSecret();
    const s2 = generateTOTPSecret();
    expect(s1).not.toBe(s2);
  });

  it("contient uniquement des caractères base32 valides (A-Z, 2-7)", () => {
    const secret = generateTOTPSecret();
    expect(/^[A-Z2-7]+=*$/.test(secret)).toBe(true);
  });
});

describe("generateTOTPUri", () => {
  it("retourne un URI otpauth://", () => {
    const secret = generateTOTPSecret();
    const uri = generateTOTPUri(secret, "user@example.com");
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
  });

  it("inclut l'email dans l'URI", () => {
    const secret = generateTOTPSecret();
    const uri = generateTOTPUri(secret, "alice@example.com");
    expect(uri).toContain("alice");
  });
});

describe("generateQRCode", () => {
  it("retourne une data URL base64 PNG (ligne 41)", async () => {
    const secret = generateTOTPSecret();
    const uri = generateTOTPUri(secret, "test@example.com");
    const dataUrl = await generateQRCode(uri);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});

describe("generateRecoveryCodes", () => {
  it("génère 8 codes par défaut", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(8);
  });

  it("génère le nombre demandé de codes", () => {
    expect(generateRecoveryCodes(4)).toHaveLength(4);
    expect(generateRecoveryCodes(12)).toHaveLength(12);
  });

  it("chaque code respecte le format XXXXX-XXXXX (hex majuscule)", () => {
    const codes = generateRecoveryCodes();
    for (const code of codes) {
      expect(code).toMatch(/^[A-F0-9]{5}-[A-F0-9]{5}$/);
    }
  });

  it("génère des codes uniques", () => {
    const codes = generateRecoveryCodes(8);
    const unique = new Set(codes);
    expect(unique.size).toBe(8);
  });
});

describe("encryptTOTPSecret / decryptTOTPSecret", () => {
  it("chiffre et déchiffre un secret avec succès (round-trip)", () => {
    const rawSecret = generateTOTPSecret();
    const encrypted = encryptTOTPSecret(rawSecret);
    const decrypted = decryptTOTPSecret(encrypted);
    expect(decrypted).toBe(rawSecret);
  });

  it("le secret chiffré est différent du secret brut", () => {
    const rawSecret = generateTOTPSecret();
    const encrypted = encryptTOTPSecret(rawSecret);
    expect(encrypted).not.toBe(rawSecret);
  });

  it("deux chiffrements du même secret donnent des résultats différents (IV aléatoire)", () => {
    const rawSecret = generateTOTPSecret();
    const enc1 = encryptTOTPSecret(rawSecret);
    const enc2 = encryptTOTPSecret(rawSecret);
    expect(enc1).not.toBe(enc2);
  });
});

describe("encryptRecoveryCodes / decryptRecoveryCodes", () => {
  it("chiffre et déchiffre un tableau de codes (round-trip)", () => {
    const codes = generateRecoveryCodes(4);
    const encrypted = encryptRecoveryCodes(codes);
    const decrypted = decryptRecoveryCodes(encrypted);
    expect(decrypted).toEqual(codes);
  });

  it("retourne un tableau de la même longueur", () => {
    const codes = generateRecoveryCodes(6);
    expect(encryptRecoveryCodes(codes)).toHaveLength(6);
  });
});

describe("verifyTOTP", () => {
  it("valide un token TOTP correct", () => {
    const rawSecret = generateTOTPSecret();
    const encrypted = encryptTOTPSecret(rawSecret);
    // Générer le token courant via OTPAuth directement
    const totp = new OTPAuth.TOTP({
      issuer: "MyGestia",
      label: "account",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(rawSecret),
    });
    const token = totp.generate();
    expect(verifyTOTP(encrypted, token)).toBe(true);
  });

  it("rejette un token incorrect", () => {
    const rawSecret = generateTOTPSecret();
    const encrypted = encryptTOTPSecret(rawSecret);
    expect(verifyTOTP(encrypted, "000000")).toBe(false);
  });

  it("retourne false si le secret chiffré est invalide", () => {
    expect(verifyTOTP("invalid-ciphertext", "123456")).toBe(false);
  });

  it("rejette un token de longueur incorrecte", () => {
    const rawSecret = generateTOTPSecret();
    const encrypted = encryptTOTPSecret(rawSecret);
    expect(verifyTOTP(encrypted, "12345")).toBe(false);
    expect(verifyTOTP(encrypted, "1234567")).toBe(false);
  });
});
