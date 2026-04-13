import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { requireSocietyAccess } from "@/lib/permissions";
import { getStatementById } from "@/actions/third-party-statement";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, FileText, Building2, CheckCircle, AlertTriangle, Info, XCircle } from "lucide-react";
import { StatementDetailActions } from "./_components/statement-detail-actions";

interface Props {
  params: Promise<{ statementId: string }>;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  BROUILLON: { label: "Brouillon", variant: "secondary", icon: FileText },
  VALIDE: { label: "Validé", variant: "default", icon: CheckCircle },
  VERIFIE: { label: "Vérifié", variant: "outline", icon: Info },
  CONFORME: { label: "Conforme", variant: "default", icon: CheckCircle },
  LITIGE: { label: "Litige", variant: "destructive", icon: AlertTriangle },
};

const LINE_STATUS_ICON: Record<string, { icon: typeof CheckCircle; color: string }> = {
  OK: { icon: CheckCircle, color: "text-emerald-500" },
  ECART: { icon: AlertTriangle, color: "text-amber-500" },
  ANOMALIE: { icon: XCircle, color: "text-red-500" },
  INFO: { icon: Info, color: "text-blue-400" },
};

export default async function DecompteGestionDetailPage({ params }: Props) {
  const { statementId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/societes");

  await requireSocietyAccess(session.user.id, societyId);

  const result = await getStatementById(societyId, statementId);
  if (!result.success || !result.data) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = result.data.statement as any;

  // Baux concernés
  const allLeases = s.leases?.length > 0
    ? s.leases.map((sl: { lease: unknown }) => sl.lease)
    : s.lease ? [s.lease] : [];

  const statusCfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.BROUILLON;
  const StatusIcon = statusCfg.icon;

  // Vérification par bail
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const verificationResult = s.verificationResult as any;
  const byLease = verificationResult?.byLease ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/releves-gestion"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <FileText className="h-5 w-5 text-[var(--color-brand-blue)]" />
              {s.thirdPartyName}
            </h1>
            <Badge variant={statusCfg.variant} className="gap-1">
              <StatusIcon className="h-3 w-3" />
              {statusCfg.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {s.periodLabel ?? `${formatDate(s.periodStart)} — ${formatDate(s.periodEnd)}`}
            {s.reference && <span className="ml-2">• Réf. {s.reference}</span>}
          </p>
        </div>
      </div>

      {/* Infos générales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total décompte</p>
            <p className="text-xl font-bold">{formatCurrency(s.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Net reversé</p>
            <p className="text-xl font-bold">{s.netAmount ? formatCurrency(s.netAmount) : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Baux concernés</p>
            <p className="text-xl font-bold">{allLeases.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Reçu le</p>
            <p className="text-xl font-bold">{formatDate(s.receivedDate)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Baux concernés */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Baux concernés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {allLeases.map((lease: any) => {
              const tenantName = lease.tenant?.companyName || `${lease.tenant?.firstName} ${lease.tenant?.lastName}`;
              const leaseVerification = byLease.find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (v: any) => v.leaseId === lease.id
              );

              return (
                <div key={lease.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{tenantName}</span>
                      {lease.leaseNumber && (
                        <Badge variant="outline" className="text-[10px]">
                          Bail {lease.leaseNumber}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {lease.lot?.building?.name && `${lease.lot.building.name} — `}
                      Lot {lease.lot?.number}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {leaseVerification && (
                      <Badge
                        variant={
                          leaseVerification.status === "CONFORME" ? "default" :
                          leaseVerification.status === "ANOMALIE" ? "destructive" : "outline"
                        }
                      >
                        {leaseVerification.status}
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/baux/${lease.id}/releves-gestion/${statementId}`}>
                        Voir le bail
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Lignes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail des lignes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {allLeases.length > 1 && <TableHead>Bail</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Déclaré</TableHead>
                  <TableHead className="text-right">Attendu</TableHead>
                  <TableHead className="text-right">Écart</TableHead>
                  <TableHead className="text-center">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {s.lines.map((line: any) => {
                  const lineStatus = LINE_STATUS_ICON[line.verificationStatus ?? "INFO"] ?? LINE_STATUS_ICON.INFO;
                  const LineIcon = lineStatus.icon;
                  const ecart = line.expectedAmount != null
                    ? Math.round((line.amount - line.expectedAmount) * 100) / 100
                    : null;

                  return (
                    <TableRow key={line.id}>
                      {allLeases.length > 1 && (
                        <TableCell className="text-xs">
                          {line.lease
                            ? `${line.lease.tenant?.firstName} ${line.lease.tenant?.lastName} (${line.lease.lot?.number})`
                            : <span className="text-muted-foreground italic">Non affecté</span>
                          }
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {line.lineType === "ENCAISSEMENT" ? "Encaissement" :
                           line.lineType === "HONORAIRES" ? "Honoraires" :
                           line.lineType === "DEDUCTION" ? "Déduction" : line.lineType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{line.label}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(line.amount)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {line.expectedAmount != null ? formatCurrency(line.expectedAmount) : "—"}
                      </TableCell>
                      <TableCell className={`text-right text-sm font-medium ${
                        ecart === null ? "" :
                        ecart === 0 ? "text-emerald-600" :
                        Math.abs(ecart) < 1 ? "text-emerald-600" :
                        "text-amber-600"
                      }`}>
                        {ecart != null ? `${ecart >= 0 ? "+" : ""}${formatCurrency(ecart)}` : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <LineIcon className={`h-4 w-4 mx-auto ${lineStatus.color}`} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Rapprochement bancaire */}
      {s.bankReconciliations?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rapprochement bancaire</CardTitle>
          </CardHeader>
          <CardContent>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {s.bankReconciliations.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">{r.transaction?.label ?? "Transaction bancaire"}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.transaction?.transactionDate && formatDate(r.transaction.transactionDate)}
                    {r.transaction?.reference && ` • Réf. ${r.transaction.reference}`}
                  </p>
                </div>
                <p className="font-medium">{r.transaction?.amount ? formatCurrency(Math.abs(r.transaction.amount)) : "—"}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {s.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{s.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <StatementDetailActions statementId={statementId} status={s.status} type={s.type} />
    </div>
  );
}
