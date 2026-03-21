import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Download, BarChart3 } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Comptabilité" };

const JOURNAL_LABELS: Record<string, string> = {
  VENTES: "Ventes",
  BANQUE: "Banque",
  OPERATIONS_DIVERSES: "Opérations diverses",
};

async function getJournalEntries(societyId: string) {
  return prisma.journalEntry.findMany({
    where: { societyId },
    include: {
      lines: {
        include: { account: { select: { code: true, label: true } } },
      },
    },
    orderBy: { entryDate: "desc" },
    take: 50,
  });
}

async function getAccountingAccounts(societyId: string) {
  return prisma.accountingAccount.findMany({
    where: { societyId },
    orderBy: { code: "asc" },
  });
}

export default async function ComptabilitePage() {
  const h = await headers();
  const societyId = h.get("x-society-id");
  const session = await auth();

  let entries: Awaited<ReturnType<typeof getJournalEntries>> = [];
  let accounts: Awaited<ReturnType<typeof getAccountingAccounts>> = [];

  if (societyId && session?.user?.id) {
    try {
      await requireSocietyAccess(session.user.id, societyId);
      [entries, accounts] = await Promise.all([
        getJournalEntries(societyId),
        getAccountingAccounts(societyId),
      ]);
    } catch {
      // permission denied
    }
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);

  const totalDebit = entries
    .flatMap((e) => e.lines)
    .reduce((s, l) => s + l.debit, 0);
  const totalCredit = entries
    .flatMap((e) => e.lines)
    .reduce((s, l) => s + l.credit, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comptabilité</h1>
          <p className="text-muted-foreground">
            Plan comptable, journaux et écritures
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/comptabilite/previsionnel">
            <Button variant="outline" size="sm">
              <BarChart3 className="h-4 w-4" />
              Prévisionnel
            </Button>
          </Link>
          <Link href="/comptabilite/plan-comptable">
            <Button variant="outline" size="sm">
              <BookOpen className="h-4 w-4" />
              Plan comptable
            </Button>
          </Link>
          <Link href="/comptabilite/nouvelle-ecriture">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Nouvelle écriture
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Comptes actifs</p>
            <p className="text-2xl font-bold">{accounts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total débit</p>
            <p className="text-2xl font-bold">{fmt(totalDebit)} €</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total crédit</p>
            <p className="text-2xl font-bold">{fmt(totalCredit)} €</p>
          </CardContent>
        </Card>
      </div>

      {/* Journal des écritures */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Journal des écritures récentes
            </CardTitle>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
              Export FEC
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune écriture comptable. Les écritures sont générées automatiquement
              lors de la facturation et du rapprochement bancaire.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Date</th>
                    <th className="pb-2 text-left font-medium">Journal</th>
                    <th className="pb-2 text-left font-medium">Libellé</th>
                    <th className="pb-2 text-left font-medium">Pièce</th>
                    <th className="pb-2 text-right font-medium">Débit</th>
                    <th className="pb-2 text-right font-medium">Crédit</th>
                    <th className="pb-2 text-center font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((entry) => {
                    const debit = entry.lines.reduce((s, l) => s + l.debit, 0);
                    const credit = entry.lines.reduce((s, l) => s + l.credit, 0);
                    return (
                      <tr key={entry.id} className="hover:bg-muted/50">
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {new Date(entry.entryDate).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge variant="outline" className="text-xs">
                            {JOURNAL_LABELS[entry.journalType] ?? entry.journalType}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 max-w-[200px] truncate">{entry.label}</td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {entry.piece ?? "—"}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {debit > 0 ? fmt(debit) : "—"}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {credit > 0 ? fmt(credit) : "—"}
                        </td>
                        <td className="py-2 text-center">
                          <Badge
                            variant={entry.isValidated ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {entry.isValidated ? "Validée" : "Brouillon"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
