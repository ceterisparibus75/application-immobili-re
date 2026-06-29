import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Mail,
  Clock,
  FileX,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Diagnostic facturation" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ month?: string; societyId?: string }>;

type DiagRow = {
  leaseId: string;
  societyName: string;
  tenantName: string;
  tenantEmail: string | null;
  tenantBillingEmail: string | null;
  lotLabel: string;
  expectedRentHT: number;
  invoice: {
    id: string;
    invoiceNumber: string | null;
    status: string;
    sentAt: Date | null;
    sentBy: string | null;
    totalTTC: number;
    emailDeliveryStatus: string | null;
    resendEmailId: string | null;
  } | null;
  proofs: {
    status: string;
    recipientEmail: string;
    sentAt: Date;
  }[];
  reminders: number;
};

function monthRange(monthStr: string): { start: Date; end: Date } {
  const [y, m] = monthStr.split("-").map(Number);
  return {
    start: new Date(y, m - 1, 1),
    end: new Date(y, m, 0, 23, 59, 59, 999),
  };
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon",
  VALIDEE: "Validée",
  ENVOYEE: "Envoyée",
  EN_ATTENTE: "En attente",
  EN_RETARD: "En retard",
  RELANCEE: "Relancée",
  PARTIELLEMENT_PAYE: "Partiellement payée",
  PAYEE: "Payée",
  ANNULEE: "Annulée",
};

