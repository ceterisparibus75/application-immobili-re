import type { Metadata } from "next";
import type React from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Mail,
  Phone,
  User,
} from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { CandidateStatus } from "@/generated/prisma/client";
import { CandidateActions } from "./candidate-actions";

export const metadata: Metadata = { title: "Candidature" };

const STATUS_CONFIG: Record<CandidateStatus, { label: string; className: string }> = {
  NEW: { label: "Nouveau", className: "border-blue-200 bg-blue-50 text-blue-700" },
  CONTACTED: { label: "Contacté", className: "border-cyan-200 bg-cyan-50 text-cyan-700" },
  VISIT_SCHEDULED: { label: "Visite prévue", className: "border-violet-200 bg-violet-50 text-violet-700" },
  VISIT_DONE: { label: "Visite faite", className: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  DOSSIER_RECEIVED: { label: "Dossier reçu", className: "border-amber-200 bg-amber-50 text-amber-700" },
  DOSSIER_VALIDATED: { label: "Dossier validé", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  ACCEPTED: { label: "Accepté", className: "border-green-200 bg-green-50 text-green-700" },
  REJECTED: { label: "Refusé", className: "border-red-200 bg-red-50 text-red-700" },
  WITHDRAWN: { label: "Désisté", className: "border-slate-200 bg-slate-50 text-slate-700" },
};

function scoreClass(score: number | null) {
  if (score === null) return "border-slate-200 bg-slate-50 text-slate-700";
  if (score >= 70) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (score >= 40) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function jsonStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export default async function CandidatureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/");

  await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

  const { id } = await params;
  const candidate = await prisma.candidate.findFirst({
    where: { id, societyId },
    include: {
      activities: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!candidate) notFound();

  const lot = candidate.lotId
    ? await prisma.lot.findFirst({
        where: { id: candidate.lotId, building: { societyId } },
        select: {
          number: true,
          lotType: true,
          area: true,
          currentRent: true,
          building: { select: { id: true, name: true, city: true } },
        },
      })
    : null;

  const tags = jsonStringArray(candidate.tags);
  const documents = jsonStringArray(candidate.documents);
  const status = STATUS_CONFIG[candidate.status];
  const canConvert = Boolean(candidate.email);
  const disabledReason = !candidate.email
    ? "Ajoutez un email au dossier avant de créer le locataire."
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href="/candidatures">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {candidate.firstName} {candidate.lastName}
              </h1>
              <Badge variant="outline" className={status.className}>{status.label}</Badge>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              {candidate.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-4 w-4" />
                  {candidate.email}
                </span>
              )}
              {candidate.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-4 w-4" />
                  {candidate.phone}
                </span>
              )}
              {candidate.source && <span>Source : {candidate.source}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/location/mise-en-location">
              <CheckCircle2 className="h-4 w-4" />
              Parcours location
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/baux/nouveau/complet">
              <FileText className="h-4 w-4" />
              Préparer un bail
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dossier candidat</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Info label="Nom complet" value={`${candidate.firstName} ${candidate.lastName}`} icon={User} />
              <Info label="Entreprise" value={candidate.company ?? "—"} icon={Building2} />
              <Info
                label="Revenus mensuels"
                value={candidate.monthlyIncome ? formatCurrency(candidate.monthlyIncome) : "Non renseigné"}
                icon={CircleDollarSign}
              />
              <Info label="Garant" value={candidate.guarantorName ?? "Non renseigné"} icon={User} />
              <Info
                label="Emménagement souhaité"
                value={candidate.desiredMoveIn ? formatDate(candidate.desiredMoveIn) : "Non renseigné"}
                icon={Calendar}
              />
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Score</p>
                <Badge variant="outline" className={scoreClass(candidate.score)}>
                  {candidate.score !== null ? `${candidate.score}/100` : "Non scoré"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {lot && (
            <Card>
              <CardHeader>
                <CardTitle>Lot visé</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Info label="Immeuble" value={`${lot.building.name} · ${lot.building.city}`} icon={Building2} />
                <Info label="Lot" value={`Lot ${lot.number} · ${lot.area} m²`} icon={FileText} />
                <Info
                  label="Loyer actuel"
                  value={lot.currentRent ? formatCurrency(lot.currentRent) : "Non renseigné"}
                  icon={CircleDollarSign}
                />
                <div className="flex items-end">
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/patrimoine/immeubles/${lot.building.id}`}>Ouvrir l&apos;immeuble</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Notes et pièces</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes internes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{candidate.notes || "Aucune note pour l'instant."}</p>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {documents.length} document{documents.length > 1 ? "s" : ""} référencé{documents.length > 1 ? "s" : ""} dans le dossier.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historique</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {candidate.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune activité enregistrée.</p>
              ) : (
                candidate.activities.map((activity) => (
                  <div key={activity.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="outline">{activity.type.replaceAll("_", " ")}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(activity.createdAt)}</span>
                    </div>
                    {activity.content && <p className="mt-2 text-sm">{activity.content}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Suite opérationnelle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Une fois le dossier validé, créez le locataire avec ses coordonnées et son score de risque, puis finalisez le bail depuis le module baux.
              </p>
              <CandidateActions
                societyId={societyId}
                candidateId={candidate.id}
                canConvert={canConvert}
                disabledReason={disabledReason}
              />
              <Button asChild variant="outline" className="w-full">
                <Link href="/baux/nouveau/complet">Créer un bail complet</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
