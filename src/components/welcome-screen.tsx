"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Building2, Briefcase, Home, Users, ArrowRight, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ProfileOption {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  features: string[];
}

const PROFILES: ProfileOption[] = [
  {
    id: "sci",
    title: "SCI familiale",
    description: "Vous gérez un patrimoine personnel ou familial (1 à 30 lots)",
    icon: Home,
    features: ["Facturation automatique", "Suivi des loyers", "Export FEC"],
  },
  {
    id: "cabinet",
    title: "Cabinet de gestion",
    description: "Vous gérez le patrimoine de vos clients (20 à 200 lots)",
    icon: Briefcase,
    features: ["Multi-propriétaire", "Rapprochement bancaire", "Rapports personnalisés"],
  },
  {
    id: "fonciere",
    title: "Foncière / Family office",
    description: "Vous gérez un portefeuille conséquent (50+ lots, multi-sociétés)",
    icon: Building2,
    features: ["Multi-sociétés", "Évaluation patrimoniale IA", "API et intégrations"],
  },
  {
    id: "syndic",
    title: "Syndic / Administrateur de biens",
    description: "Vous gérez des copropriétés et mandats de gestion",
    icon: Users,
    features: ["Portail locataire", "Gestion des tickets", "Signature électronique"],
  },
];

const WELCOME_STORAGE_KEY = "mygestia-welcome-seen";
const WELCOME_STORAGE_EVENT = "mygestia-welcome-change";

function subscribeToWelcomeVisibility(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(WELCOME_STORAGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(WELCOME_STORAGE_EVENT, onStoreChange);
  };
}

function getWelcomeVisibilitySnapshot() {
  return !localStorage.getItem(WELCOME_STORAGE_KEY);
}

function getServerWelcomeVisibilitySnapshot() {
  return false;
}

function notifyWelcomeVisibilityChange() {
  window.dispatchEvent(new Event(WELCOME_STORAGE_EVENT));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function WelcomeScreen({ userName }: { userName?: string }) {
  const router = useRouter();
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const visible = useSyncExternalStore(
    subscribeToWelcomeVisibility,
    getWelcomeVisibilitySnapshot,
    getServerWelcomeVisibilitySnapshot
  );

  const handleContinue = useCallback(() => {
    if (selectedProfile) {
      localStorage.setItem(WELCOME_STORAGE_KEY, "true");
      localStorage.setItem("mygestia-user-profile", selectedProfile);
    }
    notifyWelcomeVisibilityChange();
    router.push("/dashboard");
  }, [selectedProfile, router]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(WELCOME_STORAGE_KEY, "true");
    notifyWelcomeVisibilityChange();
  }, []);

  if (!visible) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[80] bg-gradient-to-br from-[var(--color-brand-deep)] via-[var(--color-brand-blue)] to-[var(--color-brand-cyan)]"
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 overflow-y-auto">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-screen-title"
          className="w-full max-w-2xl max-h-[calc(100dvh-3rem)] animate-fade-in-scale"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-1.5 mb-6">
              <Sparkles className="h-4 w-4 text-cyan-300" />
              <span className="text-sm font-medium text-white/90">Bienvenue sur MyGestia</span>
            </div>
            <h1 id="welcome-screen-title" className="text-3xl font-bold text-white mb-3">
              {userName ? `Bonjour ${userName} !` : "Bienvenue !"}
            </h1>
            <p className="text-lg text-white/70 max-w-md mx-auto">
              Pour personnaliser votre expérience, dites-nous quel type de gestionnaire vous êtes.
            </p>
          </div>

          {/* Profile cards */}
          <div className="grid grid-cols-1 gap-4 mb-8 sm:grid-cols-2" role="radiogroup" aria-label="Type de gestionnaire">
            {PROFILES.map((profile) => {
              const Icon = profile.icon;
              const isSelected = selectedProfile === profile.id;
              return (
                <button
                  type="button"
                  key={profile.id}
                  role="radio"
                  aria-checked={isSelected}
                  className={cn(
                    "cursor-pointer rounded-xl border-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                    isSelected
                      ? "border-white bg-white/15 backdrop-blur-sm shadow-lg scale-[1.02]"
                      : "border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-white/20"
                  )}
                  onClick={() => setSelectedProfile(profile.id)}
                >
                  <div className="flex items-start gap-3 p-5">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-white text-[var(--color-brand-deep)]" : "bg-white/10 text-white"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">{profile.title}</h3>
                      <p className="text-sm text-white/60 mb-3">{profile.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.features.map((f) => (
                          <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              className="text-white/50 hover:text-white hover:bg-white/10"
              onClick={handleSkip}
            >
              Passer cette étape
            </Button>
            <Button
              className="bg-white text-[var(--color-brand-deep)] hover:bg-white/90 gap-2"
              disabled={!selectedProfile}
              onClick={handleContinue}
            >
              Continuer
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
