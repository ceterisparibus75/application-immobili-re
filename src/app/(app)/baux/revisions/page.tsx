import { getPendingRevisions } from "@/actions/rent-revision";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RevisionList } from "./_components/revision-list";
import { TrendingUp, BarChart, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Révisions de loyer" };

export default async function RevisionsPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const result = await getPendingRevisions(societyId);
  const revisions = result.success && result.data ? result.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Révisions de loyer
            </h1>
            <p className="text-muted-foreground">
              Validez ou rejetez les révisions calculées automatiquement à partir des indices INSEE.
            </p>
          </div>
        </div>
        <Link href="/indices">
          <Button variant="outline" size="sm" className="gap-1.5">
            <BarChart className="h-3.5 w-3.5" />
            Indices INSEE
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {revisions.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">Aucune révision en attente</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Les révisions sont calculées automatiquement selon les indices INSEE configurés sur chaque bail.
          </p>
          <Link href="/indices" className="mt-4 inline-block">
            <Button variant="outline" size="sm" className="gap-1.5">
              <BarChart className="h-3.5 w-3.5" />
              Consulter les indices INSEE
            </Button>
          </Link>
        </div>
      )}

      <RevisionList
        revisions={revisions}
        societyId={societyId}
      />
    </div>
  );
}
