import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getLoanById } from "@/actions/loan";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Landmark,
  TrendingDown,
  BarChart3,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Percent,
} from "lucide-react";
import Link from "next/link";
import { AmortizationTableClient } from "./amortization-table-client";
import { LoanActionsClient } from "./loan-actions-client";
import { MovementsClient } from "./movements-client";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  EN_COURS: { label: "En cours", variant: "default" },
  TERMINE: { label: "Terminé", variant: "secondary" },
  REMBOURSE_ANTICIPE: { label: "Remboursé par anticipation", variant: "outline" },
};

const TYPE_LABELS: Record<string, string> = {
  AMORTISSABLE: "Amortissable",
  IN_FINE: "In fine",
  BULLET: "Bullet",
  OBLIGATION: "Obligation",
  COMPTE_COURANT: "Compte courant",
};

const COUPON_FREQ_LABELS: Record<string, string> = {
  MENSUEL: "Mensuel",
  TRIMESTRIEL: "Trimestriel",
  SEMESTRIEL: "Semestriel",
  ANNUEL: "Annuel",
};

const MOVEMENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  APPORT: { label: "Apport", color: "text-[var(--color-status-positive)]" },
  RETRAIT: { label: "Retrait", color: "text-destructive" },
  INTERETS: { label: "Intérêts", color: "text-blue-600 dark:text-blue-400" },
};

