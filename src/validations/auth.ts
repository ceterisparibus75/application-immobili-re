import { z } from "zod";

const COMMON_PASSWORDS = new Set([
  "password", "123456789", "12345678", "password1", "iloveyou",
  "admin123", "letmein1", "welcome1", "monkey123", "dragon123",
  "master123", "hello123", "shadow123", "sunshine", "princess",
  "azerty123", "qwerty123", "motdepasse", "bonjour1", "soleil123",
  "football", "baseball", "superman", "batman123", "liverpool",
  "michael1", "jessica1", "Password1", "Admin1234", "Pa$$word",
  "P@ssword1", "Test1234!", "Welcome1!", "Azerty123!", "France123",
  "password!", "123456789!", "Soleil123!", "Bonjour1!", "Immo2024!",
]);

export const strongPasswordSchema = z
  .string()
  .min(12, "Minimum 12 caracteres")
  .regex(/[A-Z]/, "Au moins une majuscule (A-Z)")
  .regex(/[a-z]/, "Au moins une minuscule (a-z)")
  .regex(/[0-9]/, "Au moins un chiffre (0-9)")
  .regex(/[^A-Za-z0-9]/, "Au moins un caractere special (!@#$%...)")
  .refine(
    (pwd) => !COMMON_PASSWORDS.has(pwd),
    "Ce mot de passe est trop courant, choisissez-en un autre"
  );

export type StrongPasswordInput = z.infer<typeof strongPasswordSchema>;
