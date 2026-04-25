import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Building,
  Building2,
  Layers,
  Plus,
  UmbrellaOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Patrimoine" };

const primaryLinks = [
  {
    title: "Immeubles",
    href: "/patrimoine/immeubles",
    description: "Parc bâti, adresses, surfaces et valorisation.",
    icon: Building2,
  },
  {
    title: "Lots",
    href: "/patrimoine/lots",
    description: "Statuts, surfaces, occupation et loyers de marché.",
    icon: Layers,
  },
  {
    title: "Sociétés",
    href: "/societes",
    description: "Entités de détention, fiscalité et facturation.",
    icon: Building,
  },
  {
    title: "Propriétaires",
    href: "/proprietaire",
    description: "Vue consolidée multi-sociétés et gouvernance.",
    icon: BriefcaseBusiness,
  },
];

const specializedLinks = [
  {
    title: "Évaluations IA",
    href: "/patrimoine/evaluations",
    description: "Estimations de valeur et analyse locative.",
    icon: Bot,
  },
  {
    title: "Copropriété",
    href: "/copropriete",
    description: "Budgets, quotes-parts et suivi copropriété.",
    icon: Building,
  },
  {
    title: "Saisonnier",
    href: "/saisonnier",
    description: "Biens, réservations et exploitation courte durée.",
    icon: UmbrellaOff,
  },
];

export default function PatrimoinePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-brand-deep)]">
            Patrimoine
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Immeubles, lots, sociétés et valorisation du portefeuille.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/societes/nouvelle">
              <Plus className="h-4 w-4" />
              Société
            </Link>
          </Button>
          <Button asChild className="gap-1.5">
            <Link href="/patrimoine/immeubles/nouveau">
              <Plus className="h-4 w-4" />
              Immeuble
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {primaryLinks.map((item) => (
          <ModuleLink key={item.href} item={item} />
        ))}
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-brand-deep)]">
            Accès spécialisés
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Modules utiles selon la nature du portefeuille.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {specializedLinks.map((item) => (
            <ModuleLink key={item.href} item={item} compact />
          ))}
        </div>
      </section>
    </div>
  );
}

type ModuleLinkItem = {
  title: string;
  href: string;
  description: string;
  icon: typeof Building2;
};

function ModuleLink({ item, compact = false }: { item: ModuleLinkItem; compact?: boolean }) {
  const Icon = item.icon;

  return (
    <Link href={item.href} className="group block h-full">
      <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/30">
        <CardContent className={compact ? "p-4" : "p-5"}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-[var(--color-brand-deep)]">{item.title}</p>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {item.description}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
