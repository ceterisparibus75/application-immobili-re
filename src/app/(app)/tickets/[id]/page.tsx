import { getTicketById } from "@/actions/ticket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, User, Headset, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { TicketActions } from "./_components/ticket-actions";
import { TicketReplyForm } from "./_components/ticket-reply-form";

const STATUS_LABELS: Record<string, string> = {
  OUVERT: "Ouvert",
  EN_COURS: "En cours",
  EN_ATTENTE: "En attente",
  RESOLU: "Resolu",
  FERME: "Ferme",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  OUVERT: "destructive",
  EN_COURS: "default",
  EN_ATTENTE: "secondary",
  RESOLU: "outline",
  FERME: "secondary",
};

const CATEGORY_LABELS: Record<string, string> = {
  MAINTENANCE: "Maintenance",
  PLOMBERIE: "Plomberie",
  ELECTRICITE: "Electricite",
  CHAUFFAGE: "Chauffage",
  NUISANCES: "Nuisances",
  PARTIES_COMMUNES: "Parties communes",
  DOCUMENT: "Document",
  FACTURATION: "Facturation",
  ASSURANCE: "Assurance",
  AUTRE: "Autre",
};

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const ticket = await getTicketById(societyId, id);
  if (!ticket) notFound();

  const tenantName = ticket.tenant.entityType === "PERSONNE_MORALE"
    ? (ticket.tenant.companyName ?? "—")
    : `${ticket.tenant.firstName ?? ""} ${ticket.tenant.lastName ?? ""}`.trim() || "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link href="/tickets">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-mono text-muted-foreground">
                {ticket.ticketNumber}
              </span>
              <Badge variant={STATUS_VARIANTS[ticket.status] ?? "default"}>
                {STATUS_LABELS[ticket.status] ?? ticket.status}
              </Badge>
              <Badge variant="outline">
                {CATEGORY_LABELS[ticket.category] ?? ticket.category}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-1">
              {ticket.subject}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cree le {new Date(ticket.createdAt).toLocaleDateString("fr-FR")} par {tenantName}
              {ticket.location && ` — ${ticket.location}`}
            </p>
          </div>
        </div>
        <TicketActions
          ticketId={ticket.id}
          societyId={societyId}
          currentStatus={ticket.status}
          currentPriority={ticket.priority}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Messages */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ticket.messages.map((msg) => {
                  const isTenant = msg.authorType === "TENANT";
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${isTenant ? "justify-start" : "justify-end"}`}
                    >
                      {isTenant && (
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div
                        className={`max-w-[75%] rounded-lg px-4 py-3 ${
                          isTenant
                            ? "bg-muted"
                            : "bg-primary text-primary-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">
                            {msg.authorName}
                          </span>
                          <span className="text-xs opacity-70">
                            {new Date(msg.createdAt).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      {!isTenant && (
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                          <Headset className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {ticket.status !== "FERME" && (
                <TicketReplyForm ticketId={ticket.id} societyId={societyId} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Locataire</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{tenantName}</p>
              {ticket.tenant.email && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3 w-3" />
                  {ticket.tenant.email}
                </p>
              )}
              {ticket.tenant.phone && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3 w-3" />
                  {ticket.tenant.phone}
                </p>
              )}
              <Link href={`/locataires/${ticket.tenant.id}`}>
                <Button variant="outline" size="sm" className="mt-2 w-full">
                  Voir le locataire
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Numero</p>
                <p className="font-mono">{ticket.ticketNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Categorie</p>
                <p>{CATEGORY_LABELS[ticket.category] ?? ticket.category}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Priorite</p>
                <p>{ticket.priority}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cree le</p>
                <p>{new Date(ticket.createdAt).toLocaleString("fr-FR")}</p>
              </div>
              {ticket.resolvedAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Resolu le</p>
                  <p>{new Date(ticket.resolvedAt).toLocaleString("fr-FR")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
