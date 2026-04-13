import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { requireSocietyAccess } from "@/lib/permissions";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { StatementStatus } from "@/generated/prisma/client";
import { StatementActions } from "./_components/statement-actions";

const TYPE_LABELS: Record<string, string> = {
  APPEL_FONDS: "Appel de fonds",
  DECOMPTE_CHARGES: "Decompte annuel",
};

const STATUS_LABELS: Record<StatementStatus, string> = {
  BROUILLON: "Brouillon",
  VALIDE: "Valide",
  PAYE: "Paye",
  PARTIELLEMENT_PAYE: "Partiellement paye",
  REGULARISE: "Regularise",
  VERIFIE: "Verifie",
  CONFORME: "Conforme",
  LITIGE: "Litige",
};

const STATUS_VARIANTS: Record<
  StatementStatus,
  "secondary" | "default" | "success" | "warning" | "destructive" | "outline"
> = {
  BROUILLON: "secondary",
  VALIDE: "default",
  PAYE: "success",
  PARTIELLEMENT_PAYE: "warning",
  REGULARISE: "outline",
  VERIFIE: "default",
  CONFORME: "success",
  LITIGE: "destructive",
};

const NATURE_LABELS: Record<string, string> = {
  RECUPERABLE: "Recuperable",
  PROPRIETAIRE: "Non recuperable",
  MIXTE: "Mixte",
};

const NATURE_VARIANTS: Record<string, "success" | "secondary" | "warning"> = {
  RECUPERABLE: "success",
  PROPRIETAIRE: "secondary",
  MIXTE: "warning",
};

export default async function StatementDetailPage({
  params,
}: {
  params: Promise<{ id: string; statementId: string }>;
}) {
  const { id, statementId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/");

  await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

  const statement = await prisma.thirdPartyStatement.findFirst({
    where: { id: statementId, societyId, buildingId: id },
    include: {
      lines: true,
      building: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true, company: true, email: true, phone: true } },
    },
  });

  if (!statement) notFound();

  const resteDu = statement.totalAmount - statement.paidAmount;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/patrimoine/immeubles"
          className="hover:text-foreground transition-colors"
        >
          Immeubles
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link
          href={`/patrimoine/immeubles/${id}`}
          className="hover:text-foreground transition-colors"
        >
          {statement.building?.name ?? "Immeuble"}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link
          href={`/patrimoine/immeubles/${id}/releves-tiers`}
          className="hover:text-foreground transition-colors"
        >
          Releves syndic
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium truncate">
          {statement.reference ?? TYPE_LABELS[statement.type] ?? "Detail"}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/patrimoine/immeubles/${id}/releves-tiers`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Receipt className="h-6 w-6 text-[var(--color-brand-blue)]" />
                {statement.reference
                  ? `${TYPE_LABELS[statement.type]} - ${statement.reference}`
                  : TYPE_LABELS[statement.type] ?? statement.type}
              </h1>
              <Badge
                variant={STATUS_VARIANTS[statement.status]}
                className="text-xs"
              >
                {STATUS_LABELS[statement.status] ?? statement.status}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-0.5">
              {statement.periodLabel ??
                `${formatDate(statement.periodStart)} - ${formatDate(statement.periodEnd)}`}
            </p>
          </div>
        </div>

        {/* Actions dynamiques */}
        <StatementActions
          statementId={statement.id}
          buildingId={id}
          type={statement.type}
          status={statement.status}
          totalAmount={statement.totalAmount}
          paidAmount={statement.paidAmount}
        />
      </div>

      {/* Resume */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Type" value={TYPE_LABELS[statement.type] ?? statement.type} />
            <InfoRow label="Syndic" value={statement.thirdPartyName} />
            {statement.contact && (
              <InfoRow
                label="Contact"
                value={`${statement.contact.name}${statement.contact.company ? ` (${statement.contact.company})` : ""}`}
              />
            )}
            <Separator />
            <InfoRow
              label="Periode"
              value={
                statement.periodLabel ??
                `${formatDate(statement.periodStart)} au ${formatDate(statement.periodEnd)}`
              }
            />
            <InfoRow label="Date de reception" value={formatDate(statement.receivedDate)} />
            {statement.dueDate && (
              <InfoRow label="Echeance" value={formatDate(statement.dueDate)} />
            )}
            {statement.reference && (
              <InfoRow label="Reference" value={statement.reference} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Montants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="text-xl font-bold tabular-nums">
                {formatCurrency(statement.totalAmount)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Paye</span>
              <span className="font-semibold tabular-nums text-[var(--color-status-positive)]">
                {formatCurrency(statement.paidAmount)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Reste du</span>
              <span
                className={`font-semibold tabular-nums ${resteDu > 0 ? "text-[var(--color-status-negative)]" : ""}`}
              >
                {formatCurrency(resteDu)}
              </span>
            </div>
            {statement.paidAt && (
              <>
                <Separator />
                <InfoRow label="Date du paiement" value={formatDate(statement.paidAt)} />
                {statement.paymentMethod && (
                  <InfoRow label="Moyen de paiement" value={statement.paymentMethod} />
                )}
                {statement.paymentReference && (
                  <InfoRow label="Reference paiement" value={statement.paymentReference} />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lignes */}
      <Card>
        <CardHeader>
          <CardTitle>
            Lignes de detail ({statement.lines.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {statement.lines.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Aucune ligne de detail
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Libelle</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-center">Nature</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <span className="font-medium">{line.label}</span>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(line.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      {line.nature ? (
                        <Badge
                          variant={NATURE_VARIANTS[line.nature] ?? "secondary"}
                          className="text-xs"
                        >
                          {NATURE_LABELS[line.nature] ?? line.nature}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Ligne de total */}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(
                      statement.lines.reduce((sum, l) => sum + l.amount, 0)
                    )}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {statement.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
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

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
