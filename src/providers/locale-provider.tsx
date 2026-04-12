"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  type Locale,
  type Messages,
  DEFAULT_LOCALE,
  LOCALES,
  getMessages,
  t as translate,
} from "@/i18n";

/* ─── Context ───────────────────────────────────────────────────────── */

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  messages: Messages;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const STORAGE_KEY = "mygestia-locale";

/* ─── Provider ──────────────────────────────────────────────────────── */

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initialLocale) return initialLocale;
    if (typeof window === "undefined") return DEFAULT_LOCALE;
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && LOCALES.includes(stored)) return stored;
    // Detect from browser
    const browserLang = navigator.language.slice(0, 2) as Locale;
    return LOCALES.includes(browserLang) ? browserLang : DEFAULT_LOCALE;
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, messages: getMessages(locale) }}>
      {children}
    </LocaleContext.Provider>
  );
}

/* ─── Hook ──────────────────────────────────────────────────────────── */

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}
