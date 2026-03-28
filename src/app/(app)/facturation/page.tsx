import { getInvoices } from "@/actions/invoice";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Euro, FileText, Plus, Zap, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { InvoicesList } from "./_components/invoices-list";
import { DraftsBanner } from "./_components/drafts-banner";

export const metadata = { title: "Facturation" };

export default async function FacturationPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const invoices = await getInvoices(societyId);

  const enAttente = invoices.filter((i) => i.status === "EN_ATTENTE");
  const enRetard = invoices.filter((i) => i.status === "EN_RETARD");
  const totalTTC = invoices
    .filter((i) => i.invoiceType !== "AVOIR")
    .reduce((s, i) => s + i.totalTTC, 0);
  const totalImpaye = [...enAttente, ...enRetard].reduce((s, i) => s + i.totalTTC, 0);
  const brouillons = invoices.filter((i) => i.status === "BROUILLON");

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facturation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {invoices.length} facture{invoices.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/facturation/generer">
            <Button variant="outline"><Zap className="h-4 w-4" />Generer les appels</Button>
          </Link>
          <Link href="/facturation/nouvelle">
            <Button><Plus className="h-4 w-4" />Nouvelle facture</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-blue-50/80 to-card dark:from-blue-950/20 dark:to-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Euro className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{totalTTC.toLocaleString("fr-FR")} &euro;</p>
              <p className="text-xs text-muted-foreground">Total facture TTC</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-amber-50/80 to-card dark:from-amber-950/20 dark:to-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{totalImpaye.toLocaleString("fr-FR")} &euro;</p>
              <p className="text-xs text-muted-foreground">Impayes ({enAttente.length + enRetard.length})</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-red-50/80 to-card dark:from-red-950/20 dark:to-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{enRetard.length}</p>
              <p className="text-xs text-muted-foreground">En retard</p>
            </div>
          </div>
        </div>
      </div>

      <DraftsBanner drafts={brouillons} societyId={societyId} />

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-primary/8 flex items-center justify-center mb-5">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Aucune facture</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              Creez vos premiers appels de loyer et factures.
            </p>
            <Link href="/facturation/nouvelle">
              <Button><Plus className="h-4 w-4" />Nouvelle facture</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <InvoicesList invoices={invoices} />
      )}
    </div>
  );
}
