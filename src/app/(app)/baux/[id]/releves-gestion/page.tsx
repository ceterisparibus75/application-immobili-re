import { getLeaseById } from "@/actions/lease";
import { getStatements } from "@/actions/third-party-statement";
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
  FileText,
  Plus,
  Receipt,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { TenantEntityType } from "@/generated/prisma/client";

export const metadata = { title: "Decomptes de gestion" };

/* ─── Labels de statut ────────────────────────────────────────────── */

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

const VERIFICATION_LABELS: Record<string, string> = {
  CONFORME: "Conforme",
  ECART: "Ecart",
  ANOMALIE: "Anomalie",
};

const VERIFICATION_VARIANTS: Record<
  string,
  "success" | "warning" | "destructive" | "outline"
> = {
  CONFORME: "success",
  ECART: "warning",
  ANOMALIE: "destructive",
};

const FEE_TYPE_LABELS: Record<string, string> = {
  POURCENTAGE: "Pourcentage",
  FORFAIT: "Forfait",
};

const FEE_BASIS_LABELS: Record<string, string> = {
  LOYER_HT: "Loyer HT",
  LOYER_CHARGES_HT: "Loyer + charges HT",
  TOTAL_TTC: "Total TTC",
};

/* ─── Helpers ─────────────────────────────────────────────────────── */

function tenantName(t: {
  entityType: TenantEntityType;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  return t.entityType === "PERSONNE_MORALE"
    ? (t.companyName ?? "—")
    : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || "—";
}

/* ─── Types ───────────────────────────────────────────────────────── */

interface StatementRow {
  id: string;
  periodStart: string | Date;
  periodEnd: string | Date;
  periodLabel: string | null;
  totalAmount: number;
  netAmount: number | null;
  status: string;
  verificationStatus: string | null;
  receivedDate: string | Date;
  thirdPartyName: string;
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default async function RelevesGestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await requireSocietyAccess(session.user.id, societyId);

  const lease = await getLeaseById(societyId, id);
  if (!lease) notFound();

  const result = await getStatements(societyId, {
    leaseId: id,
    type: "DECOMPTE_GESTION",
  });

  const statements: StatementRow[] =
    result.success && result.data
      ? (result.data.statements as StatementRow[])
      : [];

  const agencyName =
    lease.managingContact?.company ??
    lease.managingContact?.name ??
    (statements.length > 0 ? statements[0].thirdPartyName : null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/baux/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Decomptes de gestion
            </h1>
            <p className="text-muted-foreground">
              {tenantName(lease.tenant)} &mdash;{" "}
              {lease.lot.building.name}, Lot {lease.lot.number}
            </p>
          </div>
        </div>
        <Link href={`/baux/${id}/releves-gestion/nouveau`}>
          <Button>
            <Plus className="h-4 w-4" />
            Nouveau decompte
          </Button>
        </Link>
      </div>

      {/* Info card : agence + parametrage honoraires */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            Agence de gestion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Agence</p>
              <p className="text-sm font-medium">
                {agencyName ?? "Non renseignee"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Type d&apos;honoraires
              </p>
              <p className="text-sm font-medium">
                {lease.managementFeeType
                  ? FEE_TYPE_LABELS[lease.managementFeeType] ?? lease.managementFeeType
                  : "Non configure"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Taux / Montant</p>
              <p className="text-sm font-medium">
                {lease.managementFeeValue != null
                  ? lease.managementFeeType === "POURCENTAGE"
                    ? `${lease.managementFeeValue} %`
                    : `${formatCurrency(lease.managementFeeValue)}`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Base de calcul</p>
              <p className="text-sm font-medium">
                {lease.managementFeeBasis
                  ? FEE_BASIS_LABELS[lease.managementFeeBasis] ?? lease.managementFeeBasis
                  : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table des decomptes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" />
            Historique des decomptes ({statements.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 mb-4">
                <FileText className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-1">
                Aucun decompte de gestion
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-5">
                Saisissez le premier decompte transmis par l&apos;agence pour
                commencer le suivi et la verification automatique.
              </p>
              <Link href={`/baux/${id}/releves-gestion/nouveau`}>
                <Button>
                  <Plus className="h-4 w-4" />
                  Creer un decompte
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead className="text-right">Montant total</TableHead>
                  <TableHead className="text-right">Net reverse</TableHead>
                  <TableHead className="text-center">Statut</TableHead>
                  <TableHead className="text-center">Verification</TableHead>
                  <TableHead>Reception</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.map((stmt) => {
                  const periodLabel =
                    stmt.periodLabel ??
                    `${new Date(stmt.periodStart).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })} — ${new Date(stmt.periodEnd).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })}`;

                  return (
                    <TableRow key={stmt.id} className="group">
                      <TableCell className="font-medium">
                        <Link
                          href={`/baux/${id}/releves-gestion/${stmt.id}`}
                          className="hover:underline"
                        >
                          {periodLabel}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(stmt.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {stmt.netAmount != null
                          ? formatCurrency(stmt.netAmount)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            STATUS_VARIANTS[stmt.status] ?? "outline"
                          }
                          className="text-[11px]"
                        >
                          {STATUS_LABELS[stmt.status] ?? stmt.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {stmt.verificationStatus ? (
                          <Badge
                            variant={
                              VERIFICATION_VARIANTS[stmt.verificationStatus] ??
                              "outline"
                            }
                            className="text-[11px]"
                          >
                            {VERIFICATION_LABELS[stmt.verificationStatus] ??
                              stmt.verificationStatus}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(stmt.receivedDate)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
