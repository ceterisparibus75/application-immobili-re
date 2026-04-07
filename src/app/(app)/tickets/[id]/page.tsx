import { getTicket } from "@/actions/ticket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, MessageSquare, User } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { formatDate, formatDateTime } from "@/lib/utils";
import { TicketActions } from "../_components/ticket-actions";
import type {
  TicketStatus,
  TicketPriority,
  TicketType,
  TenantEntityType,
} from "@/generated/prisma/client";

export const metadata = { title: "Détail du ticket" };

const STATUS_LABELS: Record<TicketStatus, string> = {
  OUVERT: "Ouvert",
  EN_COURS: "En cours",
  EN_ATTENTE: "En attente",
  CLOTURE: "Clôturé",
};

const STATUS_VARIANTS: Record<TicketStatus, "default" | "secondary" | "outline" | "destructive"> = {
  OUVERT: "destructive",
  EN_COURS: "default",
  EN_ATTENTE: "secondary",
  CLOTURE: "outline",
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  BASSE: "Basse",
  NORMALE: "Normale",
  HAUTE: "Haute",
  URGENTE: "Urgente",
};

const PRIORITY_VARIANTS: Record<TicketPriority, "default" | "secondary" | "outline" | "destructive"> = {
  BASSE: "outline",
  NORMALE: "secondary",
  HAUTE: "default",
  URGENTE: "destructive",
};

const TYPE_LABELS: Record<TicketType, string> = {
  TECHNIQUE: "Technique",
  ADMINISTRATIF: "Administratif",
};

function tenantName(tenant: {
  entityType: TenantEntityType;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  return tenant.entityType === "PERSONNE_MORALE"
    ? (tenant.companyName ?? "---")
    : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "---";
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const ticket = await getTicket(societyId, id);
  if (!ticket) notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/tickets">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {ticket.reference}
              </h1>
              <Badge variant={STATUS_VARIANTS[ticket.status]}>
                {STATUS_LABELS[ticket.status]}
              </Badge>
              <Badge variant={PRIORITY_VARIANTS[ticket.priority]}>
                {PRIORITY_LABELS[ticket.priority]}
              </Badge>
            </div>
            <p className="text-muted-foreground">{ticket.title}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
            </CardContent>
          </Card>

          {/* Commentaires */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="h-4 w-4" />
                Commentaires ({ticket.comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ticket.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Aucun commentaire pour le moment
                </p>
              ) : (
                <div className="space-y-4">
                  {ticket.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={`rounded-lg border p-3 ${
                        comment.isInternal
                          ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {comment.author.name ?? comment.author.email}
                          </span>
                          {comment.isInternal && (
                            <Badge variant="warning" className="text-xs">
                              Interne
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - 1/3 */}
        <div className="space-y-4">
          {/* Actions (client component) */}
          <TicketActions
            societyId={societyId}
            ticketId={ticket.id}
            currentStatus={ticket.status}
          />

          {/* Informations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <Badge variant="outline">{TYPE_LABELS[ticket.type]}</Badge>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Locataire</span>
                <span className="font-medium">{tenantName(ticket.tenant)}</span>
              </div>
              <Separator />
              {ticket.lot && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lot</span>
                    <span className="font-medium">
                      {ticket.lot.building?.name} - {ticket.lot.number}
                    </span>
                  </div>
                  <Separator />
                </>
              )}
              {ticket.lease && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bail</span>
                    <span className="font-medium">
                      {ticket.lease.leaseType}
                    </span>
                  </div>
                  <Separator />
                </>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigné à</span>
                <span className="font-medium">
                  {ticket.assignedTo?.name ?? "Non assigné"}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Créé le</span>
                <span>{formatDate(ticket.createdAt)}</span>
              </div>
              {ticket.resolvedAt && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Résolu le</span>
                    <span>{formatDate(ticket.resolvedAt)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
