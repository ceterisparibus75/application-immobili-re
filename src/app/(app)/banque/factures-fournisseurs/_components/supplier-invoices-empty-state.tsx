import Link from "next/link";
import { ArrowRight, Building2, FileText, Mail, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const NEXT_ACTIONS = [
  {
    href: "/parametres/facturation",
    label: "Configurer l'email",
    description: "Préparer la réception automatique des factures fournisseur.",
    icon: Mail,
  },
  {
    href: "/charges",
    label: "Voir les charges",
    description: "Transformer les factures validées en suivi de charges.",
    icon: FileText,
  },
  {
    href: "/patrimoine/immeubles",
    label: "Rattacher un immeuble",
    description: "Classer chaque facture sur le bon actif immobilier.",
    icon: Building2,
  },
];

export function SupplierInvoicesEmptyState() {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-brand-light)]">
            <FileText className="h-7 w-7 text-[var(--color-brand-blue)]" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-[var(--color-brand-deep)]">
            Aucune facture fournisseur
          </h3>
          <p className="mb-5 max-w-lg text-sm text-muted-foreground">
            Uploadez vos factures, rattachez-les aux immeubles, puis validez les montants à payer ou à intégrer aux charges.
          </p>
          <Button asChild>
            <Link href="/banque/factures-fournisseurs/nouveau">
              <Plus className="h-4 w-4" />
              Uploader une facture
            </Link>
          </Button>

          <div className="mt-8 grid w-full gap-3 text-left sm:grid-cols-3">
            {NEXT_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group rounded-lg border border-border/70 bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{action.label}</p>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{action.description}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
