"use client";

import { useState, useEffect } from "react";
import { useSociety } from "@/providers/society-provider";
import { getSubscription, createCheckout, openBillingPortal, cancelCurrentSubscription } from "@/actions/subscription";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink, AlertTriangle, Check, Crown, Building2, Users, Layers, ChevronRight, Star, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const PLAN_LABELS: Record<string, string> = {
  STARTER: "Starter",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  TRIALING: { label: "Essai gratuit", color: "text-blue-600 bg-blue-50" },
  ACTIVE: { label: "Actif", color: "text-green-600 bg-green-50" },
  PAST_DUE: { label: "Paiement en retard", color: "text-orange-600 bg-orange-50" },
  CANCELED: { label: "Annulé", color: "text-red-600 bg-red-50" },
  UNPAID: { label: "Impayé", color: "text-red-600 bg-red-50" },
  INCOMPLETE: { label: "Incomplet", color: "text-gray-600 bg-gray-50" },
};

const PLANS_INFO = [
  {
    id: "STARTER" as const,
    name: "Starter",
    description: "Pour les petits patrimoines",
    priceMonthly: 19,
    priceYearly: 190,
    limits: { lots: 20, societies: 1, users: 2 },
    features: [
      "Gestion de patrimoine",
      "Baux et locataires",
      "Facturation et quittances PDF",
      "Tableau de bord analytique",
      "Support par email",
    ],
  },
  {
    id: "PRO" as const,
    name: "Pro",
    description: "Pour les gestionnaires professionnels",
    priceMonthly: 79,
    priceYearly: 790,
    limits: { lots: 50, societies: 3, users: 5 },
    features: [
      "Tout Starter +",
      "Comptabilité complète & export FEC",
      "Connexion bancaire automatique",
      "Relances automatiques",
      "Portail locataire",
      "Support prioritaire",
    ],
    popular: true,
  },
  {
    id: "ENTERPRISE" as const,
    name: "Enterprise",
    description: "Pour les grands portefeuilles",
    priceMonthly: 199,
    priceYearly: 1990,
    limits: { lots: -1, societies: -1, users: -1 },
    features: [
      "Tout Pro +",
      "Lots et sociétés illimités",
      "Signature électronique",
      "Import IA de documents",
      "Accès API",
      "Support dédié & SLA 99,9%",
    ],
  },
];

interface SubscriptionData {
  planId: string;
  status: string;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  features: readonly string[];
  limits: { maxLots: number; maxSocieties: number; maxUsers: number };
  hasStripeCustomer: boolean;
}

