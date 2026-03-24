import * as OTPAuth from "otpauth";
import { randomBytes } from "crypto";
import QRCode from "qrcode";
import { encrypt, decrypt } from "@/lib/encryption";

const ISSUER = process.env.NEXT_PUBLIC_APP_NAME ?? "GestImmo";

/**
 * Genere un nouveau secret TOTP (base32).
 */
export function generateTOTPSecret(): string {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: "account",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  return totp.secret.base32;
}

/**
 * Genere l'URI otpauth pour affichage dans un QR code.
 */
export function generateTOTPUri(secret: string, email: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
}

/**
 * Genere une image QR code (data URL base64) depuis l'URI otpauth.
 */
export async function generateQRCode(uri: string): Promise<string> {
  return QRCode.toDataURL(uri);
}

/**
 * Verifie un code TOTP contre un secret chiffre stocke en base.
 * Le secret doit avoir ete chiffre avec encryptTOTPSecret().
 */
export function verifyTOTP(encryptedSecret: string, token: string): boolean {
  try {
    const secret = decrypt(encryptedSecret);
    const totp = new OTPAuth.TOTP({
      issuer: ISSUER,
      label: "account",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
  } catch {
    return false;
  }
}

/**
 * Chiffre un secret TOTP avant stockage en base de donnees.
 */
export function encryptTOTPSecret(secret: string): string {
  return encrypt(secret);
}

/**
 * Dechiffre un secret TOTP stocke en base de donnees.
 */
export function decryptTOTPSecret(encrypted: string): string {
  return decrypt(encrypted);
}

/**
 * Genere des codes de recuperation 2FA.
 * Format : XXXXX-XXXXX (10 caracteres hexadecimaux avec tiret central)
 */
export function generateRecoveryCodes(count: number = 8): string[] {
  return Array.from({ length: count }, () => {
    const hex = randomBytes(5).toString("hex").toUpperCase();
    return hex.slice(0, 5) + "-" + hex.slice(5);
  });
}

/**
 * Chiffre un tableau de codes de recuperation avant stockage.
 */
export function encryptRecoveryCodes(codes: string[]): string[] {
  return codes.map((code) => encrypt(code));
}

/**
 * Dechiffre un tableau de codes de recuperation stockes en base.
 */
export function decryptRecoveryCodes(encryptedCodes: string[]): string[] {
  return encryptedCodes.map((code) => decrypt(code));
}
