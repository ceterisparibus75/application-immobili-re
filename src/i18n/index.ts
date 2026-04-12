import frMessages from "./locales/fr.json";
import enMessages from "./locales/en.json";

/* ─── Types ─────────────────────────────────────────────────────────── */

export type Locale = "fr" | "en";
export type Messages = typeof frMessages;
type NestedKeyOf<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? NestedKeyOf<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : never;

export type TranslationKey = NestedKeyOf<Messages>;

/* ─── Config ────────────────────────────────────────────────────────── */

export const LOCALES: Locale[] = ["fr", "en"];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_NAMES: Record<Locale, string> = {
  fr: "Français",
  en: "English",
};

const messages: Record<Locale, Messages> = {
  fr: frMessages,
  en: enMessages,
};

/* ─── Translation function ──────────────────────────────────────────── */

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

/**
 * Get translation for a given key in the specified locale.
 * Supports interpolation with {variable} syntax.
 */
export function t(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const msg = getNestedValue(messages[locale] as unknown as Record<string, unknown>, key)
    ?? getNestedValue(messages[DEFAULT_LOCALE] as unknown as Record<string, unknown>, key)
    ?? key;

  if (!params) return msg;

  return msg.replace(/\{(\w+)\}/g, (_, name: string) => {
    return params[name]?.toString() ?? `{${name}}`;
  });
}

/**
 * Create a scoped translation function for a given locale.
 */
export function createTranslator(locale: Locale) {
  return (key: string, params?: Record<string, string | number>): string => {
    return t(locale, key, params);
  };
}

/**
 * Get all messages for a locale (for client-side provider).
 */
export function getMessages(locale: Locale): Messages {
  return messages[locale] ?? messages[DEFAULT_LOCALE];
}