export default function AbonnementPage() {
  const { activeSociety } = useSociety();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    if (!activeSociety?.id) return;
    loadSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSociety?.id]);

  async function loadSubscription() {
    if (!activeSociety?.id) return;
    setLoading(true);
    const result = await getSubscription(activeSociety.id);
    if (result.success && result.data) {
      setSubscription(result.data);
    }
    setLoading(false);
  }

  async function handleUpgrade(planId: "STARTER" | "PRO" | "ENTERPRISE") {
    if (!activeSociety?.id) return;
    setActionLoading(true);
    const result = await createCheckout(activeSociety.id, planId, billingPeriod);
    if (result.success && result.data?.url) {
      window.location.href = result.data.url;
    } else {
      toast.error(result.error ?? "Erreur lors de la création du paiement. Vérifiez la configuration Stripe.");
    }
    setActionLoading(false);
  }

  async function handleManageBilling() {
    if (!activeSociety?.id) return;
    setActionLoading(true);
    const result = await openBillingPortal(activeSociety.id);
    if (result.success && result.data?.url) {
      window.location.href = result.data.url;
    } else {
      toast.error(result.error ?? "Erreur lors de l'ouverture du portail de facturation");
    }
    setActionLoading(false);
  }

  async function handleCancel() {
    if (!activeSociety?.id) return;
    if (!confirm("Êtes-vous sûr de vouloir annuler votre abonnement ? Vous conserverez l'accès jusqu'à la fin de la période en cours.")) return;
    setActionLoading(true);
    const result = await cancelCurrentSubscription(activeSociety.id);
    if (result.success) {
      toast.success("Abonnement annulé. Vous conservez l'accès jusqu'à la fin de la période.");
      await loadSubscription();
    } else {
      toast.error(result.error ?? "Erreur lors de l'annulation");
    }
    setActionLoading(false);
  }

  if (loading) {
    return <div className="animate-pulse space-y-4"><div className="h-32 bg-muted rounded-lg" /><div className="h-48 bg-muted rounded-lg" /></div>;
  }

  const currentPlanId = subscription?.planId ?? "STARTER";
  const statusInfo = STATUS_LABELS[subscription?.status ?? "TRIALING"] ?? STATUS_LABELS.INCOMPLETE;
  const isActive = subscription?.status === "ACTIVE";
  const isTrialing = subscription?.status === "TRIALING";
  const isCanceled = subscription?.status === "CANCELED";
  const currentPlanInfo = PLANS_INFO.find((p) => p.id === currentPlanId);
  const hasHigherPlan = currentPlanId !== "ENTERPRISE";

  return (
    <div className="space-y-8">
      {/* Plan actuel */}
      <Card className={isActive ? "border-green-200" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {isActive ? (
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                ) : (
                  <Crown className="h-5 w-5 text-primary" />
                )}
                Plan {PLAN_LABELS[currentPlanId]}
              </CardTitle>
              <CardDescription>
                Société : {activeSociety?.name}
              </CardDescription>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Alertes contextuelles */}
          {isTrialing && subscription?.trialEnd && (
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              Essai gratuit jusqu&apos;au {new Date(subscription.trialEnd).toLocaleDateString("fr-FR")}
            </div>
          )}

          {subscription?.cancelAt && (
            <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              Annulation prévue le {new Date(subscription.cancelAt).toLocaleDateString("fr-FR")}. Vous conservez l&apos;accès jusqu&apos;à cette date.
            </div>
          )}

          {isCanceled && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              Votre abonnement est annulé. Souscrivez un nouveau plan pour continuer à utiliser l&apos;application.
            </div>
          )}

          {isActive && subscription?.currentPeriodEnd && !subscription.cancelAt && (
            <p className="text-sm text-muted-foreground">
              Prochain renouvellement : {new Date(subscription.currentPeriodEnd).toLocaleDateString("fr-FR")}
            </p>
          )}

          {/* Limites du plan */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Layers className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Lots</p>
                <p className="text-sm font-semibold">{subscription?.limits?.maxLots === -1 ? "Illimités" : subscription?.limits?.maxLots ?? 20}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Sociétés</p>
                <p className="text-sm font-semibold">{subscription?.limits?.maxSocieties === -1 ? "Illimitées" : subscription?.limits?.maxSocieties ?? 1}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Utilisateurs</p>
                <p className="text-sm font-semibold">{subscription?.limits?.maxUsers === -1 ? "Illimités" : subscription?.limits?.maxUsers ?? 2}</p>
              </div>
            </div>
          </div>

          {/* Fonctionnalités du plan actuel */}
          {currentPlanInfo && (
            <div className="pt-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">Fonctionnalités incluses</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {currentPlanInfo.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {subscription?.hasStripeCustomer && (
              <Button variant="outline" size="sm" onClick={handleManageBilling} disabled={actionLoading}>
                <CreditCard className="h-4 w-4 mr-2" />
                Gérer la facturation
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            )}
            {isActive && !subscription?.cancelAt && (
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={actionLoading} className="text-destructive hover:text-destructive">
                Annuler l&apos;abonnement
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section upgrade — uniquement si pas Enterprise */}
      {hasHigherPlan && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">
                {isActive ? "Passer au plan supérieur" : "Choisir un plan"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isActive
                  ? "Débloquez plus de fonctionnalités et augmentez vos limites."
                  : isTrialing
                    ? "14 jours d'essai gratuit. Sans engagement, sans carte bancaire."
                    : "Souscrivez un plan pour accéder à toutes les fonctionnalités."
                }
              </p>
            </div>
            {/* Toggle mensuel / annuel */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setBillingPeriod("monthly")}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  billingPeriod === "monthly" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Mensuel
              </button>
              <button
                onClick={() => setBillingPeriod("yearly")}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  billingPeriod === "yearly" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Annuel <span className="text-xs text-primary font-semibold ml-1">-17%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
            {PLANS_INFO.filter((plan) => {
              const planIndex = PLANS_INFO.findIndex((p) => p.id === plan.id);
              const currentIndex = PLANS_INFO.findIndex((p) => p.id === currentPlanId);
              return planIndex > currentIndex;
            }).map((plan) => {
              const price = billingPeriod === "monthly" ? plan.priceMonthly : plan.priceYearly;
              const priceLabel = billingPeriod === "monthly" ? "/mois" : "/an";

              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col transition-all hover:shadow-lg ${
                    plan.popular ? "border-primary shadow-lg ring-1 ring-primary" : "hover:border-primary/20"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
                      <Star className="h-3 w-3" /> Recommandé
                    </div>
                  )}
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="pt-3">
                      <span className="text-4xl font-extrabold">{price}</span>
                      <span className="text-base text-muted-foreground ml-1">&euro;{priceLabel}</span>
                      {billingPeriod === "yearly" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          soit {Math.round(plan.priceYearly / 12)}&euro;/mois
                        </p>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <p className="text-xs font-semibold text-muted-foreground mb-4 pb-4 border-b">
                      {plan.limits.lots === -1 ? "Lots illimités" : `${plan.limits.lots} lots`}
                      {" · "}
                      {plan.limits.societies === -1 ? "Sociétés illimitées" : `${plan.limits.societies} société${plan.limits.societies > 1 ? "s" : ""}`}
                      {" · "}
                      {plan.limits.users === -1 ? "Utilisateurs illimités" : `${plan.limits.users} utilisateur${plan.limits.users > 1 ? "s" : ""}`}
                    </p>

                    <ul className="space-y-2.5 flex-1 mb-6">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className={`w-full ${plan.popular ? "shadow-lg shadow-primary/25" : ""}`}
                      variant={plan.popular ? "default" : "outline"}
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={actionLoading}
                    >
                      Passer au plan {plan.name}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Plan maximum atteint */}
      {!hasHigherPlan && isActive && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Crown className="h-10 w-10 text-primary mx-auto mb-3" />
            <p className="font-medium">Vous êtes sur le plan le plus complet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Votre plan Enterprise vous donne accès à toutes les fonctionnalités sans limite.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
