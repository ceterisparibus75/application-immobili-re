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
  Bell,
  Clock,
  CheckCircle2,
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
      tenant: {
        select: {
          id: true,
          entityType: true,
          companyName: true,
          firstName: true,
          lastName: true,
        },
      },
      lease: {
        select: {
          id: true,
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
    const tenantId = r.tenant?.id ?? "unknown";
    const tenantName =
      r.tenant?.entityType === "PERSONNE_MORALE"
        ? r.tenant.companyName ?? "—"
        : [r.tenant?.firstName, r.tenant?.lastName]
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
