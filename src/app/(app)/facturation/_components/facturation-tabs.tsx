"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ArrowRight, FileClock, Mail, Plus, Receipt, Zap } from "lucide-react";
import { InvoicesList } from "./invoices-list";
import { DraftsBanner } from "./drafts-banner";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

function fmt(v: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Invoice = any;

type OverdueInvoice = {
  id: string;
  invoiceNumber: string | null;
  totalTTC: number;
  dueDate: Date;
  payments: { amount: number }[];
  lease: {
    tenant: {
      entityType: string;
      companyName: string | null;
      firstName: string | null;
      lastName: string | null;
    };
  } | null;
};

interface FacturationTabsProps {
  initialTab: FacturationTab;
  invoices: Invoice[];
  brouillons: Invoice[];
  overdueInvoices: OverdueInvoice[];
  societyId: string;
  overdueCount: number;
}

type FacturationTab = "a-traiter" | "brouillons" | "factures" | "relances" | "quittances";

function tabHref(tab: FacturationTab): string {
  return tab === "a-traiter" ? "/facturation" : `/facturation?tab=${tab}`;
}

function FacturationTabLink({
  value,
  active,
  children,
}: {
  value: FacturationTab;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={tabHref(value)}
      scroll={false}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-all",
        active
          ? "bg-background text-foreground shadow"
          : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
      )}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

function QueueCard({
  title,
  count,
  detail,
  href,
  icon,
  tone = "default",
  disabled = false,
}: {
  title: string;
  count: number | string;
  detail: string;
  href: string;
  icon: ReactNode;
  tone?: "default" | "warning" | "danger";
  disabled?: boolean;
}) {
  const toneClass =
    tone === "danger"
      ? "border-[var(--color-status-negative)]/25 bg-[var(--color-status-negative-bg)]/40"
      : tone === "warning"
        ? "border-[var(--color-status-caution)]/25 bg-[var(--color-status-caution-bg)]/40"
        : "border-border/70 bg-card";
  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-md bg-background/80 text-foreground">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xl font-semibold tabular-nums">{count}</span>
        {!disabled && <ArrowRight className="size-4 text-muted-foreground" />}
      </div>
    </div>
  );

  if (disabled) {
    return (
      <div
        className={cn("rounded-lg border p-4 opacity-60", toneClass)}
        aria-disabled="true"
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn("rounded-lg border p-4 transition-colors hover:bg-accent/40", toneClass)}
    >
      {content}
    </Link>
  );
}

