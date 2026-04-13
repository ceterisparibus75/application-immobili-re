import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { requireSocietyAccess } from "@/lib/permissions";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Plus,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { StatementStatus, StatementType } from "@/generated/prisma/client";

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

export default async function RelevesTiersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/");

  await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

  // Verifier que l'immeuble existe
  const building = await prisma.building.findFirst({
    where: { id, societyId },
    select: { id: true, name: true },
  });

  if (!building) notFound();

  const statements = await prisma.thirdPartyStatement.findMany({
    where: {
      buildingId: id,
      societyId,
      type: { in: ["APPEL_FONDS", "DECOMPTE_CHARGES"] },
    },
    include: {
      lines: { select: { id: true } },
    },
    orderBy: { periodStart: "desc" },
  });

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
          {building.name}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Releves syndic</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/patrimoine/immeubles/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Receipt className="h-6 w-6 text-[var(--color-brand-blue)]" />
              Releves syndic
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Appels de fonds et decomptes de charges pour {building.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/patrimoine/immeubles/${id}/releves-tiers/nouveau?type=DECOMPTE_CHARGES`}
          >
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4" />
              Nouveau decompte
            </Button>
          </Link>
          <Link
            href={`/patrimoine/immeubles/${id}/releves-tiers/nouveau?type=APPEL_FONDS`}
          >
            <Button className="gap-1.5 bg-brand-gradient-soft hover:opacity-90 text-white">
              <Plus className="h-4 w-4" />
              Nouvel appel de fonds
            </Button>
          </Link>
        </div>
      </div>

      {/* Contenu */}
      {statements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Receipt className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium mb-1">Aucun releve syndic</p>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              Enregistrez les appels de fonds et decomptes annuels de votre
              syndic pour suivre les charges de copropriete.
            </p>
            <Link
              href={`/patrimoine/immeubles/${id}/releves-tiers/nouveau?type=APPEL_FONDS`}
            >
              <Button className="gap-1.5">
                <Plus className="h-4 w-4" />
                Creer un appel de fonds
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {statements.length} releve{statements.length > 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-center">Statut</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.map((statement) => (
                  <TableRow key={statement.id} className="group">
                    <TableCell>
                      <Link
                        href={`/patrimoine/immeubles/${id}/releves-tiers/${statement.id}`}
                        className="flex items-center gap-2"
                      >
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABELS[statement.type] ?? statement.type}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/patrimoine/immeubles/${id}/releves-tiers/${statement.id}`}
                        className="hover:underline"
                      >
                        {statement.reference ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/patrimoine/immeubles/${id}/releves-tiers/${statement.id}`}
                      >
                        {statement.periodLabel ??
                          `${formatDate(statement.periodStart)} - ${formatDate(statement.periodEnd)}`}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      <Link
                        href={`/patrimoine/immeubles/${id}/releves-tiers/${statement.id}`}
                      >
                        {formatCurrency(statement.totalAmount)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={STATUS_VARIANTS[statement.status]}
                        className="text-xs"
                      >
                        {STATUS_LABELS[statement.status] ?? statement.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/patrimoine/immeubles/${id}/releves-tiers/${statement.id}`}
                      >
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
