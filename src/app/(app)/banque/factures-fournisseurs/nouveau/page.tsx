import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { UploadForm } from "./_components/upload-form";

export const metadata = { title: "Uploader une facture fournisseur" };

export default async function NouvelleFacturePage() {
  const h = await headers();
  const societyId = h.get("x-society-id");
  if (!societyId) redirect("/societes");

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/banque/factures-fournisseurs">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-brand-deep)]">
            Uploader une facture fournisseur
          </h1>
          <p className="text-muted-foreground text-sm">
            Importez un PDF — l&apos;IA tentera d&apos;extraire automatiquement les informations.
          </p>
        </div>
      </div>

      <UploadForm societyId={societyId} />
    </div>
  );
}
