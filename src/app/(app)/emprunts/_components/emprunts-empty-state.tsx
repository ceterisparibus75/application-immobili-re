import Link from "next/link";
import { ArrowRight, BarChart3, Building2, Landmark, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const NEXT_ACTIONS = [
  {
    href: "/patrimoine/immeubles",
    label: "Rattacher au patrimoine",
    description: "Vérifier les immeubles avant de renseigner les financements.",
    icon: Building2,
  },
  {
    href: "/banque",
    label: "Connecter la banque",
    description: "Préparer le suivi des échéances et des mouvements liés aux prêts.",
    icon: Landmark,
  },
  {
    href: "/comptabilite/cashflow",
    label: "Voir le cash-flow",
    description: "Mesurer l'impact des futures échéances sur la trésorerie.",
    icon: BarChart3,
  },
];

export function EmpruntsEmptyState() {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8">
            <Landmark className="h-7 w-7 text-primary" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">Aucun emprunt</h3>
          <p className="mb-5 max-w-lg text-sm text-muted-foreground">
            Ajoutez vos financements pour suivre les amortissements, les échéances mensuelles et la valeur nette du patrimoine.
          </p>
          <Button asChild>
            <Link href="/emprunts/nouveau">
              <Plus className="h-4 w-4" />
              Nouvel emprunt
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
