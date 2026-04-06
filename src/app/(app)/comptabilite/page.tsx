import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BookOpen, Plus, Scale, Archive, FileBarChart, PenLine,
  List, TrendingUp, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Comptabilité" };

const JOURNAL_LABELS: Record<string, string> = {
  VENTES: "Ventes", BANQUE: "Banque", OPERATIONS_DIVERSES: "Op. Diverses",
  AN: "À Nouveaux", AC: "Achats", BQUE: "Banque", INV: "Investissements",
  OD: "Op. Diverses", VT: "Ventes/TVA",
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  BROUILLON: "secondary", VALIDEE: "default", CLOTUREE: "outline",
};

export default async function ComptabilitePage() {
  const h = await headers();
  const societyId = h.get("x-society-id");
  const session = await auth();

  if (!societyId || !session?.user?.id) return null;

  try {
    await requireSocietyAccess(session.user.id, societyId);
  } catch {
    return null;
  }

  const [entries, accountCount, fiscalYear, stats] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { societyId },
      include: { lines: { select: { debit: true, credit: true } } },
      orderBy: { entryDate: "desc" },
      take: 20,
    }),
    prisma.accountingAccount.count({ where: { societyId, isActive: true } }),
    prisma.fiscalYear.findFirst({
      where: { societyId, isClosed: false },
      orderBy: { year: "desc" },
    }),
    prisma.journalEntry.groupBy({
      by: ["status"],
      where: { societyId },
      _count: { id: true },
    }),
  ]);

  const brouillonCount = stats.find(s => s.status === "BROUILLON")?._count.id ?? 0;
  const valideeCount = stats.find(s => s.status === "VALIDEE")?._count.id ?? 0;
  const totalEntries = stats.reduce((s, r) => s + r._count.id, 0);

  const quickActions = [
    { href: "/comptabilite/nouvelle-ecriture", icon: PenLine, label: "Saisir une écriture", color: "text-blue-600" },
    { href: "/comptabilite/grand-livre", icon: BookOpen, label: "Grand Livre", color: "text-purple-600" },
    { href: "/comptabilite/balance", icon: Scale, label: "Balance", color: "text-[var(--color-status-positive)]" },
    { href: "/comptabilite/plan-comptable", icon: List, label: "Plan comptable", color: "text-[var(--color-status-caution)]" },
    { href: "/comptabilite/exports", icon: FileBarChart, label: "Export FEC", color: "text-slate-600" },
    { href: "/comptabilite/cloture", icon: Archive, label: "Exercices", color: "text-[var(--color-status-negative)]" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Comptabilité</h1>
            {fiscalYear && (
              <p className="text-sm text-muted-foreground">Exercice {fiscalYear.year} en cours</p>
            )}
          </div>
        </div>
        <Button asChild>
          <Link href="/comptabilite/nouvelle-ecriture">
            <Plus className="h-4 w-4 mr-1" />Nouvelle écriture
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-blue-600 flex-shrink-0" />
            <div>
              <div className="text-2xl font-bold">{totalEntries}</div>
              <div className="text-xs text-muted-foreground">Écritures au total</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-[var(--color-status-caution)] flex-shrink-0" />
            <div>
              <div className="text-2xl font-bold">{brouillonCount}</div>
              <div className="text-xs text-muted-foreground">En brouillon</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-[var(--color-status-positive)] flex-shrink-0" />
            <div>
              <div className="text-2xl font-bold">{valideeCount}</div>
              <div className="text-xs text-muted-foreground">Validées</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <List className="h-8 w-8 text-purple-600 flex-shrink-0" />
            <div>
              <div className="text-2xl font-bold">{accountCount}</div>
              <div className="text-xs text-muted-foreground">Comptes actifs</div>
            </div>
          </CardContent>
        </Card>
      </div>
      {brouillonCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-[var(--color-status-caution-bg)] border border-[var(--color-status-caution)]/30 rounded-lg text-sm text-[var(--color-status-caution)]">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span><strong>{brouillonCount} écriture(s)</strong> sont en brouillon et doivent être validées avant la clôture de l&apos;exercice.</span>
        </div>
      )}
      {/* Accès rapides */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {quickActions.map(action => (
          <Link key={action.href} href={action.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
              <CardContent className="pt-4 flex flex-col items-center gap-2 text-center">
                <action.icon className={`h-6 w-6 ${action.color}`} />
                <span className="text-xs font-medium">{action.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {/* Dernières écritures */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base">Dernières écritures</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/comptabilite/grand-livre">Voir le grand livre</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead className="w-20">Pièce</TableHead>
                  <TableHead className="w-20">Journal</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right w-28">Montant</TableHead>
                  <TableHead className="w-24">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Aucune écriture — <Link href="/comptabilite/nouvelle-ecriture" className="underline">Saisir la première</Link>
                    </TableCell>
                  </TableRow>
                )}
                {entries.map(e => {
                  const total = e.lines.reduce((s, l) => s + l.debit, 0);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{formatDate(e.entryDate)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{e.piece ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {JOURNAL_LABELS[e.journalType] ?? e.journalType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-64 truncate">{e.label}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(total)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_COLORS[e.status] ?? "secondary"} className="text-xs">
                          {e.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {/* Info exercice */}
      {fiscalYear && (
        <Card className="border-muted bg-muted/20">
          <CardContent className="py-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Exercice <strong>{fiscalYear.year}</strong> — du {formatDate(fiscalYear.startDate)} au {formatDate(fiscalYear.endDate)}
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/comptabilite/cloture">Gérer les exercices</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
