"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle2, AlertTriangle, Loader2, ExternalLink, Trash2 } from "lucide-react";
import {
  startStripeConnectOAuth,
  disconnectStripeConnect,
  type StripeConnectOverview,
} from "@/actions/tenant-payment";

interface Props {
  societyId: string;
  initial: StripeConnectOverview;
}

const STATUS_META: Record<
  StripeConnectOverview["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; description: string }
> = {
  not_configured: {
    label: "Non disponible",
    variant: "outline",
    description: "Le service Stripe Connect n'est pas configuré côté serveur. Contactez le support.",
  },
  not_connected: {
    label: "Non connecté",
    variant: "outline",
    description: "Vous ne proposez pas encore le paiement en ligne à vos locataires.",
  },
  pending: {
    label: "Configuration Stripe à finaliser",
    variant: "secondary",
    description:
      "Compte connecté mais Stripe attend des informations complémentaires (KYC, IBAN). Terminez le paramétrage depuis votre dashboard Stripe.",
  },
  active: {
    label: "Actif",
    variant: "default",
    description: "Vos locataires peuvent payer par carte. Les fonds arrivent directement sur votre compte Stripe.",
  },
  disabled: {
    label: "Désactivé",
    variant: "destructive",
    description: "Stripe a suspendu les paiements sur ce compte. Vérifiez les notifications dans votre dashboard.",
  },
};

export function StripeConnectCard({ societyId, initial }: Props) {
  const [overview, setOverview] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const meta = STATUS_META[overview.status];
  const isActive = overview.status === "active";
  const isConnected = Boolean(overview.accountId);

  function handleConnect() {
    startTransition(async () => {
      const res = await startStripeConnectOAuth(societyId);
      if (res.success && res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast.error(res.error ?? "Erreur");
      }
    });
  }

  function handleDisconnect() {
    if (
      !confirm(
        "Déconnecter Stripe ? Vos locataires ne pourront plus payer en ligne tant qu'un compte n'est pas reconnecté."
      )
    )
      return;
    startTransition(async () => {
      const res = await disconnectStripeConnect(societyId);
      if (res.success) {
        toast.success("Compte Stripe déconnecté");
        setOverview({
          ...overview,
          status: "not_connected",
          accountId: null,
          connectedAt: null,
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
        });
      } else {
        toast.error(res.error ?? "Erreur");
      }
    });
  }

  // Tant que Stripe Connect n'est pas configuré côté serveur
  // (STRIPE_CONNECT_CLIENT_ID + STRIPE_CONNECT_WEBHOOK_SECRET absents), on
  // n'affiche RIEN — pas de "Non disponible" qui pourrait dérouter les
  // utilisateurs pendant que la plateforme est en attente de validation Stripe.
  if (!overview.serviceConfigured) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              Paiement en ligne locataire
            </CardTitle>
            <CardDescription className="mt-1">
              Vos locataires peuvent payer leurs factures par carte via un lien Stripe. Les fonds arrivent
              <strong> directement sur votre compte Stripe</strong> — MyGestia n&apos;est que facilitateur.
            </CardDescription>
          </div>
          <Badge variant={meta.variant} className="shrink-0 gap-1">
            {isActive ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : overview.status === "disabled" ? (
              <AlertTriangle className="h-3 w-3" />
            ) : null}
            {meta.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{meta.description}</p>

        {isConnected && (
          <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Compte Stripe</span>
              <code className="font-mono text-[11px]">{overview.accountId}</code>
            </div>
            {overview.connectedAt && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Connecté le</span>
                <span>{new Date(overview.connectedAt).toLocaleDateString("fr-FR")}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Paiements par carte</span>
              <span className={overview.chargesEnabled ? "text-emerald-700" : "text-amber-700"}>
                {overview.chargesEnabled ? "Activés" : "En attente"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Versements bancaires</span>
              <span className={overview.payoutsEnabled ? "text-emerald-700" : "text-amber-700"}>
                {overview.payoutsEnabled ? "Activés" : "En attente"}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!isConnected ? (
            <Button onClick={handleConnect} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Connecter mon compte Stripe
            </Button>
          ) : (
            <>
              <Button asChild variant="outline" size="sm">
                <a href="https://dashboard.stripe.com/" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Ouvrir mon dashboard Stripe
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={isPending}
                className="ml-auto text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Déconnecter
              </Button>
            </>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed border-t pt-3">
          <strong>Sécurité et conformité :</strong> Stripe encaisse les paiements et vous les reverse selon
          votre calendrier Stripe. MyGestia ne détient jamais les fonds. Vous êtes le seul responsable de vos
          obligations fiscales et déclaratives sur ces encaissements.
        </p>
      </CardContent>
    </Card>
  );
}
