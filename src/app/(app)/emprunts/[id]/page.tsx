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
} from "lucide-react";
import Link from "next/link";
import { AmortizationTableClient } from "./amortization-table-client";
import { LoanActionsClient } from "./loan-actions-client";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  EN_COURS: { label: "En cours", variant: "default" },
  TERMINE: { label: "Terminé", variant: "secondary" },
  REMBOURSE_ANTICIPE: { label: "Remboursé par anticipation", variant: "outline" },
};

const TYPE_LABELS: Record<string, string> = {
  AMORTISSABLE: "Amortissable",
  IN_FINE: "In fine",
  BULLET: "Bullet",
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

  // Calculs globaux
  const today = new Date();
  const paidLines = loan.amortizationLines.filter((l) => l.isPaid);
  const paidPrincipal = paidLines.reduce((s, l) => s + l.principalPayment, 0);
  // CRD = dernière ligne dont la date d'échéance est passée (calendrier réel)
  const pastLines = loan.amortizationLines.filter((l) => new Date(l.dueDate) <= today);
  const lastPastLine = pastLines[pastLines.length - 1]; // trié asc par period
  const remainingBalance = lastPastLine?.remainingBalance ?? loan.amount;
  const paidInterest = paidLines.reduce((s, l) => s + l.interestPayment, 0);
  const totalInterest = loan.amortizationLines.reduce((s, l) => s + l.interestPayment, 0);
  const totalInsurance = loan.amortizationLines.reduce((s, l) => s + l.insurancePayment, 0);
  const totalCost = loan.amount + totalInterest + totalInsurance;

  // Valeur nette
  const netValue = loan.purchaseValue != null
    ? loan.purchaseValue - remainingBalance
    : null;

  const statusInfo = STATUS_LABELS[loan.status];
  // Progression basée sur le calendrier (CRD) pour cohérence avec le montant affiché
  const calendarPaidPrincipal = loan.amount - remainingBalance;
  const progressPct = loan.amount > 0
    ? Math.min(100, (calendarPaidPrincipal / loan.amount) * 100)
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
        </CardContent>
      </Card>

      {/* Tableau d'amortissement */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Tableau d&apos;amortissement</span>
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
    </div>
  );
}
