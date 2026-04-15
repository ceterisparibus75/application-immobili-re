import { getTenantById, getTenantAccountStatement } from "@/actions/tenant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  User,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  LogIn,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { TenantContactsSection } from "./contacts-section";
import { TenantAccount } from "./tenant-account";
import { DeleteTenantButton } from "./delete-tenant-button";
import { InviteTenantButton } from "./invite-tenant-button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { LeaseStatus, RiskIndicator, TenantEntityType } from "@/generated/prisma/client";
import { TenantPaymentChart, type PaymentMonthData } from "./_components/tenant-payment-chart";

// ── Mappings ────────────────────────────────────────────────────────────────

const RISK_LABELS: Record<RiskIndicator, string> = {
  VERT: "Fiable",
  ORANGE: "À surveiller",
  ROUGE: "Risque élevé",
};

const RISK_COLORS: Record<RiskIndicator, { bg: string; text: string; border: string }> = {
  VERT: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800" },
  ORANGE: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" },
  ROUGE: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-800" },
};

const LEASE_STATUS_LABELS: Record<LeaseStatus, string> = {
  EN_COURS: "En cours",
  RESILIE: "Résilié",
  RENOUVELE: "Renouvelé",
  EN_NEGOCIATION: "En négociation",
  CONTENTIEUX: "Contentieux",
};

const LEASE_STATUS_VARIANTS: Record<LeaseStatus, "success" | "secondary" | "warning" | "destructive" | "default"> = {
  EN_COURS: "success",
  RESILIE: "secondary",
  RENOUVELE: "default",
  EN_NEGOCIATION: "warning",
  CONTENTIEUX: "destructive",
};

