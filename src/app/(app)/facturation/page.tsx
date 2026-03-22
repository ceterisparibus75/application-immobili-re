import { getInvoices } from "@/actions/invoice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Euro, FileText, Plus, Zap } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { InvoiceStatus, InvoiceType, TenantEntityType } from "@prisma/client";

export const metadata = { title: "Facturation" };

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  EN_ATTENTE: "En attente",
  PAYE: "Payée",
  PARTIELLEMENT_PAYE: "Part. payée",
  EN_RETARD: "En retard",
  LITIGIEUX: "Litigieux",
};

const STATUS_VARIANTS: Record<
  InvoiceStatus,
  "default" | "success" | "warning" | "destructive" | "secondary"
> = {
  EN_ATTENTE: "default",
  PAYE: "success",
  PARTIELLEMENT_PAYE: "warning",
  EN_RETARD: "destructive",
  LITIGIEUX: "destructive",
};

const TYPE_LABELS: Record<InvoiceType, string> = {
  APPEL_LOYER: "Appel loyer",
  QUITTANCE: "Quittance",
  REGULARISATION_CHARGES: "Régul. charges",
  REFACTURATION: "Refacturation",
  AVOIR: "Avoir",
};

function tenantName(t: {
  entityType: TenantEntityType;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return t.entityType === "PERSONNE_MORALE"
    ? (t.companyName ?? "—")
    : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || "—";
}

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
  const totalImpaye = [...enAttente, ...enRetard].reduce(
    (s, i) => s + i.totalTTC,
    0
  );

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

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Euro className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">
                  {totalTTC.toLocaleString("fr-FR")} €
                </p>
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
                <p className="text-2xl font-bold text-destructive">
                  {totalImpaye.toLocaleString("fr-FR")} €
                </p>
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
                <p className="text-2xl font-bold text-destructive">
                  {enRetard.length}
                </p>
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
        <Card>
          <CardHeader>
            <CardTitle>Toutes les factures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {invoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/facturation/${invoice.id}`}
                  className="flex items-center justify-between py-3 px-2 hover:bg-accent/50 rounded-md transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {invoice.invoiceNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tenantName(invoice.tenant)} —{" "}
                      {new Date(invoice.dueDate).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {invoice.totalTTC.toLocaleString("fr-FR")} € TTC
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.totalHT.toLocaleString("fr-FR")} € HT
                      </p>
                    </div>
                    <Badge variant="outline">
                      {TYPE_LABELS[invoice.invoiceType]}
                    </Badge>
                    <Badge variant={STATUS_VARIANTS[invoice.status]}>
                      {STATUS_LABELS[invoice.status]}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
