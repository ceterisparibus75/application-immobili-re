import Link from "next/link";
import { ArrowRight, BookOpen, FileText, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const NEXT_ACTIONS = [
  {
    href: "/locataires/nouveau",
    label: "Créer un locataire",
    description: "Ouvrir directement le dossier quand le candidat est retenu.",
    icon: UserPlus,
  },
  {
    href: "/baux/nouveau/complet",
    label: "Créer le bail complet",
    description: "Structurer le logement, le locataire et le bail ensemble.",
    icon: FileText,
  },
  {
    href: "/aide/candidatures",
    label: "Comprendre le pipeline",
    description: "Revoir les étapes de suivi avant les premières candidatures.",
    icon: BookOpen,
  },
];

export function CandidaturesEmptyState() {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <h3 className="mb-1 text-lg font-semibold">Aucune candidature</h3>
          <p className="mb-5 max-w-lg text-sm text-muted-foreground">
            Le pipeline est vide. Orientez-vous vers le dossier locataire, le bail complet ou le guide métier selon l'avancement du dossier.
          </p>
          <Button asChild>
            <Link href="/locataires/nouveau">
              <UserPlus className="h-4 w-4" />
              Créer un locataire
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
