import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDocuments } from "@/actions/document";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { DocumentsClient } from "./_components/documents-client";

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/dashboard");

  const documents = await getDocuments(societyId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground text-sm">
            {documents.length} document{documents.length !== 1 ? "s" : ""} · GED intelligente
          </p>
        </div>
        <Link href="/documents/nouveau">
          <Button>
            <Plus className="h-4 w-4" />
            Ajouter un document
          </Button>
        </Link>
      </div>
      <DocumentsClient societyId={societyId} documents={documents} />
    </div>
  );
}
