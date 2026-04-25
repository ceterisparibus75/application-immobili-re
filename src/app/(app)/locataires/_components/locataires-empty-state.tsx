import Link from "next/link";
import { ArrowRight, FileText, Plus, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const NEXT_ACTIONS = [
  {
    href: "/candidatures",
    label: "Suivre les candidatures",
    description: "Transformer un dossier accepté en locataire sans ressaisie.",
  },
  {
    href: "/baux/import",
    label: "Importer un bail signé",
    description: "Retrouver le locataire depuis les informations du PDF.",
  },
  {
    href: "/baux/nouveau/complet",
    label: "Créer le bail complet",
    description: "Créer le lot, le locataire et le bail dans un seul parcours.",
  },
];

export function LocatairesEmptyState() {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <h3 className="mb-1 text-lg font-semibold">Aucun locataire</h3>
          <p className="mb-5 max-w-lg text-sm text-muted-foreground">
            Démarrez avec un dossier locataire, reprenez une candidature ou créez le bail complet si le logement n'est pas encore structuré.
          </p>
          <Link href="/locataires/nouveau">
            <Button>
              <Plus className="h-4 w-4" />
              Créer un locataire
            </Button>
          </Link>

          <div className="mt-8 grid w-full gap-3 text-left sm:grid-cols-3">
            {NEXT_ACTIONS.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group rounded-lg border border-border/70 bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-primary">
                  {action.href === "/candidatures" ? (
                    <UserPlus className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{action.label}</p>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{action.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
