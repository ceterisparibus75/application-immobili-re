"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  EyeOff,
  FileText,
  LucideIcon,
  UserPlus,
  Users,
  X,
} from "lucide-react";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  benefit: string;
  icon: LucideIcon;
  href: string;
  optional?: boolean;
}

type OnboardingStatus = {
  hasActiveSociety: boolean;
  memberCount: number;
  buildingCount: number;
  tenantCount: number;
  leaseCount: number;
  bankAccountCount: number;
};

const steps: OnboardingStep[] = [
  {
    id: "society",
    title: "Créer votre société",
    description: "Définissez le cadre de gestion de votre portefeuille.",
    benefit: "Sans société active, le reste du paramétrage n'a pas de base commune.",
    icon: Building2,
    href: "/societes/nouvelle",
  },
  {
    id: "users",
    title: "Inviter vos collaborateurs",
    description: "Ajoutez les bonnes personnes et clarifiez les responsabilités.",
    benefit: "Vous évitez de centraliser toute la gestion sur un seul compte.",
    icon: UserPlus,
    href: "/compte/utilisateurs",
  },
  {
    id: "building",
    title: "Ajouter un immeuble",
    description: "Commencez par le premier actif à piloter dans l'application.",
    benefit: "C'est le point d'entrée des lots, loyers, charges et documents.",
    icon: Building2,
    href: "/patrimoine/immeubles/nouveau",
  },
  {
    id: "tenant",
    title: "Ajouter un locataire",
    description: "Renseignez au moins un occupant ou preneur actif.",
    benefit: "Vous pourrez ensuite créer un bail et centraliser les pièces utiles.",
    icon: Users,
    href: "/locataires/nouveau",
  },
  {
    id: "lease",
    title: "Créer un bail",
    description: "Associez un locataire à un lot pour ouvrir le suivi locatif.",
    benefit: "Le bail débloque la facturation, les échéances et le suivi documentaire.",
    icon: FileText,
    href: "/baux/nouveau",
  },
  {
    id: "bank",
    title: "Ajouter un compte bancaire",
    description: "Connectez ou créez un compte pour suivre la trésorerie.",
    benefit: "Recommandé pour rapprocher les encaissements et fiabiliser le pilotage.",
    icon: Banknote,
    href: "/banque/nouveau-compte",
    optional: true,
  },
];

