"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSociety } from "@/providers/society-provider";
import { getSubscription, changeSubscriptionPlan, openBillingPortal, cancelCurrentSubscription, forceSyncSubscription } from "@/actions/subscription";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink, AlertTriangle, Check, Crown, Building2, Users, Layers, ChevronRight, ChevronDown, Star, ShieldCheck, RefreshCw, Loader2, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const PLAN_LABELS: Record<string, string> = {
  STARTER: "Starter",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  TRIALING: { label: "Essai gratuit", color: "text-blue-600 bg-blue-50" },
  ACTIVE: { label: "Actif", color: "text-[var(--color-status-positive)] bg-[var(--color-status-positive-bg)]" },
  PAST_DUE: { label: "Paiement en retard", color: "text-[var(--color-status-caution)] bg-[var(--color-status-caution-bg)]" },
  CANCELED: { label: "Annulé", color: "text-[var(--color-status-negative)] bg-[var(--color-status-negative-bg)]" },
  UNPAID: { label: "Impayé", color: "text-[var(--color-status-negative)] bg-[var(--color-status-negative-bg)]" },
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
  usage: { users: number; lots: number };
}

export default function AbonnementPage() {
  const { activeSociety } = useSociety();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [confirmPlan, setConfirmPlan] = useState<{ id: "STARTER" | "PRO" | "ENTERPRISE"; isUpgrade: boolean } | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!activeSociety?.id) return;
    const isSuccess = new URLSearchParams(window.location.search).get("success") === "true";
    if (isSuccess) {
      // Synchroniser automatiquement depuis Stripe après retour du checkout
      syncAfterCheckout();
    } else {
      loadSubscription();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSociety?.id]);

  async function syncAfterCheckout() {
    if (!activeSociety?.id) return;
    setLoading(true);
    // Stripe webhook peut être légèrement en retard — on tente la sync directe
    const syncResult = await forceSyncSubscription(activeSociety.id);
    if (syncResult.success) {
      toast.success("Abonnement activé avec succès !");
    }
    const result = await getSubscription(activeSociety.id);
    if (result.success && result.data) {
      setSubscription(result.data);
    }
    setLoading(false);
    // Nettoyer l'URL
    router.replace("/compte/abonnement");
  }

  async function loadSubscription() {
    if (!activeSociety?.id) return;
    setLoading(true);
    const result = await getSubscription(activeSociety.id);
    if (result.success && result.data) {
      setSubscription(result.data);
    }
    setLoading(false);
  }

  function handleChangePlan(planId: "STARTER" | "PRO" | "ENTERPRISE") {
    const isUpgrade = (PLAN_ORDER[planId] ?? 0) > (PLAN_ORDER[currentPlanId] ?? 0);
    // Si abonnement Stripe actif → demander confirmation avant d'appeler l'API
    if (subscription?.hasStripeCustomer) {
      setConfirmPlan({ id: planId, isUpgrade });
    } else {
      executeChangePlan(planId);
    }
  }

  async function executeChangePlan(planId: "STARTER" | "PRO" | "ENTERPRISE") {
    if (!activeSociety?.id) return;
    setConfirmPlan(null);
    setActionLoading(true);
    setUpgradeError(null);
    const result = await changeSubscriptionPlan(activeSociety.id, planId, billingPeriod);
    if (result.success) {
      if (result.data?.url) {
        // Checkout ou authentification 3DS requise → redirection Stripe
        window.location.href = result.data.url;
      } else if (result.data?.updated) {
        toast.success("Plan mis à jour avec succès ! Le prorata a été appliqué.");
        await loadSubscription();
      }
    } else {
      const msg = result.error ?? "Erreur lors du changement de plan. Vérifiez la configuration Stripe.";
      setUpgradeError(msg);
      toast.error(msg);
    }
    setActionLoading(false);
  }

  async function handleForceSync() {
    if (!activeSociety?.id) return;
    setActionLoading(true);
    const result = await forceSyncSubscription(activeSociety.id);
    if (result.success) {
      toast.success(`Synchronisé — plan : ${result.data?.planId}, statut : ${result.data?.status}`);
      await loadSubscription();
    } else {
      toast.error(result.error ?? "Erreur lors de la synchronisation");
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
  const hasStripeSubscription = subscription?.hasStripeCustomer ?? false;
  const PLAN_ORDER: Record<string, number> = { STARTER: 0, PRO: 1, ENTERPRISE: 2 };
  // Afficher tous les autres plans si abonnement Stripe actif (upgrade + downgrade)
  // Sinon, afficher seulement les plans supérieurs (première souscription)
  const plansToShow = PLANS_INFO.filter((plan) => {
    if (plan.id === currentPlanId) return false;
    if (!hasStripeSubscription) {
      return PLAN_ORDER[plan.id] > (PLAN_ORDER[currentPlanId] ?? 0);
    }
    return true;
  });
  const showPlanSection = plansToShow.length > 0 || (!hasStripeSubscription && currentPlanId !== "ENTERPRISE");

  const confirmPlanInfo = confirmPlan ? PLANS_INFO.find((p) => p.id === confirmPlan.id) : null;

  return (
    <>
    {/* Modale de confirmation changement de plan */}
    <Dialog open={!!confirmPlan} onOpenChange={(open) => { if (!open) setConfirmPlan(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {confirmPlan?.isUpgrade ? "Confirmer l'upgrade" : "Confirmer le downgrade"}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-sm font-medium">
                <span className="px-2 py-1 rounded bg-muted">{PLAN_LABELS[currentPlanId]}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="px-2 py-1 rounded bg-primary/10 text-primary font-semibold">{confirmPlanInfo?.name}</span>
              </div>
              {confirmPlan?.isUpgrade ? (
                <p className="text-sm text-muted-foreground">
                  Stripe calculera automatiquement le <strong>prorata du mois en cours</strong> et débitera la différence sur votre moyen de paiement enregistré. Si une authentification bancaire (3D Secure) est requise, vous serez redirigé vers Stripe.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Stripe calculera automatiquement un <strong>avoir pour les jours restants</strong> sur votre plan actuel. Ce crédit sera déduit de votre prochaine facture. Le changement prend effet immédiatement.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ⚠️ Si votre utilisation actuelle dépasse les limites du plan {confirmPlanInfo?.name} (utilisateurs, lots), le downgrade sera <strong>refusé</strong>. Réduisez votre utilisation avant de confirmer.
                  </p>
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setConfirmPlan(null)} disabled={actionLoading}>
            Annuler
          </Button>
          <Button
            variant={confirmPlan?.isUpgrade ? "default" : "outline"}
            onClick={() => confirmPlan && executeChangePlan(confirmPlan.id)}
            disabled={actionLoading}
          >
            {actionLoading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : confirmPlan?.isUpgrade ? "Confirmer l'upgrade" : "Confirmer le downgrade"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <div className="space-y-8">
      {/* Plan actuel */}
      <Card className={isActive ? "border-[var(--color-status-positive)]/30" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {isActive ? (
                  <ShieldCheck className="h-5 w-5 text-[var(--color-status-positive)]" />
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
            <div className="flex items-center gap-2 text-sm text-[var(--color-status-caution)] bg-[var(--color-status-caution-bg)] p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              Annulation prévue le {new Date(subscription.cancelAt).toLocaleDateString("fr-FR")}. Vous conservez l&apos;accès jusqu&apos;à cette date.
            </div>
          )}

          {isCanceled && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-status-negative)] bg-[var(--color-status-negative-bg)] p-3 rounded-lg">
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
          <div className="flex gap-3 pt-2 flex-wrap">
            {subscription?.hasStripeCustomer && (
              <Button variant="outline" size="sm" onClick={handleManageBilling} disabled={actionLoading}>
                <CreditCard className="h-4 w-4 mr-2" />
                Gérer la facturation
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            )}
            {subscription?.hasStripeCustomer && (
              <Button variant="outline" size="sm" onClick={handleForceSync} disabled={actionLoading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Synchroniser avec Stripe
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

      {/* Section changement de plan */}
      {showPlanSection && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">
                {hasStripeSubscription ? "Changer de plan" : isActive ? "Passer au plan supérieur" : "Choisir un plan"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {hasStripeSubscription
                  ? "Le changement est immédiat avec prorata. Upgrade : différence débitée aujourd'hui. Downgrade : avoir crédité sur votre prochaine facture."
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plansToShow.map((plan) => {
              const price = billingPeriod === "monthly" ? plan.priceMonthly : plan.priceYearly;
              const priceLabel = billingPeriod === "monthly" ? "/mois" : "/an";
              const isUpgrade = (PLAN_ORDER[plan.id] ?? 0) > (PLAN_ORDER[currentPlanId] ?? 0);
              const isDowngrade = (PLAN_ORDER[plan.id] ?? 0) < (PLAN_ORDER[currentPlanId] ?? 0);
              const currentUsage = subscription?.usage ?? { users: 0, lots: 0 };

              // Vérifier si l'utilisation actuelle dépasse les limites du plan cible
              const downgradeBlockReasons: string[] = [];
              if (isDowngrade) {
                if (plan.limits.users !== -1 && currentUsage.users > plan.limits.users) {
                  downgradeBlockReasons.push(`${currentUsage.users} utilisateurs (limite : ${plan.limits.users})`);
                }
                if (plan.limits.lots !== -1 && currentUsage.lots > plan.limits.lots) {
                  downgradeBlockReasons.push(`${currentUsage.lots} lots (limite : ${plan.limits.lots})`);
                }
              }
              const isDowngradeBlocked = downgradeBlockReasons.length > 0;

              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col transition-all hover:shadow-lg ${
                    isDowngrade
                      ? "border-muted opacity-90 hover:opacity-100"
                      : plan.popular
                        ? "border-primary shadow-lg ring-1 ring-primary"
                        : "hover:border-primary/20"
                  }`}
                >
                  {plan.popular && !isDowngrade && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
                      <Star className="h-3 w-3" /> Recommandé
                    </div>
                  )}
                  {isDowngrade && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-muted text-muted-foreground text-xs font-medium px-3 py-1 rounded-full border">
                      Rétrograder
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
                          <Check className={`h-4 w-4 mt-0.5 shrink-0 ${isDowngrade ? "text-muted-foreground" : "text-primary"}`} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {isDowngradeBlocked && (
                      <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 mb-3 text-xs text-destructive space-y-1">
                        <p className="font-medium flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Rétrogradation impossible
                        </p>
                        <p>Vous devez d&apos;abord réduire votre utilisation :</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          {downgradeBlockReasons.map((r) => <li key={r}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                    {upgradeError && !isDowngradeBlocked && (
                      <p className="text-xs text-destructive mb-3 flex items-start gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        {upgradeError}
                      </p>
                    )}
                    <Button
                      className={`w-full ${isDowngrade ? "" : plan.popular ? "shadow-lg shadow-primary/25" : ""}`}
                      variant={isDowngrade ? "outline" : plan.popular ? "default" : "outline"}
                      onClick={() => handleChangePlan(plan.id)}
                      disabled={actionLoading || isDowngradeBlocked}
                    >
                      {actionLoading
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : isDowngrade
                          ? <><ChevronDown className="h-4 w-4 mr-1" />Rétrograder vers {plan.name}</>
                          : isUpgrade
                            ? <>Passer au plan {plan.name}<ChevronRight className="h-4 w-4 ml-1" /></>
                            : <>Souscrire au plan {plan.name}<ChevronRight className="h-4 w-4 ml-1" /></>
                      }
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Plan maximum atteint sans abonnement Stripe (pas de downgrade possible) */}
      {currentPlanId === "ENTERPRISE" && !hasStripeSubscription && isActive && (
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
    </>
  );
}
