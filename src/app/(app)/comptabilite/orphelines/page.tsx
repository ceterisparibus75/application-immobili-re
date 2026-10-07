import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { listOrphanJournalEntries } from "@/actions/orphan-journal-entries";
import { formatDate } from "@/lib/utils";
import { OrphanGroupCard } from "./_components/orphan-group-card";

export const metadata = { title: "Écritures orphelines" };

export default async function OrphelinesPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const result = await listOrphanJournalEntries();
  const groups = result.success && result.data ? result.data : [];
  const total = groups.reduce((sum, g) => sum + g.count, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/comptabilite">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <AlertTriangle className="h-6 w-6 text-[var(--color-status-caution)]" />
            Écritures orphelines
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Écritures de journal sans exercice fiscal rattaché. À résoudre avant de pouvoir
            poser la contrainte NOT NULL sur <code className="text-xs">fiscalYearId</code>.
          </p>
        </div>
      </div>

      {!result.success ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            {result.error ?? "Erreur de chargement"}
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]">
              ✓
            </div>
            <h3 className="text-base font-semibold">Aucune écriture orpheline</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Toutes les écritures de journal sont bien rattachées à un exercice fiscal.
              Vous pouvez maintenant poser la contrainte NOT NULL en toute sécurité.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-[var(--color-status-caution)]/25 bg-[var(--color-status-caution-bg)]/40">
            <CardContent className="p-4">
              <p className="text-sm">
                <strong>{total}</strong> écriture{total > 1 ? "s" : ""} orpheline
                {total > 1 ? "s" : ""} répartie{total > 1 ? "s" : ""} sur{" "}
                <strong>{groups.length}</strong> société{groups.length > 1 ? "s" : ""}.
                Pour chaque groupe, soit vous rattachez à un exercice existant, soit vous
                créez un nouvel exercice couvrant la plage de dates concernée.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {groups.map((group) => (
              <OrphanGroupCard
                key={group.societyId}
                societyId={group.societyId}
                societyName={group.societyName}
                count={group.count}
                minDate={group.minDate.toISOString()}
                maxDate={group.maxDate.toISOString()}
                entries={group.entries.map((e) => ({
                  id: e.id,
                  entryDate: e.entryDate.toISOString(),
                  journalType: e.journalType,
                  piece: e.piece,
                  label: e.label,
                }))}
                formattedMinDate={formatDate(group.minDate)}
                formattedMaxDate={formatDate(group.maxDate)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
