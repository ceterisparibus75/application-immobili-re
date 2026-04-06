import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Clock,
  CheckCircle2,
  Info,
  Mail,
  Users,
} from "lucide-react";
import { GestionLocativeNav } from "@/components/layout/gestion-locative-nav";
import { RelancesOverdue } from "./_components/relances-overdue";
import { RelancesHistory } from "./_components/relances-history";

export const metadata = { title: "Relances" };

function fmt(v: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}

export default async function RelancesPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await requireSocietyAccess(session.user.id, societyId);

  // Factures en retard (à relancer)
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      societyId,
      status: { in: ["EN_RETARD", "PARTIELLEMENT_PAYE", "RELANCEE"] },
      dueDate: { lt: new Date() },
    },
    select: {
      id: true,
      invoiceNumber: true,
      totalTTC: true,
      totalHT: true,
      dueDate: true,
      status: true,
      payments: { select: { amount: true } },
      lease: {
        select: {
          id: true,
          tenant: {
            select: {
              id: true,
              entityType: true,
              companyName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  // Historique des relances avec détails
  const allReminders = await prisma.reminder.findMany({
    where: { lease: { societyId } },
    select: {
      id: true,
      level: true,
      subject: true,
      totalAmount: true,
      sentAt: true,
      createdAt: true,
      isSent: true,
      emailStatus: true,
      channel: true,
      invoiceIds: true,
      lease: {
        select: {
          id: true,
          tenant: {
            select: {
              id: true,
              entityType: true,
              companyName: true,
              firstName: true,
              lastName: true,
            },
          },
          lot: {
            select: {
              number: true,
              building: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Grouper les relances par locataire
  const remindersByTenant = new Map<
    string,
    {
      tenantId: string;
      tenantName: string;
      lotLabel: string;
      reminders: typeof allReminders;
      totalReminders: number;
      lastReminderDate: Date | null;
      lastLevel: string;
    }
  >();

  for (const r of allReminders) {
    const tenant = r.lease?.tenant;
    const tenantId = tenant?.id ?? "unknown";
    const tenantName =
      tenant?.entityType === "PERSONNE_MORALE"
        ? tenant.companyName ?? "—"
        : [tenant?.firstName, tenant?.lastName]
            .filter(Boolean)
            .join(" ") || "—";
    const lotLabel = r.lease?.lot
      ? `${r.lease.lot.building.name} — Lot ${r.lease.lot.number}`
      : "—";

    if (!remindersByTenant.has(tenantId)) {
      remindersByTenant.set(tenantId, {
        tenantId,
        tenantName,
        lotLabel,
        reminders: [],
        totalReminders: 0,
        lastReminderDate: null,
        lastLevel: "",
      });
    }

    const group = remindersByTenant.get(tenantId)!;
    group.reminders.push(r);
    group.totalReminders++;
    if (!group.lastReminderDate || r.createdAt > group.lastReminderDate) {
      group.lastReminderDate = r.createdAt;
      group.lastLevel = r.level;
    }
  }

  // Sérialiser pour le composant client
  const historyByTenant = Array.from(remindersByTenant.values())
    .sort((a, b) => {
      if (!a.lastReminderDate) return 1;
      if (!b.lastReminderDate) return -1;
      return b.lastReminderDate.getTime() - a.lastReminderDate.getTime();
    })
    .map((group) => ({
      tenantId: group.tenantId,
      tenantName: group.tenantName,
      lotLabel: group.lotLabel,
      totalReminders: group.totalReminders,
      lastReminderDate: group.lastReminderDate?.toISOString() ?? null,
      lastLevel: group.lastLevel,
      reminders: group.reminders.map((r) => ({
        id: r.id,
        level: r.level,
        subject: r.subject,
        totalAmount: r.totalAmount,
        sentAt: r.sentAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        isSent: r.isSent,
        emailStatus: r.emailStatus,
        channel: r.channel,
      })),
    }));

  const overdueData = overdueInvoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    totalTTC: inv.totalTTC ?? inv.totalHT,
    dueDate: inv.dueDate.toISOString(),
    status: inv.status,
    paid: inv.payments.reduce((s, p) => s + p.amount, 0),
    tenantName:
      inv.lease?.tenant?.entityType === "PERSONNE_MORALE"
        ? inv.lease.tenant.companyName ?? "—"
        : [inv.lease?.tenant?.firstName, inv.lease?.tenant?.lastName]
            .filter(Boolean)
            .join(" ") || "—",
    tenantEmail: inv.lease?.tenant?.email ?? null,
  }));

  // KPIs
  const totalOverdue = overdueData.reduce(
    (s, inv) => s + (inv.totalTTC - inv.paid),
    0
  );
  const totalReminders = allReminders.length;
  const remindersThisMonth = allReminders.filter((r) => {
    const d = r.createdAt;
    const now = new Date();
    return (
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  }).length;
  const tenantsWithReminders = remindersByTenant.size;

  return (
    <div className="space-y-6">
      <GestionLocativeNav />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relances</h1>
        <p className="text-muted-foreground">
          Suivi des relances de loyer impayé · Envoi ponctuel ou groupé
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">
              Factures en retard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--color-status-negative)]" />
              <span className="text-2xl font-bold">
                {overdueData.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {fmt(totalOverdue)} restant dû
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">
              Relances ce mois
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold">
                {remindersThisMonth}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              sur {totalReminders} au total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">
              Locataires relancés
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-600" />
              <span className="text-2xl font-bold">
                {tenantsWithReminders}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              avec historique de relance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">
              Taux d&apos;envoi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[var(--color-status-positive)]" />
              <span className="text-2xl font-bold">
                {totalReminders > 0
                  ? Math.round(
                      (allReminders.filter((r) => r.isSent).length /
                        totalReminders) *
                        100
                    )
                  : 0}
                %
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              emails envoyés avec succès
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cycle de vie des factures */}
      <Card className="border-blue-200/50 bg-blue-50/30 dark:border-blue-900/50 dark:bg-blue-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <Info className="h-4 w-4" />
            Cycle de vie d&apos;une facture
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Flux visuel */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="secondary" className="text-[10px] font-normal">
              Brouillon
            </Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <Badge variant="secondary" className="text-[10px] font-normal">
              Validée
            </Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <Badge variant="outline" className="text-[10px] font-normal">
              En attente
            </Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <Badge variant="destructive" className="text-[10px] font-normal">
              En retard
            </Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <Badge variant="destructive" className="text-[10px] font-normal border-orange-300 bg-orange-100 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400">
              Relancée
            </Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <Badge className="text-[10px] font-normal bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
              Payée
            </Badge>
          </div>

          {/* Règles */}
          <div className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
            <div className="flex gap-2">
              <span className="font-semibold text-foreground shrink-0">En retard :</span>
              <span>
                Une facture passe automatiquement en retard dès que sa
                <strong className="text-foreground"> date d&apos;échéance est dépassée</strong>.
                Vérification chaque lundi matin.
              </span>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold text-foreground shrink-0">Relancée :</span>
              <span>
                Après envoi d&apos;une relance (manuelle ou automatique),
                la facture passe en statut « Relancée ».
              </span>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold text-foreground shrink-0">Payée :</span>
              <span>
                Dès que le total des paiements enregistrés couvre le montant TTC.
                Un paiement partiel la passe en « Partiellement payée ».
              </span>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold text-foreground shrink-0">Relances auto :</span>
              <span>
                Les relances automatiques sont envoyées chaque lundi selon le scénario
                configuré (J+5, J+15, J+30…).
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Factures à relancer */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-[var(--color-status-negative)]" />
                Factures à relancer
              </CardTitle>
              <CardDescription>
                Sélectionnez et envoyez des relances individuelles ou
                groupées
              </CardDescription>
            </div>
            {overdueData.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {overdueData.length} en retard
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <RelancesOverdue
            societyId={societyId}
            overdueInvoices={overdueData}
          />
        </CardContent>
      </Card>

      {/* Historique par locataire */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Historique des relances par locataire
          </CardTitle>
          <CardDescription>
            Toutes les relances envoyées, groupées par locataire
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RelancesHistory historyByTenant={historyByTenant} />
        </CardContent>
      </Card>
    </div>
  );
}
