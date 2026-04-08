import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDocuments } from "@/actions/document";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, FileStack, FileUp, FolderLock, Plus } from "lucide-react";
import Link from "next/link";
import { DocumentsClient } from "./_components/documents-client";

type DocumentsPageProps = {
  searchParams?: Promise<{ uploaded?: string }>;
};

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/dashboard");

  const documents = await getDocuments(societyId);
  const params = (await searchParams) ?? {};
  const showUploadSuccess = params.uploaded === "1";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-brand-deep)]">Documents</h1>
          <p className="text-muted-foreground text-sm">
            {documents.length} document{documents.length !== 1 ? "s" : ""} · GED intelligente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dataroom">
            <Button variant="outline" className="rounded-lg border-border/60 gap-1.5">
              <FolderLock className="h-4 w-4" />
              Datarooms
            </Button>
          </Link>
          <Link href="/documents/nouveau">
            <Button className="bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg gap-1.5">
              <Plus className="h-4 w-4" />
              Ajouter un document
            </Button>
          </Link>
        </div>
      </div>
      {showUploadSuccess && (
        <div className="rounded-2xl border border-[var(--color-status-positive)]/20 bg-[var(--color-status-positive-bg)] px-4 py-3">
          <p className="text-sm font-medium text-[var(--color-brand-deep)]">Document importé</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Le fichier est enregistré et l'analyse démarre en arrière-plan. Vérifiez ensuite son classement ou préparez son partage.
          </p>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-0 bg-white shadow-brand">
          <CardContent className="space-y-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-light)]">
              <FileUp className="h-5 w-5 text-[var(--color-brand-blue)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-brand-deep)]">1. Importer & classer</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Déposez vos pièces dans la GED et rattachez-les tout de suite au bon immeuble, bail ou locataire.
              </p>
            </div>
            <Link href="/documents/nouveau" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-brand-blue)]">
              Ajouter un document
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white shadow-brand">
          <CardContent className="space-y-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-light)]">
              <FolderLock className="h-5 w-5 text-[var(--color-brand-blue)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-brand-deep)]">2. Préparer un partage</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Regroupez les bons documents dans une dataroom dès que vous préparez une vente, un audit ou un financement.
              </p>
            </div>
            <Link href="/dataroom" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-brand-blue)]">
              Ouvrir les datarooms
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white shadow-brand">
          <CardContent className="space-y-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-light)]">
              <FileStack className="h-5 w-5 text-[var(--color-brand-blue)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-brand-deep)]">3. Structurer vos dossiers</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Plus vos baux et vos locataires sont créés tôt, plus la GED devient utile et retrouvable au quotidien.
              </p>
            </div>
            <Link href="/baux/nouveau" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-brand-blue)]">
              Créer un bail
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
      <DocumentsClient societyId={societyId} documents={documents} />
    </div>
  );
}
