import { getLeaseById } from "@/actions/lease";
import { getManagementReports } from "@/actions/management-report";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CRGUploadForm } from "./crg-upload-form";
import type { TenantEntityType } from "@/generated/prisma/client";

function tenantName(t: {
  entityType: TenantEntityType;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return t.entityType === "PERSONNE_MORALE"
    ? (t.companyName ?? "--")
    : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || "--";
}

export default async function GestionTiersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const lease = await getLeaseById(societyId, id);
  if (!lease) notFound();

  if (!lease.isThirdPartyManaged) {
    redirect(`/baux/${id}`);
  }

  const reportsResult = await getManagementReports(societyId, id);
  const reports =
    reportsResult.success && reportsResult.data
      ? (reportsResult.data.reports as Array<{
          id: string;
          periodStart: string | Date;
          periodEnd: string | Date;
          grossRent: number;
          feeAmountTTC: number;
          netTransfer: number;
          isReconciled: boolean;
          createdAt: string | Date;
        }>)
      : [];

  const displayName = tenantName(lease.tenant);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/baux/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Gestion tiers &mdash; {displayName}
          </h1>
          <p className="text-muted-foreground">
            Comptes rendus de gestion pour ce bail
          </p>
        </div>
      </div>

      {/* Upload section */}
      <CRGUploadForm leaseId={id} />

      {/* Existing reports table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Historique des comptes rendus ({reports.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun compte rendu de gestion pour ce bail.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead className="text-right">Loyer brut</TableHead>
                  <TableHead className="text-right">Honoraires</TableHead>
                  <TableHead className="text-right">Virement net</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => {
                  const periodStart = new Date(report.periodStart);
                  const periodEnd = new Date(report.periodEnd);
                  const periodLabel = `${periodStart.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })} - ${periodEnd.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })}`;

                  return (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{periodLabel}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(report.grossRent)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(report.feeAmountTTC)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(report.netTransfer)}
                      </TableCell>
                      <TableCell>
                        {report.isReconciled ? (
                          <Badge variant="success">Rapproche</Badge>
                        ) : (
                          <Badge variant="outline">En attente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(report.createdAt)}
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
