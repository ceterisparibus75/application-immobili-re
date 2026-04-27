import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, BookOpen, Mail, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const NEXT_ACTIONS = [
  {
    href: "/aide/automatisation",
    label: "Lire le guide workflows",
    description: "Comprendre les déclencheurs, les étapes et les limites actuelles.",
    icon: BookOpen,
  },
  {
    href: "/relances",
    label: "Suivre les relances",
    description: "Contrôler les actions déjà automatisées autour des factures en retard.",
    icon: Mail,
  },
  {
    href: "/courriers",
    label: "Préparer les courriers",
    description: "Utiliser les modèles existants avant d'automatiser leur envoi.",
    icon: Workflow,
  },
];

export function WorkflowsEmptyState({ createAction }: { createAction?: ReactNode }) {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8">
            <Workflow className="h-7 w-7 text-primary" />
          </div>
          <h3 className="mb-1 text-lg font-semibold">Aucun workflow</h3>
          <p className="mb-5 max-w-lg text-sm text-muted-foreground">
            Créez un premier scénario manuel, planifié ou déclenché par événement, puis lancez-le depuis cette page.
          </p>
          {createAction ?? (
            <Button asChild>
              <Link href="/aide/automatisation">
                <BookOpen className="h-4 w-4" />
                Lire le guide workflows
              </Link>
            </Button>
          )}

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
