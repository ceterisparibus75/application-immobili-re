import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ArrowRight, Inbox, Sparkles, CheckCircle2 } from "lucide-react";
import { getSupplierInboxConfig } from "@/actions/supplier-inbox";
import { prisma } from "@/lib/prisma";
import { isEInvoicingConfigured } from "@/lib/pa-client";
import { env } from "@/lib/env";
import { isChorusProConfigured } from "@/lib/chorus-pro-client";
import { InboxConfigForm } from "./_components/inbox-config-form";
import { PPFActivationCard } from "./_components/ppf-activation-card";
import { ChorusProCard } from "./_components/chorus-pro-card";

export const metadata = { title: "Paramètres de facturation" };

export default async function ParametresFacturationPage() {
  const h = await headers();
  const societyId = h.get("x-society-id");
  if (!societyId) redirect("/societes");

  const [config, society] = await Promise.all([
    getSupplierInboxConfig(societyId),
    prisma.society.findFirst({
      where: { id: societyId },
      select: { ppfRegisteredAt: true, siret: true, paOAuthAccessToken: true },
    }),
  ]);

  const steps = [
    {
      icon: Mail,
      title: "Configurez l'email",
      description: "Activez la réception automatique pour obtenir votre adresse dédiée.",
    },
    {
      icon: Inbox,
      title: "Fournisseur envoie la facture",
      description: "Votre fournisseur envoie la facture PDF par email à votre adresse dédiée.",
    },
    {
      icon: Sparkles,
      title: "Extraction automatique",
      description: "L'IA analyse le PDF et extrait fournisseur, montant, date et numéro.",
    },
    {
      icon: CheckCircle2,
      title: "Validez dans l'application",
      description: "Vérifiez les données, associez à un immeuble et validez pour créer la charge.",
    },
  ];

  return (
    <div className="space-y-8 max-w-2xl">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-brand-deep)]">
          Paramètres de facturation
        </h1>
        <p className="text-muted-foreground mt-1">
          Configurez la réception automatique des factures fournisseurs par email.
        </p>
      </div>

      {/* Chorus Pro — Facturation B2G (secteur public) */}
      <ChorusProCard isConfigured={isChorusProConfigured()} />

      {/* PA B2B — Réforme facturation électronique sept. 2026 */}
      <PPFActivationCard
        societyId={societyId}
        ppfRegisteredAt={society?.ppfRegisteredAt ?? null}
        hasSiret={!!society?.siret}
        isConfigured={isEInvoicingConfigured()}
        isMandataireMode={!!env.PA_MANDATAIRE_SIRET}
        paConnected={!!society?.paOAuthAccessToken}
        oauthConfigured={!!env.PA_OAUTH_AUTHORIZE_URL}
      />

      {/* Formulaire de configuration inbox */}
      <InboxConfigForm societyId={societyId} initialConfig={config} />

      {/* Explication du fonctionnement */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Comment ça marche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={index} className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[var(--color-brand-deep)] font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex items-start gap-3 flex-1 pt-0.5">
                    <Icon className="h-5 w-5 shrink-0 text-[var(--color-brand-blue)] mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-[var(--color-brand-deep)]">
                        {step.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {step.description}
                      </p>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 hidden sm:block" />
                  )}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
