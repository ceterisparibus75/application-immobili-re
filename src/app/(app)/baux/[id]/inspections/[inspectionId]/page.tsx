import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getInspectionById } from "@/actions/inspection";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ClipboardList, User, Calendar, Home } from "lucide-react";
import Link from "next/link";

const CONDITION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  BON: { label: "Bon état", variant: "default" },
  USAGE_NORMAL: { label: "Usage normal", variant: "secondary" },
  DEGRADE: { label: "Dégradé", variant: "outline" },
  TRES_DEGRADE: { label: "Très dégradé", variant: "destructive" },
};

const TYPE_LABELS: Record<string, string> = {
  ENTREE: "État des lieux d'entrée",
  SORTIE: "État des lieux de sortie",
};

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string; inspectionId: string }>;
}) {
  const { id, inspectionId } = await params;
  const h = await headers();
  const societyId = h.get("x-society-id");
  if (!societyId) return notFound();

  const inspection = await getInspectionById(societyId, inspectionId);
  if (!inspection) return notFound();

  const tenant = inspection.lease.tenant;
  const tenantName =
    tenant.entityType === "PERSONNE_MORALE"
      ? tenant.companyName ?? "—"
      : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "—";

  const lot = inspection.lease.lot;
  const locationLabel = `${lot.building.name} — Lot ${lot.number}, ${lot.building.city}`;


  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href={`/baux/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {TYPE_LABELS[inspection.type] ?? inspection.type}
          </h1>
          <p className="text-muted-foreground">{locationLabel}</p>
        </div>
        <Badge variant={inspection.type === "ENTREE" ? "default" : "secondary"}>
          {TYPE_LABELS[inspection.type]}
        </Badge>
      </div>

      {/* Informations générales */}
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground">Date</dt>
                <dd className="text-sm font-medium">
                  {new Date(inspection.performedAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <User className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground">Réalisé par</dt>
                <dd className="text-sm font-medium">
                  {inspection.performedBy ?? "—"}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-2 sm:col-span-2">
              <ClipboardList className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground">Locataire</dt>
                <dd className="text-sm font-medium">{tenantName}</dd>
              </div>
            </div>
          </dl>
          {inspection.generalNotes && (
            <div className="mt-4 rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground mb-1">Notes générales</p>
              <p className="text-sm whitespace-pre-wrap">{inspection.generalNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pièces */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            État par pièce
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {inspection.rooms.length} pièce{inspection.rooms.length > 1 ? "s" : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {inspection.rooms.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune pièce enregistrée
            </p>
          )}
          {inspection.rooms.map((room) => {
            const condInfo = CONDITION_LABELS[room.condition];
            return (
              <div
                key={room.id}
                className="flex flex-col gap-1 border rounded-md p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{room.name}</span>
                  <Badge variant={condInfo?.variant ?? "outline"}>
                    {condInfo?.label ?? room.condition}
                  </Badge>
                </div>
                {room.notes && (
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                    {room.notes}
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {inspection.signedFileUrl && (
        <Card>
          <CardContent className="pt-6">
            <a
              href={inspection.signedFileUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="w-full">
                Voir le document signé
              </Button>
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
