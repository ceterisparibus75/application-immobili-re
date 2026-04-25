import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const NEXT_ACTIONS = [
  {
    href: "/locataires",
    label: "Vérifier les locataires",
    description: "Identifier les dossiers à synchroniser dans le carnet de contacts.",
    icon: Users,
  },
  {
    href: "/patrimoine/immeubles",
    label: "Voir le patrimoine",
    description: "Rattacher prestataires et experts aux immeubles concernés.",
    icon: Building2,
  },
];

export function ContactsEmptyState({ syncAction }: { syncAction: ReactNode }) {
  return (
    <Card className="border-0 bg-white shadow-brand">
      <CardContent className="py-12">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-brand-light)]">
            <Users className="h-7 w-7 text-[var(--color-brand-blue)]" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-[var(--color-brand-deep)]">Aucun contact</h3>
          <p className="mb-5 max-w-lg text-sm text-muted-foreground">
            Centralisez prestataires, notaires, syndics et experts pour les retrouver depuis vos immeubles, baux et interventions.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {syncAction}
            <Button asChild className="bg-brand-gradient-soft text-white hover:opacity-90">
              <Link href="/contacts/nouveau">
                <Plus className="h-4 w-4" />
                Ajouter un contact
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
