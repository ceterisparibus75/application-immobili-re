import { getStatementById } from "@/actions/third-party-statement";
import { getLeaseById } from "@/actions/lease";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Info,
  AlertTriangle,
  XCircle,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { VerificationActions } from "./verification-actions";
import type { TenantEntityType } from "@/generated/prisma/client";

export const metadata = { title: "Detail decompte de gestion" };

/* ─── Labels ──────────────────────────────────────────────────────── */

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  VALIDE: "Valide",
  VERIFIE: "Verifie",
  CONFORME: "Conforme",
  LITIGE: "Litige",
  PAYE: "Paye",
  PARTIELLEMENT_PAYE: "Part. paye",
  REGULARISE: "Regularise",
};

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  BROUILLON: "secondary",
  VALIDE: "default",
  VERIFIE: "default",
  CONFORME: "success",
  LITIGE: "destructive",
  PAYE: "success",
  PARTIELLEMENT_PAYE: "warning",
  REGULARISE: "outline",
};

/* ─── Verification line types ─────────────────────────────────────── */

interface VerificationLine {
  lineType: string;
  label: string;
  amount: number;
  expectedAmount: number | null;
  ecart: number | null;
  verificationStatus: "OK" | "ECART" | "INFO" | "ANOMALIE";
}

interface VerificationResult {
  overallStatus: "CONFORME" | "ECART" | "ANOMALIE";
  lines: VerificationLine[];
  periodMonths: number;
  computedAt: string;
}