export default async function DiagnosticFacturationPage(props: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const params = await props.searchParams;
  const monthStr = params.month ?? currentMonth();
  const filterSocietyId = params.societyId ?? null;

  // Sociétés accessibles au user (propriétaire direct OU via Proprietaire)
  const accessibleSocieties = await prisma.society.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { proprietaire: { userId } },
        { userSocieties: { some: { userId } } },
      ],
      ...(filterSocietyId ? { id: filterSocietyId } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const societyIds = accessibleSocieties.map((s) => s.id);
  if (societyIds.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Diagnostic facturation</h1>
        <p className="text-muted-foreground">Aucune société accessible.</p>
      </div>
    );
  }

  const { start, end } = monthRange(monthStr);

  // Baux EN_COURS sur la période (au moins partiellement)
  const leases = await prisma.lease.findMany({
    where: {
      societyId: { in: societyIds },
      status: "EN_COURS",
      startDate: { lte: end },
      NOT: { endDate: { lt: start } },
    },
    select: {
      id: true,
      societyId: true,
      currentRentHT: true,
      paymentFrequency: true,
      isThirdPartyManaged: true,
      society: { select: { name: true } },
      tenant: {
        select: {
          firstName: true,
          lastName: true,
          companyName: true,
          entityType: true,
          email: true,
          billingEmail: true,
        },
      },
      lot: { select: { number: true, building: { select: { name: true } } } },
    },
    orderBy: [{ society: { name: "asc" } }],
  });

  // Toutes les invoices APPEL_LOYER de la période pour les sociétés
  const invoices = await prisma.invoice.findMany({
    where: {
      societyId: { in: societyIds },
      invoiceType: "APPEL_LOYER",
      OR: [
        { periodStart: { gte: start, lte: end } },
        {
          periodStart: null,
          issueDate: { gte: start, lte: end },
        },
      ],
    },
    select: {
      id: true,
      leaseId: true,
      invoiceNumber: true,
      status: true,
      sentAt: true,
      sentBy: true,
      totalTTC: true,
      emailDeliveryStatus: true,
      resendEmailId: true,
    },
  });
  const invoiceByLease = new Map(invoices.map((i) => [i.leaseId ?? "", i]));

  // Preuves d'envoi associées aux factures
  const invoiceIds = invoices.map((i) => i.id);
  const proofs = invoiceIds.length > 0
    ? await prisma.emailDeliveryProof.findMany({
        where: { invoiceId: { in: invoiceIds } },
        select: { invoiceId: true, status: true, recipientEmail: true, sentAt: true },
      })
    : [];
  const proofsByInvoice = new Map<string, typeof proofs>();
  for (const p of proofs) {
    if (!p.invoiceId) continue;
    const arr = proofsByInvoice.get(p.invoiceId) ?? [];
    arr.push(p);
    proofsByInvoice.set(p.invoiceId, arr);
  }

  // Relances sur la période, comptées par leaseId
  const reminders = await prisma.reminder.findMany({
    where: {
      lease: { societyId: { in: societyIds } },
      sentAt: { gte: start, lte: end },
    },
    select: { leaseId: true },
  });
  const reminderCountByLease = new Map<string, number>();
  for (const r of reminders) {
    reminderCountByLease.set(r.leaseId, (reminderCountByLease.get(r.leaseId) ?? 0) + 1);
  }

  const rows: DiagRow[] = leases.map((l) => {
    const tenantName =
      l.tenant.entityType === "PERSONNE_MORALE"
        ? l.tenant.companyName ?? "—"
        : `${l.tenant.firstName ?? ""} ${l.tenant.lastName ?? ""}`.trim() || "—";
    const inv = invoiceByLease.get(l.id) ?? null;
    return {
      leaseId: l.id,
      societyName: l.society.name,
      tenantName,
      tenantEmail: l.tenant.email,
      tenantBillingEmail: l.tenant.billingEmail,
      lotLabel: l.lot ? `${l.lot.building.name} — Lot ${l.lot.number}` : "—",
      expectedRentHT: l.currentRentHT,
      invoice: inv,
      proofs: inv ? proofsByInvoice.get(inv.id) ?? [] : [],
      reminders: reminderCountByLease.get(l.id) ?? 0,
    };
  });

  // Indicateurs synthétiques
  const totalLeases = rows.length;
  const noInvoice = rows.filter((r) => !r.invoice).length;
  const drafts = rows.filter((r) => r.invoice && r.invoice.status === "BROUILLON").length;
  const validatedNotSent = rows.filter(
    (r) => r.invoice && r.invoice.sentAt == null && r.invoice.status !== "BROUILLON",
  ).length;
  const sentNoProof = rows.filter(
    (r) => r.invoice?.sentAt != null && r.proofs.length === 0,
  ).length;
  const bouncedOrFailed = rows.filter((r) =>
    r.proofs.some((p) => p.status === "BOUNCED" || p.status === "COMPLAINED"),
  ).length;
  const okSent = rows.filter(
    (r) =>
      r.invoice?.sentAt != null &&
      (r.proofs.length === 0 ||
        r.proofs.every((p) => p.status === "DELIVERED" || p.status === "SENT")),
  ).length;

  // Liste pour le sélecteur mois (12 derniers + courant)
  const monthOptions: { value: string; label: string }[] = [];
  const ref = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    monthOptions.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Diagnostic facturation</h1>
          <p className="text-muted-foreground">
            Vérification ligne par ligne : un appel de loyer a-t-il été créé,
            validé, envoyé et reçu pour chaque bail actif ?
          </p>
        </div>
        <form className="flex items-center gap-2" method="GET">
          <select
            name="month"
            defaultValue={monthStr}
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          >
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            name="societyId"
            defaultValue={filterSocietyId ?? ""}
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          >
            <option value="">Toutes les sociétés</option>
            {accessibleSocieties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm">Filtrer</Button>
        </form>
      </div>

      {/* Synthèse */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Baux actifs</p>
            <p className="text-2xl font-semibold tabular-nums">{totalLeases}</p>
          </CardContent>
        </Card>
        <Card className={noInvoice > 0 ? "border-red-200 bg-red-50/40 dark:bg-red-950/10" : ""}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <FileX className="h-3 w-3" /> Aucun appel
            </p>
            <p className={`text-2xl font-semibold tabular-nums ${noInvoice > 0 ? "text-red-600" : ""}`}>{noInvoice}</p>
          </CardContent>
        </Card>
        <Card className={drafts > 0 ? "border-amber-200 bg-amber-50/40 dark:bg-amber-950/10" : ""}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Brouillons</p>
            <p className={`text-2xl font-semibold tabular-nums ${drafts > 0 ? "text-amber-600" : ""}`}>{drafts}</p>
          </CardContent>
        </Card>
        <Card className={validatedNotSent > 0 ? "border-red-200 bg-red-50/40 dark:bg-red-950/10" : ""}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Validés non envoyés
            </p>
            <p className={`text-2xl font-semibold tabular-nums ${validatedNotSent > 0 ? "text-red-600" : ""}`}>{validatedNotSent}</p>
          </CardContent>
        </Card>
        <Card className={bouncedOrFailed > 0 ? "border-red-200 bg-red-50/40 dark:bg-red-950/10" : ""}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <XCircle className="h-3 w-3" /> Bounce / spam
            </p>
            <p className={`text-2xl font-semibold tabular-nums ${bouncedOrFailed > 0 ? "text-red-600" : ""}`}>{bouncedOrFailed}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/10">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Envoyés OK
            </p>
            <p className="text-2xl font-semibold tabular-nums text-emerald-600">{okSent}</p>
            {sentNoProof > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                dont {sentNoProof} sans preuve Resend
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerte hardcoded — éducative */}
      <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/10">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">Lecture du tableau</p>
            <ul className="text-xs text-amber-800 dark:text-amber-300 mt-1 space-y-0.5 list-disc pl-4">
              <li>« Aucun appel » = aucune <code>Invoice APPEL_LOYER</code> sur la période → le cron n&apos;a pas généré (bail non éligible, géré par tiers, ou créé après le 22 du mois précédent).</li>
              <li>« Validés non envoyés » = facture en <code>VALIDEE</code>/<code>EN_ATTENTE</code> avec <code>sentAt = null</code> → à envoyer depuis <code>/facturation</code>.</li>
              <li>« Bounce » = Resend a remonté un échec de livraison → adresse incorrecte, à corriger sur la fiche locataire.</li>
              <li>L&apos;email utilisé est <code>billingEmail</code> en priorité, sinon <code>email</code>.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Tableau */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail par bail</CardTitle>
          <CardDescription>
            {totalLeases} bail{totalLeases > 1 ? "x" : ""} actif{totalLeases > 1 ? "s" : ""} sur la période sélectionnée
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="pb-2 text-left font-medium">Société / Locataire / Lot</th>
                  <th className="pb-2 text-right font-medium">Loyer attendu</th>
                  <th className="pb-2 text-left font-medium">Facture</th>
                  <th className="pb-2 text-left font-medium">Statut</th>
                  <th className="pb-2 text-left font-medium">Envoyée le / à</th>
                  <th className="pb-2 text-left font-medium">Preuve Resend</th>
                  <th className="pb-2 text-center font-medium">Relances</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const isMissing = !r.invoice;
                  const isDraft = r.invoice?.status === "BROUILLON";
                  const validatedNotSent =
                    r.invoice && !isDraft && r.invoice.sentAt == null;
                  const hasBounce = r.proofs.some(
                    (p) => p.status === "BOUNCED" || p.status === "COMPLAINED",
                  );
                  const rowClass = isMissing
                    ? "bg-red-50/40 dark:bg-red-950/10"
                    : validatedNotSent
                      ? "bg-red-50/40 dark:bg-red-950/10"
                      : isDraft
                        ? "bg-amber-50/40 dark:bg-amber-950/10"
                        : hasBounce
                          ? "bg-red-50/40 dark:bg-red-950/10"
                          : "";
                  return (
                    <tr key={r.leaseId} className={rowClass}>
                      <td className="py-3">
                        <p className="font-medium text-sm leading-tight">{r.tenantName}</p>
                        <p className="text-xs text-muted-foreground leading-tight">
                          {r.societyName} · {r.lotLabel}
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          {r.tenantBillingEmail ?? r.tenantEmail ?? <span className="text-red-600 font-medium">aucun email</span>}
                        </p>
                      </td>
                      <td className="py-3 text-right tabular-nums">{formatCurrency(r.expectedRentHT)}</td>
                      <td className="py-3">
                        {r.invoice ? (
                          <div>
                            <Link
                              href={`/facturation/${r.invoice.id}`}
                              className="text-primary hover:underline text-xs"
                            >
                              {r.invoice.invoiceNumber ?? "Brouillon"}
                            </Link>
                            <p className="text-[10px] text-muted-foreground">{formatCurrency(r.invoice.totalTTC)} TTC</p>
                          </div>
                        ) : (
                          <span className="text-xs text-red-600 font-medium">Aucune</span>
                        )}
                      </td>
                      <td className="py-3">
                        {r.invoice ? (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              r.invoice.status === "PAYEE"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : r.invoice.status === "BROUILLON"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : validatedNotSent
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : ""
                            }`}
                          >
                            {STATUS_LABEL[r.invoice.status] ?? r.invoice.status}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        {r.invoice?.sentAt ? (
                          <div className="text-xs">
                            <p>{formatDate(r.invoice.sentAt)}</p>
                            <p className="text-[11px] text-muted-foreground">{r.invoice.sentBy ?? "—"}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-red-600 font-medium">Jamais envoyée</span>
                        )}
                      </td>
                      <td className="py-3">
                        {r.proofs.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="space-y-0.5">
                            {r.proofs.map((p, i) => (
                              <div key={i} className="flex items-center gap-1 text-[11px]">
                                {p.status === "DELIVERED" ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                ) : p.status === "BOUNCED" || p.status === "COMPLAINED" ? (
                                  <XCircle className="h-3 w-3 text-red-600" />
                                ) : (
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                )}
                                <span className={p.status === "BOUNCED" || p.status === "COMPLAINED" ? "text-red-600 font-medium" : ""}>
                                  {p.status}
                                </span>
                                <span className="text-muted-foreground truncate max-w-[140px]">
                                  {p.recipientEmail}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        {r.reminders > 0 ? (
                          <Badge variant="outline" className="text-[10px]">
                            {r.reminders}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      Aucun bail actif sur cette période.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
