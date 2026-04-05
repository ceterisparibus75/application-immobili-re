"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSociety } from "@/providers/society-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Users,
  FileText,
  Banknote,
  CheckCircle2,
  Circle,
  ArrowRight,
  X,
} from "lucide-react";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  checkFn: () => Promise<boolean>;
}

export function OnboardingChecklist() {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  const steps: OnboardingStep[] = [
    {
      id: "society",
      title: "Creer votre societe",
      description: "Configurez votre SCI ou societe de gestion",
      icon: <Building2 className="h-5 w-5" />,
      href: "/societes/nouvelle",
      checkFn: async () => !!activeSociety,
    },
    {
      id: "building",
      title: "Ajouter un immeuble",
      description: "Enregistrez votre premier bien immobilier",
      icon: <Building2 className="h-5 w-5" />,
      href: "/patrimoine/immeubles/nouveau",
      checkFn: async () => {
        if (!activeSociety) return false;
        try {
          const res = await fetch(`/api/buildings?limit=1`);
          if (!res.ok) return false;
          const data = await res.json();
          return (data.data?.length ?? 0) > 0;
        } catch { return false; }
      },
    },
    {
      id: "tenant",
      title: "Ajouter un locataire",
      description: "Enregistrez votre premier locataire",
      icon: <Users className="h-5 w-5" />,
      href: "/locataires/nouveau",
      checkFn: async () => {
        if (!activeSociety) return false;
        try {
          const res = await fetch(`/api/tenants/active`);
          if (!res.ok) return false;
          const data = await res.json();
          return (data.data?.length ?? 0) > 0;
        } catch { return false; }
      },
    },
    {
      id: "lease",
      title: "Creer un bail",
      description: "Associez un locataire a un lot",
      icon: <FileText className="h-5 w-5" />,
      href: "/baux/nouveau",
      checkFn: async () => {
        if (!activeSociety) return false;
        try {
          const res = await fetch(`/api/leases?limit=1`);
          if (!res.ok) return false;
          const data = await res.json();
          return (data?.length ?? data.data?.length ?? 0) > 0;
        } catch { return false; }
      },
    },
    {
      id: "bank",
      title: "Connecter une banque",
      description: "Ajoutez votre compte bancaire pour le suivi",
      icon: <Banknote className="h-5 w-5" />,
      href: "/banque/nouveau-compte",
      checkFn: async () => {
        // Optionnel - toujours considere comme non bloquant
        return false;
      },
    },
  ];

  useEffect(() => {
    // Verifier quelles etapes sont completees
    async function checkSteps() {
      setLoading(true);
      const completed = new Set<string>();
      for (const step of steps) {
        try {
          if (await step.checkFn()) {
            completed.add(step.id);
          }
        } catch {
          // Ignorer les erreurs de verification
        }
      }
      setCompletedSteps(completed);
      setLoading(false);
    }

    // Verifier si deja dismiss
    const dismissedKey = `onboarding-dismissed-${activeSociety?.id ?? "global"}`;
    if (typeof window !== "undefined" && localStorage.getItem(dismissedKey)) {
      setDismissed(true);
      setLoading(false);
      return;
    }

    checkSteps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSociety?.id]);

  function handleDismiss() {
    const dismissedKey = `onboarding-dismissed-${activeSociety?.id ?? "global"}`;
    localStorage.setItem(dismissedKey, "true");
    setDismissed(true);
  }

  if (dismissed || loading) return null;

  const completedCount = completedSteps.size;
  const totalSteps = steps.length;
  const allDone = completedCount >= totalSteps - 1; // bank est optionnel

  if (allDone) return null;

  const progress = Math.round((completedCount / totalSteps) * 100);

  return (
    <Card className="mb-6 border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Bienvenue ! Configurez votre espace</CardTitle>
            <CardDescription>
              Completez ces etapes pour commencer a gerer votre patrimoine
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={handleDismiss} title="Fermer">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {completedCount}/{totalSteps} etapes completees
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {steps.map((step) => {
            const isCompleted = completedSteps.has(step.id);
            return (
              <button
                key={step.id}
                onClick={() => !isCompleted && router.push(step.href)}
                disabled={isCompleted}
                className={`w-full flex items-center gap-3 rounded-lg p-3 text-left transition-colors
                  ${isCompleted
                    ? "bg-muted/50 opacity-60"
                    : "hover:bg-accent cursor-pointer"
                  }`}
              >
                <div className={`flex-shrink-0 ${isCompleted ? "text-green-600" : "text-muted-foreground"}`}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-shrink-0 text-primary">{step.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isCompleted ? "line-through" : ""}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {step.description}
                  </p>
                </div>
                {!isCompleted && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
