import { requirePortalAuth } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertTriangle, FileText } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Historique des paiements" };

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  PAYE: { label: "Payé", color: "text-[var(--color-status-positive)]", icon: CheckCircle2 },
  ENVOYEE: { label: "En attente", color: "text-[var(--color-status-caution)]", icon: Clock },
  EN_ATTENTE: { label: "En attente", color: "text-[var(--color-status-caution)]", icon: Clock },
  EN_RETARD: { label: "En retard", color: "text-destructive", icon: AlertTriangle },
  VALIDEE: { label: "Validée", color: "text-[var(--color-status-caution)]", icon: Clock },
};

export default async function PortalPaiementsPage() {
  let session;
  try {
    session = await requirePortalAuth();
  } catch {
    redirect("/portal/login");
  }

  const tenants = await prisma.tenant.findMany({
    where: { email: { equals: session.email, mode: "insensitive" }, isActive: true },
    select: { id: true },
  });
  const tenantIds = tenants.map((t) => t.id);

  const since = new Date();
  since.setMonth(since.getMonth() - 24);

  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId: { in: tenantIds },
      invoiceType: { in: ["QUITTANCE", "APPEL_LOYER"] },
      issueDate: { gte: since },
      status: { not: "BROUILLON" },
    },
    include: {
      lease: {
        include: {
          lot: {
            include: {
              building: { select: { name: true, addressLine1: true, city: true } },
            },
          },
          society: { select: { name: true } },
        },
      },
    },
    orderBy: { issueDate: "desc" },
  });

  // Grouper par mois (YYYY-MM)
  const byMonth = invoices.reduce(
    (acc, inv) => {
      const key = inv.issueDate.toISOString().slice(0, 7);
      if (!acc[key]) acc[key] = [];
      acc[key]!.push(inv);
      return acc;
    },
    {} as Record<string, typeof invoices>
  );

  const months = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

  function monthLabel(key: string): string {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Historique des paiements</h1>
        <p className="text-muted-foreground">Vos 24 derniers mois de loyers et quittances</p>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun mouvement enregistré</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Vos appels de loyer et quittances apparaîtront ici au fil des mois.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {months.map((month) => {
            const items = byMonth[month]!;
            return (
              <div key={month}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {monthLabel(month)}
                </h2>
                <div className="space-y-2">
                  {items.map((inv) => {
                    const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.EN_ATTENTE!;
                    const Icon = cfg.icon;
                    const isQuittance = inv.invoiceType === "QUITTANCE";
                    const address = inv.lease?.lot?.building
                      ? `${inv.lease.lot.building.name}${inv.lease.lot.building.city ? ` · ${inv.lease.lot.building.city}` : ""}`
                      : null;
                    return (
                      <div
                        key={inv.id}
                        className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3"
                      >
                        <Icon className={`h-5 w-5 shrink-0 ${cfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">
                              {isQuittance ? "Quittance" : "Appel de loyer"}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {inv.invoiceNumber}
                            </Badge>
                            {inv.fileUrl && (
                              <a
                                href={`/api/invoices/${inv.id}/pdf`}
                                className="text-xs text-primary hover:underline"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                PDF
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(inv.issueDate)}
                            {address && <> · {address}</>}
                            {inv.lease?.society?.name && <> · {inv.lease.society.name}</>}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold tabular-nums">
                            {formatCurrency(inv.totalTTC)}
                          </p>
                          <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-center pt-2">
        <Link href="/portal/documents" className="text-sm text-primary hover:underline">
          Télécharger mes quittances en PDF →
        </Link>
      </div>
    </div>
  );
}
