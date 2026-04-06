import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, FileText, UserCheck, Plus, Download } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "RGPD" };

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  processing: "En cours",
  completed: "Traité",
  refused: "Refusé",
};

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  processing: "outline",
  completed: "default",
  refused: "destructive",
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  access: "Accès",
  rectification: "Rectification",
  deletion: "Suppression",
  portability: "Portabilité",
  opposition: "Opposition",
};

export default async function RgpdPage() {
  const h = await headers();
  const societyId = h.get("x-society-id");
  const session = await auth();

  let requests: Awaited<ReturnType<typeof prisma.gdprRequest.findMany>> = [];
  let records: Awaited<ReturnType<typeof prisma.dataProcessingRecord.findMany>> = [];
  let consents = 0;

  if (societyId && session?.user?.id) {
    try {
      await requireSocietyAccess(session.user.id, societyId);
      [requests, records, consents] = await Promise.all([
        prisma.gdprRequest.findMany({
          where: { societyId },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.dataProcessingRecord.findMany({
          where: { isActive: true },
          orderBy: { purpose: "asc" },
        }),
        prisma.consent.count({ where: { isGranted: true, revokedAt: null } }),
      ]);
    } catch {
      // permission denied
    }
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RGPD</h1>
          <p className="text-muted-foreground">
            Registre des traitements, droits des personnes et consentements
          </p>
        </div>
        <Link href="/rgpd/demandes/nouvelle">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Enregistrer une demande
          </Button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-[var(--color-status-caution-bg)] dark:bg-orange-900/30 p-2">
                <UserCheck className="h-4 w-4 text-[var(--color-status-caution)] dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Demandes en attente</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-2">
                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Traitements actifs</p>
                <p className="text-2xl font-bold">{records.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-[var(--color-status-positive-bg)] dark:bg-green-900/30 p-2">
                <Shield className="h-4 w-4 text-[var(--color-status-positive)] dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Consentements actifs</p>
                <p className="text-2xl font-bold">{consents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Demandes de droits */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Demandes d&apos;exercice des droits
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucune demande enregistrée
            </p>
          ) : (
            <div className="divide-y">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{r.requesterName}</span>
                      <Badge variant="outline" className="text-xs">
                        {REQUEST_TYPE_LABELS[r.requestType] ?? r.requestType}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.requesterEmail}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {(r.requestType === "access" ||
                      r.requestType === "portability") && (
                      <a
                        href={`/api/rgpd/requests/${r.id}/export`}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted transition-colors"
                        title="Exporter les donnees du locataire"
                      >
                        <Download className="h-3 w-3" />
                        Exporter
                      </a>
                    )}
                    <Badge variant={STATUS_VARIANTS[r.status] ?? "outline"}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registre des traitements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Registre des traitements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Registre vide
            </p>
          ) : (
            <div className="divide-y">
              {records.map((record) => (
                <div key={record.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{record.purpose}</p>
                    <Badge variant="outline" className="text-xs">
                      {record.retentionDays} jours
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Base légale : {record.legalBasis}
                  </p>
                  {record.dataCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {record.dataCategories.map((cat) => (
                        <Badge key={cat} variant="secondary" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Durées de conservation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Durées de conservation légales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {[
              { label: "Locataire actif", value: "Conservation illimitée" },
              { label: "Locataire archivé", value: "5 ans après fin de bail" },
              { label: "Document d'identité", value: "3 ans après fin de relation" },
              { label: "Donnée bancaire", value: "10 ans (obligation légale)" },
              { label: "Journal d'audit", value: "1 an" },
              { label: "Consentement", value: "3 ans après révocation" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between border-b pb-2 last:border-0">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium">{row.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
