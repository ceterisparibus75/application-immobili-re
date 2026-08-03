"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Sparkles,
  X,
} from "lucide-react";
import type { OnboardingProgress, OnboardingStep } from "@/actions/onboarding";

interface Props {
  progress: OnboardingProgress;
  societyId: string;
}

const DISMISS_KEY = "mygestia:onboarding:dismissed";

function dismissKey(societyId: string, doneCount: number): string {
  // La clé inclut le nombre d'étapes terminées : si l'utilisateur avance,
  // le dismiss précédent expire automatiquement et la carte réapparaît.
  return `${DISMISS_KEY}:${societyId}:${doneCount}`;
}

export function OnboardingChecklist({ progress, societyId }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const key = dismissKey(societyId, progress.completed);
      setDismissed(window.localStorage.getItem(key) === "1");
    } catch {
      /* ignore — quotas / private mode */
    }
    setHydrated(true);
  }, [societyId, progress.completed]);

  function handleDismiss() {
    try {
      window.localStorage.setItem(dismissKey(societyId, progress.completed), "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  // Ne pas afficher si tout est fait, ou si dismiss local, ou avant hydratation.
  if (!hydrated) return null;
  if (progress.percent === 100) return null;
  if (dismissed) return null;

  const nextRequired = progress.steps.find((s) => !s.done && !s.optional);

  return (
    <Card className="border-0 shadow-brand bg-gradient-to-br from-[var(--color-brand-blue)]/5 via-card to-card rounded-xl">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-blue)]/10">
              <Sparkles className="h-4 w-4 text-[var(--color-brand-blue)]" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">
                Prise en main
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {progress.completed}/{progress.total} étape{progress.total > 1 ? "s" : ""} terminée{progress.completed > 1 ? "s" : ""}
                {nextRequired && (
                  <>
                    {" · "}
                    <span className="text-foreground">
                      Prochaine : <strong>{nextRequired.title}</strong>
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            title="Masquer temporairement (réapparaît à la prochaine étape)"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Barre de progression */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-[var(--color-brand-blue)] transition-all duration-500"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="divide-y">
          {progress.steps.map((step) => (
            <OnboardingRow key={step.key} step={step} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function OnboardingRow({ step }: { step: OnboardingStep }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-start gap-3 min-w-0">
        {step.done ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--color-status-positive)] mt-0.5" />
        ) : (
          <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40 mt-0.5" />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium ${step.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
              {step.title}
            </p>
            {step.optional && (
              <Badge variant="outline" className="text-[10px]">
                Optionnel
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
        </div>
      </div>
      {!step.done && (
        <Link href={step.href} className="shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            {step.ctaLabel}
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      )}
    </li>
  );
}
