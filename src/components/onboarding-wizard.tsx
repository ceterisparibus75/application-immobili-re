"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSociety } from "@/providers/society-provider";
import { Button } from "@/components/ui/button";
import { ProgressSteps } from "@/components/ui/progress-steps";
import {
  Building2,
  Home,
  Users,
  FileText,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Play,
  X,
  CheckCircle2,
  Rocket,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WizardStep {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  tips: string[];
  href: string;
  videoPlaceholder?: string;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: "society",
    title: "Créez votre société",
    subtitle: "Étape 1 sur 5",
    description:
      "Chaque patrimoine est géré au sein d'une société (SCI, SARL, nom propre…). C'est le socle de toute votre gestion : baux, factures et comptabilité s'y rattachent.",
    icon: Building2,
    tips: [
      "Renseignez la raison sociale et le SIRET",
      "Ajoutez l'adresse du siège social",
      "Vous pourrez ajouter d'autres sociétés plus tard",
    ],
    href: "/societes/nouvelle",
    videoPlaceholder: "Créer une société en 30 secondes",
  },
  {
    id: "building",
    title: "Ajoutez votre premier immeuble",
    subtitle: "Étape 2 sur 5",
    description:
      "Un immeuble regroupe vos lots (appartements, bureaux, commerces). Vous pourrez y rattacher des diagnostics, des maintenances et des documents.",
    icon: Home,
    tips: [
      "Indiquez l'adresse complète de l'immeuble",
      "Précisez le nombre d'étages et le type (résidentiel, commercial, mixte)",
      "Ajoutez une photo de façade pour l'identifier facilement",
    ],
    href: "/patrimoine/immeubles/nouveau",
    videoPlaceholder: "Ajouter un immeuble en 30 secondes",
  },
  {
    id: "lot",
    title: "Créez un lot",
    subtitle: "Étape 3 sur 5",
    description:
      "Le lot est l'unité locative : un appartement, un bureau, un parking… Chaque lot a sa surface, son loyer de référence et ses charges.",
    icon: Building2,
    tips: [
      "Donnez un libellé clair (ex : « Apt 3B — T2 — 2e étage »)",
      "Renseignez la surface et le loyer hors charges",
      "Le lot sera disponible pour y créer un bail",
    ],
    href: "/patrimoine",
    videoPlaceholder: "Créer un lot en 30 secondes",
  },
  {
    id: "tenant",
    title: "Ajoutez un locataire",
    subtitle: "Étape 4 sur 5",
    description:
      "Renseignez les coordonnées du locataire : nom, email, téléphone. Vous pourrez ensuite lui associer un bail et lui envoyer ses factures.",
    icon: Users,
    tips: [
      "L'email est utilisé pour les relances et le portail locataire",
      "Ajoutez un garant si nécessaire",
      "Les pièces d'identité peuvent être importées plus tard",
    ],
    href: "/locataires/nouveau",
    videoPlaceholder: "Ajouter un locataire en 30 secondes",
  },
  {
    id: "lease",
    title: "Configurez le bail",
    subtitle: "Étape 5 sur 5",
    description:
      "Le bail associe un locataire à un lot. Il définit les dates, le loyer, les charges et l'indice de révision. C'est lui qui déclenche la facturation automatique.",
    icon: FileText,
    tips: [
      "Sélectionnez le lot et le locataire créés aux étapes précédentes",
      "Indiquez les dates de début et de fin du bail",
      "Choisissez l'indice de révision (IRL, ILC, ILAT…)",
      "La facturation se déclenchera automatiquement",
    ],
    href: "/baux/nouveau",
    videoPlaceholder: "Créer un bail en 30 secondes",
  },
];

const PROGRESS_LABELS = WIZARD_STEPS.map((s) => ({ label: s.title.split(" ").slice(0, 2).join(" ") }));

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function OnboardingWizard() {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    const key = `onboarding-wizard-seen-${activeSociety?.id ?? "global"}`;
    return !localStorage.getItem(key);
  });

  const dismiss = useCallback(() => {
    const key = `onboarding-wizard-seen-${activeSociety?.id ?? "global"}`;
    localStorage.setItem(key, "true");
    setVisible(false);
  }, [activeSociety?.id]);

  const goToStep = useCallback((href: string) => {
    router.push(href);
    dismiss();
  }, [router, dismiss]);

  const loadDemoData = useCallback(async () => {
    try {
      await fetch("/api/onboarding/demo", { method: "POST" });
      dismiss();
      router.push("/dashboard");
      router.refresh();
    } catch {
      // silently fail
    }
  }, [dismiss, router]);

  if (!visible) return null;

  const step = WIZARD_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === WIZARD_STEPS.length - 1;
  const Icon = step.icon;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm" />

      {/* Wizard modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-2xl border border-border/40 bg-card shadow-2xl animate-fade-in-scale overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-2">
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">
                Bienvenue sur MyGestia
              </h2>
            </div>
            <Button variant="ghost" size="icon" onClick={dismiss} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress */}
          <div className="flex justify-center px-6 py-4">
            <ProgressSteps steps={PROGRESS_LABELS} currentStep={currentStep} />
          </div>

          {/* Step content */}
          <div className="px-6 pb-4 animate-slide-up" key={step.id}>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {step.subtitle}
                </p>
                <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>

            {/* Tips */}
            <div className="mt-5 space-y-2 rounded-xl bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                Conseils
              </p>
              {step.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary/60" />
                  <span className="text-sm text-muted-foreground">{tip}</span>
                </div>
              ))}
            </div>

            {/* Video placeholder */}
            {step.videoPlaceholder && (
              <button
                className="mt-4 flex w-full items-center gap-3 rounded-xl border border-dashed border-border/50 bg-background p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                onClick={() => goToStep(step.href)}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Play className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{step.videoPlaceholder}</p>
                  <p className="text-xs text-muted-foreground">Cliquez pour commencer cette étape</p>
                </div>
              </button>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between border-t border-border/30 px-6 py-4 bg-muted/20">
            <div className="flex items-center gap-2">
              {isFirst && (
                <Button variant="outline" size="sm" onClick={loadDemoData} className="gap-1.5 text-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  Charger les données démo
                </Button>
              )}
              {!isFirst && (
                <Button variant="ghost" size="sm" onClick={() => setCurrentStep((s) => s - 1)} className="gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Précédent
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={dismiss} className="text-xs text-muted-foreground">
                Passer le guide
              </Button>
              {isLast ? (
                <Button size="sm" onClick={() => goToStep(step.href)} className="gap-1.5">
                  Commencer
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" onClick={() => setCurrentStep((s) => s + 1)} className="gap-1.5">
                  Suivant
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
