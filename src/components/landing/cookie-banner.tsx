"use client";

import { useState, useEffect, useCallback } from "react";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "cookie-consent";
const VISITOR_ID_KEY = "cookie-visitor-id";

function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, id);
    return id;
  } catch {
    return "unknown";
  }
}

async function recordConsent(decision: "accepted" | "rejected", visitorId: string) {
  try {
    await fetch("/api/consent/cookie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, visitorId }),
    });
  } catch {
    // Échec silencieux : le localStorage reste la source de vérité locale
  }
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!stored) setVisible(true);
  }, []);

  const accept = useCallback(async () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
    await recordConsent("accepted", getOrCreateVisitorId());
  }, []);

  const reject = useCallback(async () => {
    localStorage.setItem(STORAGE_KEY, "rejected");
    setVisible(false);
    await recordConsent("rejected", getOrCreateVisitorId());
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentement aux cookies"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
    >
      <div className="max-w-3xl mx-auto bg-white border border-border/80 rounded-2xl shadow-lg px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="shrink-0 mt-0.5 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Cookie className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Nous utilisons des cookies analytiques pour améliorer votre expérience et mesurer la performance de notre site.
            Aucun tracking publicitaire tiers sans votre accord.{" "}
            <a href="/politique-confidentialite" className="underline hover:text-foreground transition-colors">
              En savoir plus
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={reject}
            className="rounded-lg h-9 text-sm"
          >
            Refuser
          </Button>
          <Button
            size="sm"
            onClick={accept}
            className="rounded-lg h-9 text-sm bg-brand-gradient-soft hover:opacity-90 text-white"
          >
            Accepter
          </Button>
        </div>
      </div>
    </div>
  );
}
