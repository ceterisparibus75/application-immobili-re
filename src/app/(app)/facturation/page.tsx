import { getInvoices } from "@/actions/invoice";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Euro, FileText, Plus, Zap } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { InvoicesList } from "./_components/invoices-list";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facturation</h1>
          <p className="text-muted-foreground">
            {invoices.length} facture{invoices.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/facturation/generer">
            <Button variant="outline">
              <Zap className="h-4 w-4" />
              Générer les appels
            </Button>
          </Link>
          <Link href="/facturation/nouvelle">
            <Button>
              <Plus className="h-4 w-4" />
              Nouvelle facture
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Euro className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{totalTTC.toLocaleString("fr-FR")} €</p>
                <p className="text-xs text-muted-foreground">Total facturé TTC</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Euro className="h-8 w-8 text-destructive/70" />
              <div>
                <p className="text-2xl font-bold text-destructive">{totalImpaye.toLocaleString("fr-FR")} €</p>
                <p className="text-xs text-muted-foreground">
                  Impayés ({enAttente.length + enRetard.length})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-destructive/70" />
              <div>
                <p className="text-2xl font-bold text-destructive">{enRetard.length}</p>
                <p className="text-xs text-muted-foreground">En retard</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune facture</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Créez vos premiers appels de loyer et factures.
            </p>
            <Link href="/facturation/nouvelle">
              <Button>
                <Plus className="h-4 w-4" />
                Nouvelle facture
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <InvoicesList invoices={invoices} />
      )}
    </div>
  );
}