export default async function EmpruntDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const h = await headers();
  const societyId = h.get("x-society-id");
  if (!societyId) return notFound();

  const loan = await getLoanById(societyId, id);
  if (!loan) return notFound();

  const fmt = (v: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v);

  const isCC = loan.loanType === "COMPTE_COURANT";
  const isObligation = loan.loanType === "OBLIGATION";

  // Calculs globaux
  const today = new Date();
  const paidLines = loan.amortizationLines.filter((l) => l.isPaid);
  const paidPrincipal = paidLines.reduce((s, l) => s + l.principalPayment, 0);
  // CRD = dernière ligne dont la date d'échéance est passée (calendrier réel)
  const pastLines = loan.amortizationLines.filter((l) => new Date(l.dueDate) <= today);
  const lastPastLine = pastLines[pastLines.length - 1]; // trié asc par period
  const remainingBalance = isCC ? (loan.currentBalance ?? 0) : (lastPastLine?.remainingBalance ?? loan.amount);
  const totalInterest = loan.amortizationLines.reduce((s, l) => s + l.interestPayment, 0);
  const totalInsurance = loan.amortizationLines.reduce((s, l) => s + l.insurancePayment, 0);
  const totalCost = loan.amount + totalInterest + totalInsurance;

  // Mouvements (compte courant)
  const movements = loan.movements ?? [];
  const totalApports = movements.filter((m) => m.type === "APPORT").reduce((s, m) => s + m.amount, 0);
  const totalRetraits = movements.filter((m) => m.type === "RETRAIT").reduce((s, m) => s + m.amount, 0);
  const totalInterets = movements.filter((m) => m.type === "INTERETS").reduce((s, m) => s + m.amount, 0);

  // Valeur nette
  const netValue = loan.purchaseValue != null
    ? loan.purchaseValue - remainingBalance
    : null;

  const statusInfo = STATUS_LABELS[loan.status];
  // Progression basée sur le calendrier (CRD) pour cohérence avec le montant affiché
  const calendarPaidPrincipal = loan.amount - remainingBalance;
  const progressPct = loan.amount > 0
    ? Math.min(100, Math.max(0, (calendarPaidPrincipal / loan.amount) * 100))
    : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <Link href="/emprunts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{loan.label}</h1>
          <p className="text-muted-foreground">{loan.lender}</p>
        </div>
        <Badge variant={statusInfo?.variant ?? "outline"}>{statusInfo?.label ?? loan.status}</Badge>
        <Badge variant="secondary">{TYPE_LABELS[loan.loanType] ?? loan.loanType}</Badge>
        <LoanActionsClient loanId={loan.id} societyId={societyId} loanLabel={loan.label} />
      </div>

      {/* Résumé */}
      {isCC ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Solde courant</p>
              </div>
              <p className="text-xl font-bold">{fmt(remainingBalance)}</p>
              <p className="text-xs text-muted-foreground">{movements.length} mouvement{movements.length !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpCircle className="h-4 w-4 text-[var(--color-status-positive)]" />
                <p className="text-xs text-muted-foreground">Total apports</p>
              </div>
              <p className="text-xl font-bold text-[var(--color-status-positive)]">{fmt(totalApports)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownCircle className="h-4 w-4 text-destructive" />
                <p className="text-xs text-muted-foreground">Total retraits</p>
              </div>
              <p className="text-xl font-bold text-destructive">{fmt(totalRetraits)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Percent className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <p className="text-xs text-muted-foreground">Intérêts comptabilisés</p>
              </div>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{fmt(totalInterets)}</p>
              <p className="text-xs text-muted-foreground">Taux : {loan.interestRate}%</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Landmark className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Capital emprunté</p>
              </div>
              <p className="text-xl font-bold">{fmt(loan.amount)}</p>
              <p className="text-xs text-muted-foreground">{loan.interestRate}% · {loan.durationMonths} mois</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <p className="text-xs text-muted-foreground">Capital restant dû</p>
              </div>
              <p className="text-xl font-bold text-destructive">{fmt(remainingBalance)}</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{Math.round(progressPct)}% remboursé</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Coût total du crédit</p>
              </div>
              <p className="text-xl font-bold">{fmt(totalCost)}</p>
              <p className="text-xs text-muted-foreground">
                dont {fmt(totalInterest)} d&apos;intérêts
                {totalInsurance > 0 && ` + ${fmt(totalInsurance)} assurance`}
              </p>
            </CardContent>
          </Card>
          {netValue !== null ? (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-[var(--color-status-positive)]" />
                  <p className="text-xs text-muted-foreground">Valeur nette du bien</p>
                </div>
                <p className={`text-xl font-bold ${netValue >= 0 ? "text-[var(--color-status-positive)]" : "text-destructive"}`}>
                  {fmt(netValue)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Achat {fmt(loan.purchaseValue!)} − dette {fmt(remainingBalance)}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Échéances payées</p>
                </div>
                <p className="text-xl font-bold">{paidLines.length} / {loan.amortizationLines.length}</p>
                <p className="text-xs text-muted-foreground">
                  Capital remboursé : {fmt(paidPrincipal)}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Informations */}
      <Card>
        <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Établissement</dt>
              <dd className="text-sm font-medium">{loan.lender}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Type de prêt</dt>
              <dd className="text-sm font-medium">{TYPE_LABELS[loan.loanType]}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Taux nominal annuel</dt>
              <dd className="text-sm font-medium">{loan.interestRate} %</dd>
            </div>
            {loan.insuranceRate > 0 && (
              <div>
                <dt className="text-xs text-muted-foreground">Taux assurance annuel</dt>
                <dd className="text-sm font-medium">{loan.insuranceRate} %</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-muted-foreground">Date de début</dt>
              <dd className="text-sm font-medium">
                {new Date(loan.startDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Date de fin prévue</dt>
              <dd className="text-sm font-medium">
                {new Date(loan.endDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </dd>
            </div>
            {loan.building && (
              <div>
                <dt className="text-xs text-muted-foreground">Bien immobilier</dt>
                <dd className="text-sm font-medium">
                  <Link href={`/patrimoine/immeubles/${loan.building.id}`} className="underline hover:no-underline">
                    {loan.building.name} — {loan.building.city}
                  </Link>
                </dd>
              </div>
            )}
            {loan.purchaseValue && (
              <div>
                <dt className="text-xs text-muted-foreground">Valeur d&apos;acquisition</dt>
                <dd className="text-sm font-medium">{fmt(loan.purchaseValue)}</dd>
              </div>
            )}
            {loan.notes && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs text-muted-foreground">Notes</dt>
                <dd className="text-sm whitespace-pre-wrap mt-1">{loan.notes}</dd>
              </div>
            )}
          </dl>

          {/* Informations spécifiques Obligation */}
          {isObligation && (loan.nominalValue || loan.bondCount || loan.couponFrequency) && (
            <>
              <div className="border-t my-4" />
              <h4 className="text-sm font-semibold mb-3">Paramètres de l&apos;émission</h4>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {loan.nominalValue && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Valeur nominale</dt>
                    <dd className="text-sm font-medium">{fmt(loan.nominalValue)}</dd>
                  </div>
                )}
                {loan.bondCount && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Nombre d&apos;obligations</dt>
                    <dd className="text-sm font-medium">{loan.bondCount.toLocaleString("fr-FR")}</dd>
                  </div>
                )}
                {loan.couponFrequency && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Fréquence des coupons</dt>
                    <dd className="text-sm font-medium">{COUPON_FREQ_LABELS[loan.couponFrequency] ?? loan.couponFrequency}</dd>
                  </div>
                )}
                {loan.issuePrice && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Prix d&apos;émission</dt>
                    <dd className="text-sm font-medium">{fmt(loan.issuePrice)}</dd>
                  </div>
                )}
              </dl>
            </>
          )}

          {/* Informations spécifiques Compte courant */}
          {isCC && (
            <>
              <div className="border-t my-4" />
              <h4 className="text-sm font-semibold mb-3">Paramètres du compte courant</h4>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {loan.partnerName && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Associé</dt>
                    <dd className="text-sm font-medium">{loan.partnerName}</dd>
                  </div>
                )}
                {loan.partnerShare != null && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Part au capital</dt>
                    <dd className="text-sm font-medium">{loan.partnerShare} %</dd>
                  </div>
                )}
                {loan.maxAmount != null && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Plafond</dt>
                    <dd className="text-sm font-medium">{fmt(loan.maxAmount)}</dd>
                  </div>
                )}
                {loan.conventionDate && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Date de convention</dt>
                    <dd className="text-sm font-medium">
                      {new Date(loan.conventionDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    </dd>
                  </div>
                )}
              </dl>
            </>
          )}
        </CardContent>
      </Card>

      {/* Mouvements (Compte courant) */}
      {isCC && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Historique des mouvements</span>
              <span className="text-sm font-normal text-muted-foreground">
                {movements.length} mouvement{movements.length !== 1 ? "s" : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MovementsClient
              movements={movements.map((m) => ({
                ...m,
                date: m.date.toISOString(),
                createdAt: m.createdAt.toISOString(),
              }))}
              loanId={loan.id}
              societyId={societyId}
              interestRate={loan.interestRate}
              currentBalance={remainingBalance}
              maxAmount={loan.maxAmount}
            />
          </CardContent>
        </Card>
      )}

      {/* Tableau d'amortissement (emprunts classiques + obligations) */}
      {!isCC && loan.amortizationLines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{isObligation ? "Échéancier des coupons" : "Tableau d\u0027amortissement"}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {paidLines.length} / {loan.amortizationLines.length} échéances réglées
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AmortizationTableClient
              lines={loan.amortizationLines}
              societyId={societyId}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
