import { getPendingRevisions } from "@/actions/rent-revision";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RevisionList } from "./_components/revision-list";
import { TrendingUp } from "lucide-react";

export default async function RevisionsPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const result = await getPendingRevisions(societyId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Révisions de loyer
          </h1>
          <p className="text-muted-foreground">
            Validez ou rejetez les révisions automatiques calculées à partir des indices INSEE.
          </p>
        </div>
      </div>

      <RevisionList
        revisions={result.success && result.data ? result.data : []}
        societyId={societyId}
      />
    </div>
  );
}