function tenantDisplayName(tenant: {
  entityType: TenantEntityType;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return tenant.entityType === "PERSONNE_MORALE"
    ? (tenant.companyName ?? "—")
    : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "—";
}

function tenantInitials(tenant: {
  entityType: TenantEntityType;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  if (tenant.entityType === "PERSONNE_MORALE") {
    return (tenant.companyName ?? "?").slice(0, 2).toUpperCase();
  }
  const f = (tenant.firstName ?? "?")[0];
  const l = (tenant.lastName ?? "?")[0];
  return `${f}${l}`.toUpperCase();
}

function fmtCurrency(v: number): string {
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("fr-FR");
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function LocataireDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const [tenant, accountData] = await Promise.all([
    getTenantById(societyId, id),
    getTenantAccountStatement(societyId, id),
  ]);
  if (!tenant) notFound();

  const activeLease = tenant.leases.find((l) => l.status === "EN_COURS");
  const name = tenantDisplayName(tenant);
  const initials = tenantInitials(tenant);
  const risk = RISK_COLORS[tenant.riskIndicator];
  const balance = accountData?.balance ?? 0;

  // KPIs
  const totalFacture = accountData?.invoices
    .filter((i) => i.status !== "ANNULEE" && i.invoiceType !== "AVOIR")
    .reduce((s, i) => s + i.totalTTC, 0) ?? 0;
  const totalPaye = accountData?.invoices
    .filter((i) => i.status !== "ANNULEE")
    .reduce((s, i) => s + i.payments.reduce((ps, p) => ps + p.amount, 0), 0) ?? 0;
  const unpaidCount = accountData?.invoices.filter(
    (i) => i.status !== "ANNULEE" && i.status !== "PAYE" && i.invoiceType !== "AVOIR" && i.invoiceType !== "QUITTANCE"
  ).length ?? 0;

  // Historique mensuel des paiements (12 derniers mois)
  const MONTH_LABELS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const now = new Date();
  const paymentHistory: PaymentMonthData[] = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const facture = (accountData?.invoices ?? [])
      .filter((inv) =>
        inv.status !== "ANNULEE" &&
        inv.invoiceType !== "AVOIR" &&
        new Date(inv.issueDate).getFullYear() === year &&
        new Date(inv.issueDate).getMonth() === month
      )
      .reduce((s, inv) => s + inv.totalTTC, 0);
    const paye = (accountData?.invoices ?? [])
      .flatMap((inv) => inv.payments)
      .filter((p) =>
        new Date(p.paidAt).getFullYear() === year &&
        new Date(p.paidAt).getMonth() === month
      )
      .reduce((s, p) => s + p.amount, 0);
    return { month: MONTH_LABELS[month], facture, paye };
  });

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link href="/locataires">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Avatar */}
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold select-none ${
            tenant.entityType === "PERSONNE_MORALE"
              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
              : "bg-primary/10 text-primary"
          }`}>
            {initials}
          </div>
          {/* Nom + meta */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight truncate">{name}</h1>
              {!tenant.isActive && <Badge variant="secondary">Inactif</Badge>}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-sm text-muted-foreground">
                {tenant.entityType === "PERSONNE_MORALE" ? "Personne morale" : "Personne physique"}
              </span>
              {/* Indicateur risque */}
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${risk.bg} ${risk.text} ${risk.border}`}>
                {tenant.riskIndicator === "VERT" && <CheckCircle2 className="h-3 w-3" />}
                {tenant.riskIndicator === "ORANGE" && <AlertTriangle className="h-3 w-3" />}
                {tenant.riskIndicator === "ROUGE" && <AlertTriangle className="h-3 w-3" />}
                {RISK_LABELS[tenant.riskIndicator]}
              </span>
            </div>
          </div>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <InviteTenantButton tenantId={id} />
          <Link href={`/locataires/${id}/modifier`}>
            <Button variant="outline" className="gap-1.5">
              <Pencil className="h-4 w-4" />
              Modifier
            </Button>
          </Link>
          <DeleteTenantButton tenantId={id} />
        </div>
      </div>

      {/* ── KPIs rapides ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Solde */}
        <div className={`rounded-xl p-4 border ${
          balance > 0
            ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20"
            : balance < 0
              ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20"
              : "border-border bg-card"
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <Wallet className={`h-4 w-4 ${balance > 0 ? "text-red-600" : balance < 0 ? "text-emerald-600" : "text-muted-foreground"}`} />
            <p className="text-xs text-muted-foreground">Solde du compte</p>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${
            balance > 0 ? "text-red-700 dark:text-red-400" : balance < 0 ? "text-emerald-700 dark:text-emerald-400" : ""
          }`}>
            {balance > 0 ? "+" : ""}{fmtCurrency(balance)} €
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {balance > 0 ? "Le locataire doit cette somme" : balance < 0 ? "Trop-perçu / crédit" : "Compte soldé"}
          </p>
        </div>

        {/* Loyer actuel */}
        <div className="rounded-xl p-4 border border-border bg-card">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Loyer mensuel</p>
          </div>
          <p className="text-2xl font-bold tabular-nums">
            {activeLease ? `${fmtCurrency(activeLease.currentRentHT)} €` : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {activeLease ? "HT / mois" : "Aucun bail actif"}
          </p>
        </div>

        {/* Total facturé */}
        <div className="rounded-xl p-4 border border-border bg-card">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Total facturé</p>
          </div>
          <p className="text-2xl font-bold tabular-nums">
            {fmtCurrency(totalFacture)} €
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            dont {fmtCurrency(totalPaye)} € réglés
          </p>
        </div>

        {/* Factures impayées */}
        <div className={`rounded-xl p-4 border ${
          unpaidCount > 0
            ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20"
            : "border-border bg-card"
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className={`h-4 w-4 ${unpaidCount > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
            <p className="text-xs text-muted-foreground">Factures en cours</p>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${unpaidCount > 0 ? "text-amber-700 dark:text-amber-400" : ""}`}>
            {unpaidCount}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {unpaidCount > 0 ? "non soldées" : "Tout est réglé"}
          </p>
        </div>
      </div>

      {/* ── Bail actif (bandeau) ───────────────────────────────────── */}
      {activeLease ? (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <FileText className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  Bail actif — {activeLease.lot.building.name}, Lot {activeLease.lot.number}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Depuis le {fmtDate(activeLease.startDate)}
                  {" · "}
                  {fmtCurrency(activeLease.currentRentHT)} € HT/mois
                  {" · "}
                  Fin prévue : {fmtDate(activeLease.endDate)}
                </p>
              </div>
            </div>
            <Link href={`/baux/${activeLease.id}`}>
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900">
                <ExternalLink className="h-3.5 w-3.5" />
                Voir le bail
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        tenant.isActive && (
          <div className="rounded-xl border border-dashed border-muted-foreground/30 p-5 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              Aucun bail actif pour ce locataire
            </p>
            <Link href={`/baux/nouveau?tenantId=${id}`}>
              <Button size="sm" variant="outline">Créer un bail</Button>
            </Link>
          </div>
        )
      )}

      {/* ── Historique des paiements ───────────────────────────────── */}
      <TenantPaymentChart data={paymentHistory} />

      {/* ── Layout 2 colonnes : infos + contact ────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne principale — 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Compte locataire */}
          {accountData && (
            <TenantAccount
              tenantId={tenant.id}
              societyId={societyId}
              invoices={accountData.invoices.map((inv) => ({
                ...inv,
                issueDate: inv.issueDate.toISOString(),
                dueDate: inv.dueDate.toISOString(),
                periodStart: inv.periodStart?.toISOString() ?? null,
                periodEnd: inv.periodEnd?.toISOString() ?? null,
                payments: inv.payments.map((p) => ({
                  ...p,
                  paidAt: p.paidAt.toISOString(),
                })),
              }))}
              balance={accountData.balance}
              tenantName={name}
            />
          )}

          {/* Historique des baux */}
          {tenant.leases.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Historique des baux ({tenant._count.leases})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {tenant.leases.map((lease) => (
                    <Link
                      key={lease.id}
                      href={`/baux/${lease.id}`}
                      className="flex items-center justify-between py-3 px-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          lease.status === "EN_COURS"
                            ? "bg-emerald-100 dark:bg-emerald-900"
                            : "bg-muted"
                        }`}>
                          <FileText className={`h-4 w-4 ${
                            lease.status === "EN_COURS" ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
                          }`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {lease.lot.building.name} — Lot {lease.lot.number}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Depuis le {fmtDate(lease.startDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-mono tabular-nums text-muted-foreground">
                          {fmtCurrency(lease.currentRentHT)} € HT
                        </span>
                        <Badge variant={LEASE_STATUS_VARIANTS[lease.status]}>
                          {LEASE_STATUS_LABELS[lease.status]}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contacts secondaires */}
          <TenantContactsSection
            tenantId={tenant.id}
            contacts={tenant.secondaryContacts}
          />
        </div>

        {/* Colonne latérale — 1/3 */}
        <div className="space-y-6">
          {/* Coordonnées */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Coordonnées
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tenant.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Email principal</p>
                    <a href={`mailto:${tenant.email}`} className="text-sm text-primary hover:underline break-all">
                      {tenant.email}
                    </a>
                  </div>
                </div>
              )}
              {tenant.billingEmail && tenant.billingEmail !== tenant.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Email facturation</p>
                    <a href={`mailto:${tenant.billingEmail}`} className="text-sm text-primary hover:underline break-all">
                      {tenant.billingEmail}
                    </a>
                  </div>
                </div>
              )}
              {tenant.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Téléphone</p>
                    <a href={`tel:${tenant.phone}`} className="text-sm hover:underline">{tenant.phone}</a>
                  </div>
                </div>
              )}
              {tenant.mobile && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Mobile</p>
                    <a href={`tel:${tenant.mobile}`} className="text-sm hover:underline">{tenant.mobile}</a>
                  </div>
                </div>
              )}
              {!tenant.email && !tenant.phone && !tenant.mobile && (
                <p className="text-sm text-muted-foreground text-center py-2">Aucune coordonnée</p>
              )}
            </CardContent>
          </Card>

          {/* Identité / Société */}
          {tenant.entityType === "PERSONNE_MORALE" ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Société
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoBlock label="Raison sociale" value={tenant.companyName} />
                <InfoBlock label="Forme juridique" value={tenant.companyLegalForm} />
                <InfoBlock label="SIRET" value={tenant.siret} mono />
                <InfoBlock label="Code APE" value={tenant.codeAPE} mono />
                {tenant.shareCapital && (
                  <InfoBlock label="Capital social" value={`${tenant.shareCapital.toLocaleString("fr-FR")} €`} />
                )}
                {tenant.companyAddress && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Adresse siège</p>
                      <p className="text-sm">{tenant.companyAddress}</p>
                    </div>
                  </div>
                )}
                {(tenant.legalRepName || tenant.legalRepEmail) && (
                  <>
                    <div className="border-t pt-3 mt-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Représentant légal</p>
                      <InfoBlock label="Nom" value={tenant.legalRepName} />
                      <InfoBlock label="Qualité" value={tenant.legalRepTitle} />
                      {tenant.legalRepEmail && (
                        <div className="mt-2">
                          <a href={`mailto:${tenant.legalRepEmail}`} className="text-xs text-primary hover:underline">
                            {tenant.legalRepEmail}
                          </a>
                        </div>
                      )}
                      {tenant.legalRepPhone && (
                        <div className="mt-1">
                          <a href={`tel:${tenant.legalRepPhone}`} className="text-xs text-muted-foreground hover:underline">
                            {tenant.legalRepPhone}
                          </a>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Identité
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoBlock label="Nom" value={tenant.lastName} />
                <InfoBlock label="Prénom" value={tenant.firstName} />
                {tenant.birthDate && (
                  <InfoBlock label="Date de naissance" value={fmtDate(tenant.birthDate)} />
                )}
                {tenant.birthPlace && (
                  <InfoBlock label="Lieu de naissance" value={tenant.birthPlace} />
                )}
                {tenant.personalAddress && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Adresse personnelle</p>
                      <p className="text-sm">{tenant.personalAddress}</p>
                    </div>
                  </div>
                )}
                {tenant.autoEntrepreneurSiret && (
                  <div className="border-t pt-3 mt-3">
                    <InfoBlock label="SIRET auto-entrepreneur" value={tenant.autoEntrepreneurSiret} mono />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Portail locataire */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <LogIn className="h-4 w-4 text-muted-foreground" />
                Portail locataire
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tenant.portalAccess ? (
                <>
                  <div className="flex items-center gap-2">
                    {tenant.portalAccess.isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                        <ShieldCheck className="h-3 w-3" />
                        Accès actif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                        <ShieldOff className="h-3 w-3" />
                        Accès désactivé
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Invitation envoyée le</p>
                        <p className="font-medium">{fmtDate(tenant.portalAccess.invitedAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <LogIn className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Dernière connexion</p>
                        {tenant.portalAccess.lastLoginAt ? (
                          <p className="font-medium">
                            {new Date(tenant.portalAccess.lastLoginAt).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        ) : (
                          <p className="text-muted-foreground italic">Jamais connecté</p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                    <ShieldOff className="h-3 w-3" />
                    Non invité
                  </span>
                  <p className="text-xs text-muted-foreground">Le locataire n&apos;a pas encore accès au portail.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {tenant.notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tenant.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Composant utilitaire ─────────────────────────────────────────────────────

function InfoBlock({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
