"use client";

import { useLocale } from "@/providers/locale-provider";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
      {LOCALES.map((loc) => (
        <button
          key={loc}
          onClick={() => setLocale(loc)}
          className={cn(
            "text-xs px-2 py-1 rounded transition-colors",
            locale === loc
              ? "bg-primary/10 text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          {LOCALE_NAMES[loc]}
        </button>
      ))}
    </div>
  );
}
