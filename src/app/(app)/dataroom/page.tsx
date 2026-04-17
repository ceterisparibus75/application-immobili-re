import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDatarooms } from "@/actions/dataroom";

export const metadata: Metadata = { title: "Dataroom" };

import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, FolderLock, Landmark, SearchCheck } from "lucide-react";
import Link from "next/link";
import { DataroomList } from "./_components/dataroom-list";

export default async function DataroomPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/dashboard");

  const datarooms = await getDatarooms(societyId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-brand-deep)]">Datarooms</h1>
          <p className="text-muted-foreground text-sm">
            {datarooms.length} dataroom{datarooms.length !== 1 ? "s" : ""} · Espaces de partage de documents
          </p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-0 bg-white shadow-brand">
          <CardContent className="space-y-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-light)]">
              <FolderLock className="h-5 w-5 text-[var(--color-brand-blue)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-brand-deep)]">Partager sans disperser</p>
              <p className="mt-1 text-sm text-muted-foreground">Une dataroom sert à livrer un dossier propre à un tiers sans envoyer des pièces une par une.</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white shadow-brand">
          <CardContent className="space-y-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-light)]">
              <SearchCheck className="h-5 w-5 text-[var(--color-brand-blue)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-brand-deep)]">Utilisez-la pour un audit</p>
              <p className="mt-1 text-sm text-muted-foreground">Préparez les documents d'une vente, d'un financement ou d'une due diligence dans un seul espace.</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white shadow-brand">
          <CardContent className="space-y-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-light)]">
              <Landmark className="h-5 w-5 text-[var(--color-brand-blue)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-brand-deep)]">Commencez par la GED</p>
              <p className="mt-1 text-sm text-muted-foreground">Si vous n'avez pas encore vos pièces dans la GED, importez-les d'abord pour composer vos datarooms plus vite.</p>
            </div>
            <Link href="/documents" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-brand-blue)]">
              Ouvrir les documents
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
      <DataroomList societyId={societyId} datarooms={datarooms} />
    </div>
  );
}
