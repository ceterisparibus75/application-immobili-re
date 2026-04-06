"use client";

import { useState, useEffect } from "react";
import { useSociety } from "@/providers/society-provider";
import { getSubscription, createCheckout, openBillingPortal, cancelCurrentSubscription } from "@/actions/subscription";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink, AlertTriangle, Check, Crown } from "lucide-react";

const PLAN_LABELS: Record<string, string> = {
  STARTER: "Starter",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  TRIALING: { label: "Essai gratuit", color: "text-blue-600 bg-blue-50" },
  ACTIVE: { label: "Actif", color: "text-[var(--color-status-positive)] bg-[var(--color-status-positive-bg)]" },
  PAST_DUE: { label: "Paiement en retard", color: "text-[var(--color-status-caution)] bg-[var(--color-status-caution-bg)]" },
  CANCELED: { label: "Annule", color: "text-[var(--color-status-negative)] bg-[var(--color-status-negative-bg)]" },
  UNPAID: { label: "Impaye", color: "text-[var(--color-status-negative)] bg-[var(--color-status-negative-bg)]" },
  INCOMPLETE: { label: "Incomplet", color: "text-gray-600 bg-gray-50" },
};

interface SubscriptionData {
  planId: string;
  status: string;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  features: readonly string[];
  limits: { maxLots: number; maxSocieties: number; maxUsers: number };
}

export default function BillingPage() {
  const { activeSociety } = useSociety();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

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

  async function handleUpgrade(planId: "STARTER" | "PRO" | "ENTERPRISE", period: "monthly" | "yearly") {
    if (!activeSociety?.id) return;
    setActionLoading(true);
    const result = await createCheckout(activeSociety.id, planId, period);
    if (result.success && result.data?.url) {
      window.location.href = result.data.url;
    }
    setActionLoading(false);
  }

  async function handleManageBilling() {
    if (!activeSociety?.id) return;
    setActionLoading(true);
    const result = await openBillingPortal(activeSociety.id);
    if (result.success && result.data?.url) {
      window.location.href = result.data.url;
    }
    setActionLoading(false);
  }

  async function handleCancel() {
    if (!activeSociety?.id) return;
    if (!confirm("Etes-vous sur de vouloir annuler votre abonnement ? Vous conserverez l'acces jusqu'a la fin de la periode en cours.")) return;
    setActionLoading(true);
    const result = await cancelCurrentSubscription(activeSociety.id);
    if (result.success) {
      await loadSubscription();
    }
    setActionLoading(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Facturation</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-48 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[subscription?.status ?? "TRIALING"] ?? STATUS_LABELS.INCOMPLETE;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Facturation</h1>

      {/* Plan actuel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Plan {PLAN_LABELS[subscription?.planId ?? "STARTER"]}
              </CardTitle>
              <CardDescription>
                {subscription?.limits.maxLots === -1
                  ? "Lots et societes illimites"
                  : `${subscription?.limits.maxLots ?? 10} lots · ${subscription?.limits.maxUsers ?? 2} utilisateurs`
                }
              </CardDescription>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription?.trialEnd && subscription.status === "TRIALING" && (
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              Essai gratuit jusqu&apos;au {new Date(subscription.trialEnd).toLocaleDateString("fr-FR")}
            </div>
          )}

          {subscription?.cancelAt && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-status-caution)] bg-[var(--color-status-caution-bg)] p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              Annulation prevue le {new Date(subscription.cancelAt).toLocaleDateString("fr-FR")}
            </div>
          )}

          {subscription?.currentPeriodEnd && subscription.status === "ACTIVE" && (
            <p className="text-sm text-muted-foreground">
              Prochain renouvellement : {new Date(subscription.currentPeriodEnd).toLocaleDateString("fr-FR")}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageBilling}
              disabled={actionLoading}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Gerer la facturation
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>

            {subscription?.status === "ACTIVE" && !subscription.cancelAt && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={actionLoading}
                className="text-destructive hover:text-destructive"
              >
                Annuler l&apos;abonnement
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fonctionnalites du plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fonctionnalites incluses</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {subscription?.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" />
                {feature}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Upgrade */}
      {subscription?.planId !== "ENTERPRISE" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Passer au plan superieur</CardTitle>
            <CardDescription>
              Debloquez plus de fonctionnalites et augmentez vos limites
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {subscription?.planId === "STARTER" && (
                <>
                  <Button
                    onClick={() => handleUpgrade("PRO", "monthly")}
                    disabled={actionLoading}
                  >
                    Passer au Pro (79&euro;/mois)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleUpgrade("PRO", "yearly")}
                    disabled={actionLoading}
                  >
                    Pro annuel (790&euro;/an)
                  </Button>
                </>
              )}
              {(subscription?.planId === "STARTER" || subscription?.planId === "PRO") && (
                <>
                  <Button
                    variant={subscription?.planId === "PRO" ? "default" : "outline"}
                    onClick={() => handleUpgrade("ENTERPRISE", "monthly")}
                    disabled={actionLoading}
                  >
                    Passer a Enterprise (199&euro;/mois)
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
