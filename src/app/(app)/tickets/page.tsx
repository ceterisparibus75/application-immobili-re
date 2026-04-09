import { getTickets } from "@/actions/ticket";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { MessageSquare, Clock, User } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { TenantEntityType } from "@/generated/prisma/client";

const STATUS_LABELS: Record<string, string> = {
  OUVERT: "Ouvert",
  EN_COURS: "En cours",
  EN_ATTENTE: "En attente",
  RESOLU: "Resolu",
  FERME: "Ferme",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline" | "warning"> = {
  OUVERT: "destructive",
  EN_COURS: "default",
  EN_ATTENTE: "secondary",
  RESOLU: "outline",
  FERME: "secondary",
};

const PRIORITY_LABELS: Record<string, string> = {
  BASSE: "Basse",
  NORMALE: "Normale",
  HAUTE: "Haute",
  URGENTE: "Urgente",
};

const PRIORITY_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  BASSE: "outline",
  NORMALE: "secondary",
  HAUTE: "default",
  URGENTE: "destructive",
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

function tenantName(t: { entityType: TenantEntityType; companyName?: string | null; firstName?: string | null; lastName?: string | null }) {
  return t.entityType === "PERSONNE_MORALE"
    ? (t.companyName ?? "—")
    : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || "—";
}

export default async function TicketsPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const tickets = await getTickets(societyId);

  const openCount = tickets.filter((t) => t.status === "OUVERT" || t.status === "EN_COURS").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tickets</h1>
          <p className="text-muted-foreground">
            {openCount} ticket{openCount > 1 ? "s" : ""} ouvert{openCount > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground mb-2">Aucun ticket</p>
            <p className="text-sm text-muted-foreground">
              Les demandes des locataires depuis le portail apparaitront ici.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Link key={ticket.id} href={`/tickets/${ticket.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">
                          {ticket.ticketNumber}
                        </span>
                        <Badge variant={STATUS_VARIANTS[ticket.status] ?? "default"} className="text-xs">
                          {STATUS_LABELS[ticket.status] ?? ticket.status}
                        </Badge>
                        <Badge variant={PRIORITY_VARIANTS[ticket.priority] ?? "secondary"} className="text-xs">
                          {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                        </Badge>
                      </div>
                      <p className="font-medium truncate">{ticket.subject}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {tenantName(ticket.tenant)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(ticket.createdAt).toLocaleDateString("fr-FR")}
                        </span>
                        <span>
                          {ticket._count.messages} message{ticket._count.messages > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
