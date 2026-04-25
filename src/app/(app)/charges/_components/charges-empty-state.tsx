import Link from "next/link";
import { ArrowRight, BookOpen, Building2, FileBarChart2, Plus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const NEXT_ACTIONS = [
  {
    href: "/charges/bibliotheque",
    label: "Voir la bibliothèque",
    description: "Contrôler les catégories récupérables, propriétaires ou mixtes.",
    icon: BookOpen,
  },
  {
    href: "/charges/comptes-rendus",
    label: "Préparer les régularisations",
    description: "Accéder aux comptes rendus annuels quand les charges seront saisies.",
    icon: FileBarChart2,
  },
];

export function ChargesEmptyState({ hasBuildings }: { hasBuildings: boolean }) {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8">
            <Receipt className="h-7 w-7 text-primary" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">Aucune charge</h3>
          <p className="mb-5 max-w-lg text-sm text-muted-foreground">
            {hasBuildings
              ? "Enregistrez vos charges d'exploitation, puis rattachez-les aux immeubles et catégories pour préparer les régularisations."
              : "Créez d'abord un immeuble pour rattacher les charges au bon patrimoine et préparer les régularisations locatives."}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {!hasBuildings && (
              <Button asChild variant="outline">
                <Link href="/patrimoine/immeubles/nouveau">
                  <Building2 className="h-4 w-4" />
                  Créer un immeuble
                </Link>
              </Button>
            )}
            <Button asChild>
              <Link href="/charges/nouvelle">
                <Plus className="h-4 w-4" />
                Nouvelle charge
              </Link>
            </Button>
          </div>

          <div className="mt-8 grid w-full gap-3 text-left sm:grid-cols-2">
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
