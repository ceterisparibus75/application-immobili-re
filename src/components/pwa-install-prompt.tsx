"use client";

import { useEffect, useState } from "react";
import { X, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "android" | "ios" | "none";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "none";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream) return "ios";
  if (/android/i.test(ua)) return "android";
  return "none";
}

function isAlreadyInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

const DISMISSED_KEY = "pwa-install-dismissed";
const DISMISSED_DAYS = 7;

function wasDismissedRecently(): boolean {
  try {
    const ts = localStorage.getItem(DISMISSED_KEY);
    if (!ts) return false;
    const diff = Date.now() - parseInt(ts, 10);
    return diff < DISMISSED_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function PwaInstallPrompt() {
  const [show, setShow] = useState(false);
  const [platform] = useState<Platform>(() => detectPlatform());
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isAlreadyInstalled()) return;
    if (wasDismissedRecently()) return;

    const p = platform;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (p === "android") setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Sur iOS, on affiche la bannière directement (pas d'event disponible)
    if (p === "ios") {
      const timer = setTimeout(() => setShow(true), 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [platform]);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }

  async function install() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShow(false);
      }
    }
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-4">
      <div className="rounded-xl border bg-card text-card-foreground shadow-lg p-4">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-96.png"
            alt="MyGestia"
            className="w-12 h-12 rounded-xl flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Installer MyGestia</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {platform === "ios"
                ? "Accédez rapidement à MyGestia depuis votre écran d'accueil"
                : "Installez l'application pour un accès rapide"}
            </p>

            {platform === "ios" && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                Appuyez sur{" "}
                <Share className="inline h-3.5 w-3.5 text-blue-500" />
                {" "}puis{" "}
                <strong>« Sur l'écran d'accueil »</strong>
              </p>
            )}

            {platform === "android" && (
              <Button
                size="sm"
                className="mt-2 h-8 text-xs"
                onClick={install}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Installer
              </Button>
            )}
          </div>
          <button
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground flex-shrink-0 -mt-1"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
