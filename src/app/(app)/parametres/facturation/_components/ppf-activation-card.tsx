"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap, CheckCircle2, AlertCircle, Loader2, RefreshCw, Clock, Building2, ShieldCheck, Info,
} from "lucide-react";
import { registerSocietyInPPF, syncReceivedInvoices } from "@/actions/einvoicing";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface Props {
  societyId: string;
  ppfRegisteredAt: Date | null;
  hasSiret: boolean;
  isConfigured: boolean; // PA_API_BASE_URL + credentials présents
  isMandataireMode: boolean; // PA_MANDATAIRE_SIRET configuré (Model B)
}

export function PPFActivationCard({ societyId, ppfRegisteredAt, hasSiret, isConfigured, isMandataireMode }: Props) {
  const [registeredAt, setRegisteredAt] = useState<Date | null>(ppfRegisteredAt);
  const [activating, startActivate] = useTransition();
  const [syncing, startSync] = useTransition();

  function handleActivate() {
    startActivate(async () => {
      const result = await registerSocietyInPPF(societyId);
      if (result.success) {
        setRegisteredAt(new Date());
        toast.success(
          isMandataireMode
            ? "Société déclarée auprès de la PA. Elle est couverte par le contrat SC MyGestia."
            : "Société inscrite à l'Annuaire PPF. Vous pouvez désormais recevoir des factures électroniques."
        );
      } else {
        toast.error(result.error ?? "Erreur lors de l'inscription");
      }
    });
  }

  function handleSync() {
    startSync(async () => {
      const result = await syncReceivedInvoices(societyId);
      if (result.success && result.data) {
        const { created, updated } = result.data;
        if (created === 0 && updated === 0) {
          toast.info("Aucune nouvelle facture électronique.");
        } else {
          toast.success(`Synchronisation : ${created} nouvelle(s), ${updated} mise(s) à jour.`);
        }
      } else {
        toast.error(result.error ?? "Erreur lors de la synchronisation");
      }
    });
  }

  const isRegistered = !!registeredAt;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-[var(--color-brand-blue)]" />
              Facturation électronique B2B (Réforme sept. 2026)
            </CardTitle>
            <CardDescription>
              {isMandataireMode
                ? "MyGestia est une Solution Compatible (SC) certifiée DGFiP — mandataire de transmission pour toutes vos sociétés."
                : "Recevez et émettez des factures au format Factur-X / UBL via l'Annuaire PPF."}
            </CardDescription>
          </div>
          {isRegistered ? (
            <Badge className="shrink-0 gap-1 bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)] border-[var(--color-status-positive)]/20 hover:bg-[var(--color-status-positive-bg)]">
              <CheckCircle2 className="h-3 w-3" />
              {isMandataireMode ? "Déclarée" : "Inscrite"}
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-muted-foreground">
              {isMandataireMode ? "Non déclarée" : "Non inscrite"}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isConfigured && (
          <div className="flex items-start gap-2 rounded-lg bg-[var(--color-status-caution-bg)] border border-[var(--color-status-caution)]/30 p-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--color-status-caution)]" />
            <p className="text-sm text-[var(--color-status-caution)]">
              La facturation électronique n&apos;est pas encore configurée sur ce serveur.
              Renseignez{" "}
              <code className="font-mono text-xs">PA_API_BASE_URL</code> et les credentials PA
              dans votre configuration.
            </p>
          </div>
        )}

        {/* Bandeau informatif — Mode SC mandataire */}
        {isMandataireMode && (
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 p-3 dark:bg-blue-950 dark:border-blue-800">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Mode Solution Compatible (SC) — Mandataire centralisé
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                MyGestia détient un contrat unique avec votre Plateforme Agréée qui couvre l&apos;ensemble
                de vos sociétés clientes. Aucune démarche contractuelle n&apos;est nécessaire
                pour chaque société — il suffit de la déclarer ci-dessous.
              </p>
            </div>
          </div>
        )}

        {isRegistered ? (
          <>
            <div className="rounded-lg bg-muted/40 border border-border/60 p-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  {isMandataireMode ? "Déclarée auprès de la PA" : "Annuaire PPF"}
                </span>
                <span className="text-xs font-medium text-[var(--color-status-positive)]">
                  {isMandataireMode ? "Active" : "Inscrite"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Date d&apos;activation
                </span>
                <span className="text-xs text-[var(--color-brand-deep)]">
                  {formatDate(registeredAt!)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncing || !isConfigured}
                className="gap-1.5"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Synchroniser maintenant
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Synchronisation automatique toutes les heures via le cron.
            </p>
          </>
        ) : (
          <>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[var(--color-status-positive)]" />
                Réception automatique des factures fournisseurs depuis l&apos;Annuaire PPF
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[var(--color-status-positive)]" />
                Émission de factures clients au format Factur-X directement depuis MyGestia
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[var(--color-status-positive)]" />
                Conformité obligatoire dès septembre 2026 — inclus dans votre abonnement
              </li>
              {isMandataireMode && (
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[var(--color-status-positive)]" />
                  Aucun contrat PA à signer par société — couvert par le mandat MyGestia
                </li>
              )}
            </ul>

            {!hasSiret && (
              <div className="flex items-start gap-2 rounded-lg bg-[var(--color-status-caution-bg)] border border-[var(--color-status-caution)]/30 p-3">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--color-status-caution)]" />
                <p className="text-sm text-[var(--color-status-caution)]">
                  Le SIRET de la société est requis pour{" "}
                  {isMandataireMode ? "la déclaration auprès de la PA" : "l'inscription à l'Annuaire PPF"}.
                </p>
              </div>
            )}

            {isMandataireMode && hasSiret && (
              <div className="flex items-start gap-2 rounded-lg bg-muted/40 border border-border/60 p-3">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  En cliquant sur &quot;Déclarer à la PA&quot;, MyGestia enregistre le SIRET de cette
                  société auprès de la Plateforme Agréée comme entreprise gérée sous mandat.
                  La société peut alors émettre et recevoir des factures électroniques.
                </p>
              </div>
            )}

            <Button
              onClick={handleActivate}
              disabled={activating || !hasSiret || !isConfigured}
              className="gap-1.5"
            >
              {activating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {isMandataireMode ? "Déclarer à la PA" : "Inscrire à l'Annuaire PPF"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
