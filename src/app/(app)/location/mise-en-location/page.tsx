import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ClipboardCheck,
  FileSignature,
  FileText,
  Home,
  UserPlus,
  Users,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Mise en location" };

const FLOW_STEPS = [
  {
    title: "Préparer le lot",
    description: "Vérifier que le lot est vacant, documenté et prêt à recevoir un dossier.",
    href: "/patrimoine/lots",
    action: "Voir les lots",
    icon: Home,
  },
  {
    title: "Qualifier les candidatures",
    description: "Centraliser les contacts, pièces, revenus, garant, score et prochaine action.",
    href: "/candidatures/nouvelle",
    action: "Ajouter une candidature",
    icon: ClipboardCheck,
  },
  {
    title: "Créer le locataire",
    description: "Transformer le candidat retenu en dossier locataire exploitable.",
    href: "/locataires/nouveau",
    action: "Créer un locataire",
    icon: UserPlus,
  },
  {
    title: "Contractualiser",
    description: "Créer un bail complet ou importer le PDF signé pour démarrer la gestion.",
    href: "/baux/nouveau/complet",
    action: "Créer le bail",
    icon: FileSignature,
  },
  {
    title: "Activer le suivi",
    description: "Envoyer les documents, ouvrir le portail et préparer la première facturation.",
    href: "/baux",
    action: "Suivre les baux",
    icon: BadgeCheck,
  },
];

function metricLabel(value: number, singular: string, plural: string) {
  return `${value} ${value > 1 ? plural : singular}`;
}

export default async function MiseEnLocationPage() {
  const h = await headers();
  const societyId = h.get("x-society-id");
  const session = await auth();

  if (!societyId) redirect("/societes");
  if (!session?.user?.id) redirect("/login");

  await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

  const [vacantLots, activeCandidates, validatedCandidates, activeLeases] = await Promise.all([
    prisma.lot.count({ where: { status: "VACANT", building: { societyId } } }),
    prisma.candidate.count({
      where: { societyId, status: { notIn: ["REJECTED", "WITHDRAWN", "ACCEPTED"] } },
    }),
    prisma.candidate.count({ where: { societyId, status: "DOSSIER_VALIDATED" } }),
    prisma.lease.count({ where: { societyId, status: "EN_COURS" } }),
  ]);

  const metrics = [
    { label: "Lots vacants", value: vacantLots, icon: Building2 },
    { label: "Candidatures actives", value: activeCandidates, icon: Users },
    { label: "Dossiers validés", value: validatedCandidates, icon: BadgeCheck },
    { label: "Baux actifs", value: activeLeases, icon: FileText },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">P1 entrée locataire</Badge>
            <Badge variant="outline">Parcours guidé</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Mise en location</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Un point d'entrée unique pour passer d'un lot vacant à un bail actif : candidature,
            dossier locataire, contrat, documents et suivi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/baux/import">
              <FileText className="h-4 w-4" />
              Importer un bail PDF
            </Link>
          </Button>
          <Button asChild>
            <Link href="/candidatures/nouvelle">
              <UserPlus className="h-4 w-4" />
              Nouvelle candidature
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <metric.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums">{metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="rounded-lg border border-border bg-muted/20 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Séquence recommandée</h2>
            <p className="text-sm text-muted-foreground">
              Le parcours reste modulaire : vous pouvez démarrer par une candidature, par un locataire déjà connu ou par un bail PDF existant.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {metricLabel(vacantLots, "lot disponible", "lots disponibles")} pour démarrer.
          </p>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          {FLOW_STEPS.map((step, index) => (
            <Link
              key={step.href}
              href={step.href}
              className="group rounded-md border border-border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{index + 1}/5</span>
              </div>
              <p className="text-sm font-medium">{step.title}</p>
              <p className="mt-1 min-h-16 text-xs leading-5 text-muted-foreground">{step.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                {step.action}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold">Démarrer depuis un candidat</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Créez une candidature, associez-la à un lot vacant et suivez son statut jusqu'au dossier validé.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/candidatures/nouvelle">Ajouter une candidature</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold">Démarrer depuis un bail signé</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Importez le PDF : l'IA préremplit immeuble, lot, locataire et bail avant validation.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/baux/import">Importer un bail PDF</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold">Démarrer depuis un dossier connu</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Si le locataire est déjà retenu, créez directement son dossier puis le bail complet.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/locataires/nouveau">Créer un locataire</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