export function FacturationTabs({
  initialTab,
  invoices,
  brouillons,
  overdueInvoices,
  societyId,
  overdueCount,
}: FacturationTabsProps) {
  const issuedInvoices = invoices.filter((i) => i.status !== "BROUILLON");
  const quittances = issuedInvoices.filter((i) => i.invoiceType === "QUITTANCE");
  const billingInvoices = issuedInvoices.filter((i) => i.invoiceType !== "QUITTANCE");
  const invoicesToSend = billingInvoices.filter(
    (i) => (i.status === "VALIDEE" || i.status === "EN_ATTENTE") && !i.sentAt
  );
  const overdueTotal = overdueInvoices.reduce(
    (sum, invoice) => sum + invoice.totalTTC - invoice.payments.reduce((paid, payment) => paid + payment.amount, 0),
    0
  );
  const hasWork = brouillons.length > 0 || invoicesToSend.length > 0 || overdueCount > 0;

  return (
    <div>
      <div className="inline-flex h-9 max-w-full items-center justify-start overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground">
        <FacturationTabLink value="a-traiter" active={initialTab === "a-traiter"}>
          À traiter
          {hasWork && (
            <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
              {brouillons.length + invoicesToSend.length + overdueCount}
            </Badge>
          )}
        </FacturationTabLink>
        <FacturationTabLink value="brouillons" active={initialTab === "brouillons"}>
          Brouillons
          {brouillons.length > 0 && (
            <Badge variant="outline" className="h-5 min-w-5 px-1.5 text-[10px]">
              {brouillons.length}
            </Badge>
          )}
        </FacturationTabLink>
        <FacturationTabLink value="factures" active={initialTab === "factures"}>
          Factures
        </FacturationTabLink>
        <FacturationTabLink value="relances" active={initialTab === "relances"}>
          Relances
          {overdueCount > 0 && (
            <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
              {overdueCount}
            </Badge>
          )}
        </FacturationTabLink>
        <FacturationTabLink value="quittances" active={initialTab === "quittances"}>
          Quittances
        </FacturationTabLink>
      </div>

      {/* Onglet À traiter */}
      {initialTab === "a-traiter" && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <QueueCard
              title="Brouillons"
              count={brouillons.length}
              detail="Factures à contrôler puis valider"
              href="/facturation?tab=brouillons"
              icon={<FileClock className="size-4" />}
              tone={brouillons.length > 0 ? "warning" : "default"}
            />
            <QueueCard
              title="À envoyer"
              count={invoicesToSend.length}
              detail="Validées mais pas encore transmises"
              href="/facturation#a-envoyer"
              icon={<Mail className="size-4" />}
              disabled={invoicesToSend.length === 0}
            />
            <QueueCard
              title="Retards"
              count={overdueCount}
              detail={`${fmt(overdueTotal)} restant dû`}
              href="/facturation?tab=relances"
              icon={<AlertTriangle className="size-4" />}
              tone={overdueCount > 0 ? "danger" : "default"}
            />
            <QueueCard
              title="Génération"
              count="Masse"
              detail="Préparer les appels de loyers"
              href="/facturation/generer"
              icon={<Zap className="size-4" />}
            />
          </div>

          {!hasWork ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Receipt className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold">Aucune action en attente</h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Les brouillons, factures à envoyer et retards apparaîtront ici dès qu’une action de masse sera nécessaire.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {brouillons.length > 0 && <DraftsBanner drafts={brouillons} societyId={societyId} />}
              {invoicesToSend.length > 0 && (
                <section id="a-envoyer" className="scroll-mt-24">
                  <InvoicesList
                    invoices={invoicesToSend}
                    title="Factures à envoyer"
                    listTitle="Liste d’envoi"
                    enableBulkSend
                  />
                </section>
              )}
              {overdueCount > 0 && (
                <Card className="border-[var(--color-status-negative)]/25">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="h-4 w-4 text-[var(--color-status-negative)]" />
                      Retards à traiter dans le module relance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      {overdueCount} facture{overdueCount > 1 ? "s" : ""} en retard pour {fmt(overdueTotal)} restant dû.
                    </p>
                    <Button asChild>
                      <Link href="/relances">
                        Ouvrir les relances
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* Onglet Brouillons */}
      {initialTab === "brouillons" && (
        <div className="space-y-6 mt-6">
          {brouillons.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]">
                  <FileClock className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold">Aucun brouillon à valider</h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Générez les appels de loyers en masse pour préparer la file de validation.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button asChild>
                    <Link href="/facturation/generer">
                      <Zap className="h-4 w-4" />
                      Générer les appels
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/facturation/nouvelle">
                      <Plus className="h-4 w-4" />
                      Facture ponctuelle
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <DraftsBanner drafts={brouillons} societyId={societyId} />
          )}
        </div>
      )}

      {/* Onglet Factures */}
      {initialTab === "factures" && (
        <div className="space-y-6 mt-6">
          {billingInvoices.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Receipt className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold">Aucune facture</h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Les factures et avoirs validés apparaîtront ici en consultation.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button asChild>
                    <Link href="/facturation/generer">
                      <Zap className="h-4 w-4" />
                      Générer les appels
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/facturation/nouvelle">
                      <Plus className="h-4 w-4" />
                      Facture ponctuelle
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <InvoicesList
              invoices={billingInvoices}
              title="Registre des factures"
              itemLabel="facture"
              itemLabelPlural="factures"
              enableBulkDownload
            />
          )}
        </div>
      )}

      {/* Onglet Relances */}
      {initialTab === "relances" && (
        <div className="space-y-6 mt-6">
          <Card className="border-[var(--color-status-negative)]/25">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[var(--color-status-negative)]" />
                Factures en retard
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Factures concernées</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{overdueCount}</p>
                </div>
                <div className="rounded-md border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Restant dû</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{fmt(overdueTotal)}</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 rounded-md bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  L’envoi et l’historique des relances sont centralisés dans le module dédié.
                </p>
                <Button asChild>
                  <Link href="/relances">
                    Ouvrir les relances
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Onglet Quittances */}
      {initialTab === "quittances" && (
        <div className="space-y-6 mt-6">
          {quittances.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Receipt className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold">Aucune quittance</h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Les quittances validées apparaîtront ici en consultation.
                </p>
              </CardContent>
            </Card>
          ) : (
            <InvoicesList
              invoices={quittances}
              title="Registre des quittances"
              itemLabel="quittance"
              itemLabelPlural="quittances"
              enableBulkDownload
            />
          )}
        </div>
      )}
    </div>
  );
}
