import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Euro } from "lucide-react";
import { RelancesClient } from "./_components/relances-client";

export const metadata = { title: "Relances" };

const LEVEL_LABELS: Record<string, string> = {
  RELANCE_1: "1ère relance",
  RELANCE_2: "2ème relance",
  MISE_EN_DEMEURE: "Mise en demeure",
  CONTENTIEUX: "Contentieux",
};

const LEVEL_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  RELANCE_1: "secondary",
  RELANCE_2: "outline",
  MISE_EN_DEMEURE: "destructive",
  CONTENTIEUX: "destructive",
};

async function getOverdueInvoices(societyId: string) {
  return prisma.invoice.findMany({
    where: {
      societyId,
      status: { in: ["EN_RETARD", "PARTIELLEMENT_PAYE"] },
      dueDate: { lt: new Date() },
    },
    select: {
      id: true,
      invoiceNumber: true,
      totalTTC: true,
      dueDate: true,
      payments: { select: { amount: true } },
      lease: {
        select: {
          tenant: {
            select: {
              entityType: true,
              companyName: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: { dueDate: "asc" },
    take: 50,
  });
}

async function getRecentReminders(societyId: string) {
  return prisma.reminder.findMany({
    where: { lease: { societyId } },
    select: {
      id: true,
      level: true,
      subject: true,
      totalAmount: true,
      sentAt: true,
      isSent: true,
      lease: {
        select: {
          tenant: {
            select: {
              entityType: true,
              companyName: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export default async function RelancesPage() {
  const h = await headers();
  const societyId = h.get("x-society-id") ?? "";
  const session = await auth();

  let overdueInvoices: Awaited<ReturnType<typeof getOverdueInvoices>> = [];
  let reminders: Awaited<ReturnType<typeof getRecentReminders>> = [];

  if (societyId && session?.user?.id) {
    try {
      await requireSocietyAccess(session.user.id, societyId);
      [overdueInvoices, reminders] = await Promise.all([
        getOverdueInvoices(societyId),
        getRecentReminders(societyId),
      ]);
    } catch {
      // permission denied
    }
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(v);

  const totalOverdue = overdueInvoices.reduce((s, inv) => {
    const paid = inv.payments.reduce((ps, p) => ps + p.amount, 0);
    return s + inv.totalTTC - paid;
  }, 0);

  function tenantName(lease: { tenant: { entityType: string; companyName: string | null; firstName: string | null; lastName: string | null } } | null) {
    if (!lease?.tenant) return "—";
    if (lease.tenant.entityType === "PERSONNE_MORALE") return lease.tenant.companyName ?? "—";
    return `${lease.tenant.firstName ?? ""} ${lease.tenant.lastName ?? ""}`.trim() || "—";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relances</h1>
        <p className="text-muted-foreground">
          Factures impayées et suivi des relances
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-destructive/10 p-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Factures en retard</p>
                <p className="text-2xl font-bold">{overdueInvoices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-orange-100 dark:bg-orange-900/30 p-2">
                <Euro className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total impayés</p>
                <p className="text-2xl font-bold">{fmt(totalOverdue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-2">
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Relances envoyées</p>
                <p className="text-2xl font-bold">
                  {reminders.filter((r) => r.isSent).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Factures en retard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Factures en retard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RelancesClient societyId={societyId} overdueInvoices={overdueInvoices} />
        </CardContent>
      </Card>

      {/* Historique relances */}
      <Card>
        <CardHeader>
          <CardTitle>Relances récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {reminders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucune relance enregistrée
            </p>
          ) : (
            <div className="divide-y">
              {reminders.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={LEVEL_VARIANTS[r.level] ?? "outline"}
                        className="text-xs shrink-0"
                      >
                        {LEVEL_LABELS[r.level] ?? r.level}
                      </Badge>
                      <span className="text-sm font-medium truncate">
                        {tenantName(r.lease)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.subject}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{fmt(r.totalAmount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.sentAt
                        ? new Date(r.sentAt).toLocaleDateString("fr-FR")
                        : "Non envoyée"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
