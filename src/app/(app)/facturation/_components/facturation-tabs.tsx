"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { InvoicesList } from "./invoices-list";
import { DraftsBanner } from "./drafts-banner";
import { RelancesClient } from "./overdue-tab";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback } from "react";

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

function fmt(v: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}

function tenantName(lease: {
  tenant: {
    entityType: string;
    companyName: string | null;
    firstName: string | null;
    lastName: string | null;
  };
} | null) {
  if (!lease?.tenant) return "—";
  if (lease.tenant.entityType === "PERSONNE_MORALE")
    return lease.tenant.companyName ?? "—";
  const first = lease.tenant.firstName ?? "";
  const last = lease.tenant.lastName ?? "";
  return `${first} ${last}`.trim() || "—";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Invoice = any;

type OverdueInvoice = {
  id: string;
  invoiceNumber: string | null;
  totalTTC: number;
  dueDate: Date;
  payments: { amount: number }[];
  lease: {
    tenant: {
      entityType: string;
      companyName: string | null;
      firstName: string | null;
      lastName: string | null;
    };
  } | null;
};

type Reminder = {
  id: string;
  level: string;
  subject: string;
  totalAmount: number;
  sentAt: Date | null;
  isSent: boolean;
  lease: {
    tenant: {
      entityType: string;
      companyName: string | null;
      firstName: string | null;
      lastName: string | null;
    };
  } | null;
};

interface FacturationTabsProps {
  invoices: Invoice[];
  brouillons: Invoice[];
  overdueInvoices: OverdueInvoice[];
  reminders: Reminder[];
  societyId: string;
  overdueCount: number;
  remindersCount: number;
}

export function FacturationTabs({
  invoices,
  brouillons,
  overdueInvoices,
  reminders,
  societyId,
  overdueCount,
  remindersCount,
}: FacturationTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentTab = searchParams.get("tab") ?? "factures";

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "factures") {
        params.delete("tab");
      } else {
        params.set("tab", value);
      }
      const qs = params.toString();
      router.push(`/facturation${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router],
  );

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="factures">Factures</TabsTrigger>
        <TabsTrigger value="en-retard" className="gap-1.5">
          En retard
          {overdueCount > 0 && (
            <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
              {overdueCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="relances" className="gap-1.5">
          Relances
          {remindersCount > 0 && (
            <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
              {remindersCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      {/* Onglet Factures */}
      <TabsContent value="factures" className="space-y-6 mt-6">
        <DraftsBanner drafts={brouillons} societyId={societyId} />
        {invoices.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20">
              <p className="text-sm text-muted-foreground">Aucune facture</p>
            </CardContent>
          </Card>
        ) : (
          <InvoicesList invoices={invoices} />
        )}
      </TabsContent>

      {/* Onglet En retard */}
      <TabsContent value="en-retard" className="space-y-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Factures en retard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RelancesClient
              societyId={societyId}
              overdueInvoices={overdueInvoices}
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Onglet Relances (historique) */}
      <TabsContent value="relances" className="space-y-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Historique des relances</CardTitle>
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
      </TabsContent>
    </Tabs>
  );
}
