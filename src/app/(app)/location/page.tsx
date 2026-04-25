import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  Mail,
  Plus,
  Receipt,
  UserPlus,
  Users,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Location" };

export default async function LocationPage() {
  const h = await headers();
  const societyId = h.get("x-society-id");
  const session = await auth();

  if (!societyId) redirect("/societes");
  if (!session?.user?.id) redirect("/login");

  await requireSocietyAccess(session.user.id, societyId);

  const [activeLeases, activeTenants, lateInvoices, openTickets, rentAggregate] = await Promise.all([
    prisma.lease.count({ where: { societyId, status: "EN_COURS" } }),
    prisma.tenant.count({ where: { societyId, isActive: true } }),
    prisma.invoice.count({ where: { societyId, status: { in: ["EN_RETARD", "PARTIELLEMENT_PAYE"] } } }),
    prisma.ticket.count({ where: { societyId, status: { in: ["OUVERT", "EN_COURS", "EN_ATTENTE"] } } }),
    prisma.lease.aggregate({
      where: { societyId, status: "EN_COURS" },
      _sum: { currentRentHT: true },
    }),
  ]);

  const monthlyRent = rentAggregate._sum.currentRentHT ?? 0;

  const metrics = [
    { label: "Baux actifs", value: activeLeases.toString(), icon: FileText },
    { label: "Locataires actifs", value: activeTenants.toString(), icon: Users },
    { label: "Factures en retard", value: lateInvoices.toString(), icon: AlertTriangle },
    { label: "Tickets ouverts", value: openTickets.toString(), icon: Mail },
  ];

  const workflows = [
    {
      title: "Contractualiser",
      description: "Créer un bail, importer un PDF signé ou vérifier les baux actifs.",
      href: "/baux",
      action: "Ouvrir les baux",
      icon: FileText,
    },
    {
      title: "Facturer",
      description: "Générer les appels de loyers, créer une facture ponctuelle ou suivre les relances.",
      href: "/facturation",
      action: "Ouvrir la facturation",
      icon: Receipt,
    },
    {
      title: "Traiter le quotidien",
      description: "Suivre locataires, charges, tickets et demandes entrantes depuis un point d’entrée clair.",
      href: "/locataires",
      action: "Ouvrir les locataires",
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Location</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {activeLeases} bail{activeLeases !== 1 ? "s" : ""} actif{activeLeases !== 1 ? "s" : ""}{" · "}
            {formatCurrency(monthlyRent)} HT/mois
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/locataires/nouveau">
              <UserPlus className="h-4 w-4" />
              Ajouter un locataire
            </Link>
          </Button>
          <Button asChild>
            <Link href="/baux/nouveau">
              <Plus className="h-4 w-4" />
              Créer un bail
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

      <div className="grid gap-4 lg:grid-cols-3">
        {workflows.map((workflow) => (
          <Card key={workflow.title}>
            <CardContent className="flex h-full flex-col gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <workflow.icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="font-semibold">{workflow.title}</h2>
                <p className="text-sm text-muted-foreground">{workflow.description}</p>
              </div>
              <Link href={workflow.href} className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                {workflow.action}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {(lateInvoices > 0 || openTickets > 0) && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium">À traiter en priorité</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {lateInvoices > 0 && (
              <Button asChild variant="outline" size="sm">
                <Link href="/facturation?tab=retard">Voir les factures en retard</Link>
              </Button>
            )}
            {openTickets > 0 && (
              <Button asChild variant="outline" size="sm">
                <Link href="/tickets">Voir les tickets ouverts</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