export function OnboardingChecklist() {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const activeSocietyId = activeSociety?.id;
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDismissDialog, setShowDismissDialog] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      setLoading(true);
      setDismissed(false);

      try {
        const response = await fetch("/api/onboarding/status", { cache: "no-store" });
        const payload = response.ok
          ? (await response.json()) as { data?: OnboardingStatus }
          : undefined;

        const status = payload?.data ?? {
          hasActiveSociety: Boolean(activeSocietyId),
          memberCount: 0,
          buildingCount: 0,
          tenantCount: 0,
          leaseCount: 0,
          bankAccountCount: 0,
        };

        const completed = new Set<string>();
        if (status.hasActiveSociety) completed.add("society");
        if (status.memberCount > 1) completed.add("users");
        if (status.buildingCount > 0) completed.add("building");
        if (status.tenantCount > 0) completed.add("tenant");
        if (status.leaseCount > 0) completed.add("lease");
        if (status.bankAccountCount > 0) completed.add("bank");
        setCompletedSteps(completed);
      } catch {
        setCompletedSteps(activeSocietyId ? new Set(["society"]) : new Set());
      } finally {
        setLoading(false);
      }
    }

    const dismissedKey = `onboarding-dismissed-${activeSocietyId ?? "global"}`;
    if (typeof window !== "undefined" && localStorage.getItem(dismissedKey)) {
      setDismissed(true);
      setLoading(false);
      return;
    }

    void loadStatus();
  }, [activeSocietyId]);

  function handleTemporaryDismiss() {
    setShowDismissDialog(false);
    setDismissed(true);
  }

  function handlePermanentDismiss() {
    const dismissedKey = `onboarding-dismissed-${activeSocietyId ?? "global"}`;
    localStorage.setItem(dismissedKey, "true");
    setShowDismissDialog(false);
    setDismissed(true);
  }

  if (dismissed || loading) return null;

  const requiredSteps = steps.filter((step) => !step.optional);
  const optionalSteps = steps.filter((step) => step.optional);
  const completedRequiredCount = requiredSteps.filter((step) => completedSteps.has(step.id)).length;
  const completedOptionalCount = optionalSteps.filter((step) => completedSteps.has(step.id)).length;
  const totalRequiredSteps = requiredSteps.length;
  const nextRequiredStep = requiredSteps.find((step) => !completedSteps.has(step.id)) ?? null;
  const nextOptionalStep = optionalSteps.find((step) => !completedSteps.has(step.id)) ?? null;
  const spotlightStep = nextRequiredStep ?? nextOptionalStep;
  const allRequiredDone = completedRequiredCount === totalRequiredSteps;
  const allDone = allRequiredDone && completedOptionalCount === optionalSteps.length;

  if (allDone) return null;

  const progress = Math.round((completedRequiredCount / totalRequiredSteps) * 100);

  function renderStep(step: OnboardingStep, isSpotlight: boolean) {
    const isCompleted = completedSteps.has(step.id);
    const Icon = step.icon;

    const content = (
      <>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            isCompleted
              ? "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]"
              : "bg-primary/10 text-primary"
          }`}
        >
          {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-sm font-medium ${isCompleted ? "text-muted-foreground" : "text-foreground"}`}>
              {step.title}
            </p>
            {step.optional && <Badge variant="outline">Recommandé</Badge>}
            {isSpotlight && !isCompleted && <Badge>À faire maintenant</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{step.description}</p>
          <p className="text-xs text-muted-foreground">{step.benefit}</p>
        </div>
        {isCompleted ? (
          <span className="text-xs font-medium text-[var(--color-status-positive)]">Terminé</span>
        ) : (
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </>
    );

    if (isCompleted) {
      return (
        <div
          key={step.id}
          className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/35 px-4 py-3"
        >
          {content}
        </div>
      );
    }

    return (
      <Link
        key={step.id}
        href={step.href}
        className="flex items-start gap-3 rounded-xl border border-border/60 bg-background px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
      >
        {content}
      </Link>
    );
  }

  return (
    <Card className="mb-6 overflow-hidden border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg text-balance">
              {allRequiredDone ? "Votre espace est prêt" : "Mettez votre espace en ordre de marche"}
            </CardTitle>
            <CardDescription>
              {allRequiredDone
                ? "Les étapes essentielles sont terminées. Il ne reste qu'un réglage recommandé pour piloter la trésorerie au même endroit."
                : `Encore ${totalRequiredSteps - completedRequiredCount} étape${totalRequiredSteps - completedRequiredCount > 1 ? "s" : ""} essentielle${totalRequiredSteps - completedRequiredCount > 1 ? "s" : ""} pour rendre votre espace vraiment exploitable.`}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDismissDialog(true)}
            title="Fermer"
            aria-label="Masquer le guide de démarrage"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{completedRequiredCount}/{totalRequiredSteps} étapes essentielles terminées</span>
          {optionalSteps.length > 0 && (
            <span>
              · {completedOptionalCount}/{optionalSteps.length} recommandée{optionalSteps.length > 1 ? "s" : ""} terminée{optionalSteps.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {spotlightStep && (
          <div className="rounded-2xl border border-primary/20 bg-background/90 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-blue)]">
                  Priorité du moment
                </p>
                <p className="text-sm font-medium text-[var(--color-brand-deep)]">{spotlightStep.title}</p>
                <p className="text-sm text-muted-foreground">{spotlightStep.benefit}</p>
              </div>
              <Button onClick={() => router.push(spotlightStep.href)} className="gap-1.5">
                Ouvrir l'étape
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[var(--color-brand-deep)]">Socle essentiel</p>
            <Badge variant="secondary">Indispensable</Badge>
          </div>
          <div className="space-y-2">
            {requiredSteps.map((step) => renderStep(step, step.id === nextRequiredStep?.id))}
          </div>
        </div>

        {optionalSteps.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[var(--color-brand-deep)]">À faire ensuite</p>
              <Badge variant="outline">Recommandé</Badge>
            </div>
            <div className="space-y-2">
              {optionalSteps.map((step) => renderStep(step, !nextRequiredStep && step.id === nextOptionalStep?.id))}
            </div>
          </div>
        )}

        {allRequiredDone && nextOptionalStep && (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
            Votre parcours principal est terminé. Ajoutez maintenant un compte bancaire si vous voulez suivre la trésorerie, les rapprochements et les mouvements sans sortir de l'application.
          </div>
        )}
      </CardContent>

      <AlertDialog open={showDismissDialog} onOpenChange={setShowDismissDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Masquer le guide de démarrage ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous pouvez le fermer temporairement ou le masquer définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={handleTemporaryDismiss}>
              Fermer pour le moment
            </Button>
            <Button variant="default" onClick={handlePermanentDismiss} className="gap-1.5">
              <EyeOff className="h-4 w-4" />
              Ne plus afficher
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