interface StatementData {
  id: string;
  type: string;
  status: string;
  thirdPartyName: string;
  periodStart: string | Date;
  periodEnd: string | Date;
  periodLabel: string | null;
  receivedDate: string | Date;
  totalAmount: number;
  netAmount: number | null;
  verificationResult: VerificationResult | null;
  verificationStatus: string | null;
  notes: string | null;
  lines: Array<{
    id: string;
    lineType: string;
    label: string;
    amount: number;
    expectedAmount: number | null;
    verificationStatus: string | null;
  }>;
  lease: {
    id: string;
    leaseNumber: string | null;
    currentRentHT: number;
    managementFeeType: string | null;
    managementFeeValue: number | null;
    managementFeeBasis: string | null;
    managementFeeVatRate: number | null;
    lot: { id: string; number: string };
    tenant: {
      id: string;
      firstName: string | null;
      lastName: string | null;
    };
  } | null;
  contact: {
    id: string;
    name: string;
    company: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function VerificationIcon({ status }: { status: string }) {
  switch (status) {
    case "OK":
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case "INFO":
      return <Info className="h-4 w-4 text-blue-600" />;
    case "ECART":
      return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    case "ANOMALIE":
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return null;
  }
}

function VerificationBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; className: string }
  > = {
    OK: {
      label: "OK",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    INFO: {
      label: "Info",
      className: "bg-blue-50 text-blue-700 border-blue-200",
    },
    ECART: {
      label: "Ecart",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    },
    ANOMALIE: {
      label: "Anomalie",
      className: "bg-red-50 text-red-700 border-red-200",
    },
  };

  const c = config[status];
  if (!c) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${c.className}`}
    >
      <VerificationIcon status={status} />
      {c.label}
    </span>
  );
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default async function DetailDecompteGestionPage({
  params,
}: {
  params: Promise<{ id: string; statementId: string }>;
}) {
  const { id: leaseId, statementId } = await params;
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await requireSocietyAccess(session.user.id, societyId);

  const result = await getStatementById(societyId, statementId);
  if (!result.success || !result.data) notFound();

  const statement = result.data.statement as StatementData;

  // Redirect if wrong lease
  if (statement.lease && statement.lease.id !== leaseId) {
    redirect(`/baux/${statement.lease.id}/releves-gestion/${statementId}`);
  }

  const verification = statement.verificationResult as VerificationResult | null;
  const periodLabel =
    statement.periodLabel ??
    `${new Date(statement.periodStart).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} — ${new Date(statement.periodEnd).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`;

  // Compute totals from lines
  const totalEncaissements = statement.lines
    .filter((l) => l.lineType === "ENCAISSEMENT")
    .reduce((s, l) => s + l.amount, 0);
  const totalHonoraires = statement.lines
    .filter((l) => l.lineType === "HONORAIRES")
    .reduce((s, l) => s + l.amount, 0);
  const totalDeductions = statement.lines
    .filter((l) => l.lineType === "DEDUCTION")
    .reduce((s, l) => s + l.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/baux/${leaseId}/releves-gestion`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {periodLabel}
              </h1>
              <Badge
                variant={STATUS_VARIANTS[statement.status] ?? "outline"}
              >
                {STATUS_LABELS[statement.status] ?? statement.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {statement.thirdPartyName}
              {statement.contact?.company &&
                ` (${statement.contact.company})`}
              {" — "}Recu le {formatDate(statement.receivedDate)}
            </p>
          </div>
        </div>
        <VerificationActions
          societyId={societyId}
          statementId={statementId}
          leaseId={leaseId}
          status={statement.status}
          verificationStatus={statement.verificationStatus}
        />
      </div>

      {/* Overall verification banner */}
      {verification && (
        <VerificationBanner
          overallStatus={verification.overallStatus}
          status={statement.status}
        />
      )}

      {!verification &&
        statement.status !== "BROUILLON" &&
        statement.status !== "VALIDE" && (
          <div className="rounded-lg border border-muted bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              Verification en attente. Utilisez le bouton &laquo; Lancer la
              verification &raquo; pour comparer les montants declares avec les
              donnees du bail.
            </p>
          </div>
        )}

      {/* Summary card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            Synthese du decompte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <p className="text-xs text-muted-foreground">Agence</p>
              <p className="text-sm font-medium">{statement.thirdPartyName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Periode</p>
              <p className="text-sm font-medium">{periodLabel}</p>
              {verification && (
                <p className="text-xs text-muted-foreground">
                  {verification.periodMonths} mois
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total encaisse</p>
              <p className="text-sm font-semibold tabular-nums text-emerald-600">
                {formatCurrency(totalEncaissements)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Honoraires</p>
              <p className="text-sm font-semibold tabular-nums text-amber-600">
                {formatCurrency(totalHonoraires)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net reverse</p>
              <p className="text-lg font-bold tabular-nums">
                {formatCurrency(
                  statement.netAmount ?? totalEncaissements + totalHonoraires + totalDeductions
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification table */}
      {verification ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Detail de la verification
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="pl-5">Poste</TableHead>
                    <TableHead className="text-right">Declare</TableHead>
                    <TableHead className="text-right">Attendu</TableHead>
                    <TableHead className="text-right">Ecart</TableHead>
                    <TableHead className="text-center pr-5">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verification.lines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="pl-5 font-medium">
                        {line.label}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(line.amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {line.expectedAmount != null
                          ? formatCurrency(line.expectedAmount)
                          : "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          line.ecart != null && line.ecart !== 0
                            ? line.ecart > 0
                              ? "text-emerald-600"
                              : "text-red-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {line.ecart != null
                          ? `${line.ecart >= 0 ? "+" : ""}${line.ecart.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} \u20ac`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center pr-5">
                        <VerificationBadge status={line.verificationStatus} />
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Net row */}
                  <TableRow className="bg-muted/20 font-semibold">
                    <TableCell className="pl-5">Net reverse</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(
                        statement.netAmount ??
                          verification.lines.reduce((s, l) => s + l.amount, 0)
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(
                        verification.lines
                          .filter((l) => l.expectedAmount != null)
                          .reduce((s, l) => s + (l.expectedAmount ?? 0), 0)
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {(() => {
                        const declaredNet =
                          statement.netAmount ??
                          verification.lines.reduce(
                            (s, l) => s + l.amount,
                            0
                          );
                        const expectedNet = verification.lines
                          .filter((l) => l.expectedAmount != null)
                          .reduce(
                            (s, l) => s + (l.expectedAmount ?? 0),
                            0
                          );
                        const gap = declaredNet - expectedNet;
                        return (
                          <span
                            className={
                              gap !== 0
                                ? gap > 0
                                  ? "text-emerald-600"
                                  : "text-red-600"
                                : "text-muted-foreground"
                            }
                          >
                            {gap >= 0 ? "+" : ""}
                            {gap.toLocaleString("fr-FR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            &euro;
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-center pr-5">
                      <VerificationBadge
                        status={verification.overallStatus === "CONFORME" ? "OK" : verification.overallStatus === "ECART" ? "ECART" : "ANOMALIE"}
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Statement lines (raw, before verification) */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Lignes du decompte
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="pl-5">Poste</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right pr-5">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statement.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="pl-5 font-medium">
                        {line.label}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px]">
                          {line.lineType === "ENCAISSEMENT"
                            ? "Encaissement"
                            : line.lineType === "HONORAIRES"
                              ? "Honoraires"
                              : "Deduction"}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right pr-5 tabular-nums font-medium ${
                          line.amount >= 0
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {formatCurrency(line.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {statement.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {statement.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Verification Banner ─────────────────────────────────────────── */

function VerificationBanner({
  overallStatus,
  status,
}: {
  overallStatus: string;
  status: string;
}) {
  if (status === "CONFORME") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            Decompte conforme
          </p>
          <p className="text-xs text-emerald-600">
            Tous les montants declares correspondent aux donnees du bail.
          </p>
        </div>
      </div>
    );
  }

  if (status === "LITIGE") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-3">
        <XCircle className="h-5 w-5 text-red-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-800">
            Litige signale
          </p>
          <p className="text-xs text-red-600">
            Ce decompte fait l&apos;objet d&apos;un litige. Contactez l&apos;agence pour
            clarification.
          </p>
        </div>
      </div>
    );
  }

  if (overallStatus === "CONFORME") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            Verification conforme
          </p>
          <p className="text-xs text-emerald-600">
            Tous les montants declares correspondent aux donnees du bail.
            Vous pouvez marquer ce decompte comme conforme.
          </p>
        </div>
      </div>
    );
  }

  if (overallStatus === "ECART") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-800">
            Ecarts detectes
          </p>
          <p className="text-xs text-amber-600">
            Verifiez les lignes en jaune ci-dessous. Les ecarts peuvent
            provenir d&apos;arrondis ou de differences de calcul.
          </p>
        </div>
      </div>
    );
  }

  if (overallStatus === "ANOMALIE") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-3">
        <XCircle className="h-5 w-5 text-red-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-800">
            Anomalies detectees
          </p>
          <p className="text-xs text-red-600">
            Des ecarts significatifs ont ete detectes. Verifiez
            attentivement les lignes en rouge.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
