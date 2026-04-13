import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileText, Plus, Building2, Users, AlertTriangle, CheckCircle, Clock } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  BROUILLON: { label: "Brouillon", variant: "secondary" },
  VALIDE: { label: "Validé", variant: "default" },
  VERIFIE: { label: "Vérifié", variant: "outline" },
  CONFORME: { label: "Conforme", variant: "default" },
  LITIGE: { label: "Litige", variant: "destructive" },
  PAYE: { label: "Payé", variant: "default" },
  PARTIELLEMENT_PAYE: { label: "Partiellement payé", variant: "outline" },
};

export default async function RelevesGestionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/societes");

  await requireSocietyAccess(session.user.id, societyId);

  const statements = await prisma.thirdPartyStatement.findMany({
    where: {
      societyId,
      type: "DECOMPTE_GESTION",
    },
    include: {
      lease: {
        select: {
          id: true,
          leaseNumber: true,
          lot: { select: { number: true, building: { select: { name: true } } } },
          tenant: { select: { firstName: true, lastName: true, companyName: true } },
        },
      },
      leases: {
        include: {
          lease: {
            select: {
              id: true,
              leaseNumber: true,
              lot: { select: { number: true, building: { select: { name: true } } } },
              tenant: { select: { firstName: true, lastName: true, companyName: true } },
            },
          },
        },
      },
      contact: { select: { name: true } },
    },
    orderBy: { receivedDate: "desc" },
  });

  // KPIs
  const totalStatements = statements.length;
  const pendingVerification = statements.filter((s) => s.status === "VALIDE" || s.status === "BROUILLON").length;
  const inDispute = statements.filter((s) => s.status === "LITIGE").length;
  const conformeCount = statements.filter((s) => s.status === "CONFORME").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--color-brand-blue)]" />
            Décomptes de gestion
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Suivi des décomptes envoyés par vos gestionnaires tiers (agences)
          </p>
        </div>
        <Button asChild className="gap-1.5 bg-brand-gradient-soft hover:opacity-90 text-white">
          <Link href="/releves-gestion/nouveau">
            <Plus className="h-4 w-4" />
            Nouveau décompte
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totalStatements}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">À vérifier</span>
            </div>
            <p className="text-2xl font-bold mt-1">{pendingVerification}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Conformes</span>
            </div>
            <p className="text-2xl font-bold mt-1">{conformeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Litiges</span>
            </div>
            <p className="text-2xl font-bold mt-1">{inDispute}</p>
          </CardContent>
        </Card>
      </div>

      {/* Liste */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tous les décomptes</CardTitle>
        </CardHeader>
        <CardContent>
          {statements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun décompte de gestion enregistré.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agence</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Baux concernés</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Net reversé</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Reçu le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statements.map((s) => {
                    // Déterminer les baux concernés
                    const allLeases = s.leases.length > 0
                      ? s.leases.map((sl) => sl.lease)
                      : s.lease ? [s.lease] : [];

                    const statusCfg = STATUS_CONFIG[s.status] ?? { label: s.status, variant: "secondary" as const };

                    // Lien vers le détail : si bail unique, aller au détail par bail, sinon au global
                    const detailHref = allLeases.length === 1 && allLeases[0]
                      ? `/baux/${allLeases[0].id}/releves-gestion/${s.id}`
                      : `/releves-gestion/${s.id}`;

                    return (
                      <TableRow key={s.id} className="cursor-pointer hover:bg-muted/30">
                        <TableCell>
                          <Link href={detailHref} className="font-medium hover:underline">
                            {s.thirdPartyName}
                          </Link>
                          {s.reference && (
                            <span className="text-xs text-muted-foreground ml-1">
                              #{s.reference}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {s.periodLabel ?? `${formatDate(s.periodStart)} — ${formatDate(s.periodEnd)}`}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            {allLeases.map((l) => l && (
                              <div key={l.id} className="text-xs flex items-center gap-1">
                                {allLeases.length > 1 && <Users className="h-3 w-3 text-muted-foreground" />}
                                <span>
                                  {l.tenant?.companyName || `${l.tenant?.firstName} ${l.tenant?.lastName}`}
                                </span>
                                {l.lot?.building && (
                                  <span className="text-muted-foreground flex items-center gap-0.5">
                                    <Building2 className="h-3 w-3" />
                                    {l.lot.building.name} — {l.lot.number}
                                  </span>
                                )}
                              </div>
                            ))}
                            {allLeases.length > 1 && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {allLeases.length} baux
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(s.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {s.netAmount ? formatCurrency(s.netAmount) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(s.receivedDate)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
