import { getTickets } from "@/actions/ticket";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Ticket } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import type { TicketStatus, TicketPriority, TicketType, TenantEntityType } from "@/generated/prisma/client";

export const metadata = { title: "Tickets" };

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
    ? (tenant.companyName ?? "—")
    : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "—";
}

type TicketRow = Awaited<ReturnType<typeof getTickets>>[number];

function TicketsTable({ tickets }: { tickets: TicketRow[] }) {
  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Ticket className="h-10 w-10 mb-2" />
        <p>Aucun ticket dans cette catégorie</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Référence</TableHead>
          <TableHead>Titre</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Priorité</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Locataire</TableHead>
          <TableHead>Assigné à</TableHead>
          <TableHead>Créé le</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((ticket) => (
          <TableRow key={ticket.id}>
            <TableCell>
              <Link
                href={`/tickets/${ticket.id}`}
                className="font-mono text-sm font-medium hover:underline"
              >
                {ticket.reference}
              </Link>
            </TableCell>
            <TableCell className="max-w-[250px] truncate">
              <Link href={`/tickets/${ticket.id}`} className="hover:underline">
                {ticket.title}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{TYPE_LABELS[ticket.type]}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={PRIORITY_VARIANTS[ticket.priority]}>
                {PRIORITY_LABELS[ticket.priority]}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANTS[ticket.status]}>
                {STATUS_LABELS[ticket.status]}
              </Badge>
            </TableCell>
            <TableCell>{tenantName(ticket.tenant)}</TableCell>
            <TableCell>{ticket.assignedTo?.name ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {formatDate(ticket.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default async function TicketsPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const tickets = await getTickets(societyId);

  const open = tickets.filter((t) => t.status === "OUVERT");
  const inProgress = tickets.filter((t) => t.status === "EN_COURS" || t.status === "EN_ATTENTE");
  const closed = tickets.filter((t) => t.status === "CLOTURE");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tickets</h1>
          <p className="text-muted-foreground">
            Gérez les demandes et incidents de vos locataires
          </p>
        </div>
        <Link href="/tickets/nouveau">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau ticket
          </Button>
        </Link>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tickets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ouverts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{open.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inProgress.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clôturés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{closed.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau avec onglets */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">
                Tous ({tickets.length})
              </TabsTrigger>
              <TabsTrigger value="open">
                Non traités ({open.length})
              </TabsTrigger>
              <TabsTrigger value="in-progress">
                En cours ({inProgress.length})
              </TabsTrigger>
              <TabsTrigger value="closed">
                Clôturés ({closed.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              <TicketsTable tickets={tickets} />
            </TabsContent>
            <TabsContent value="open">
              <TicketsTable tickets={open} />
            </TabsContent>
            <TabsContent value="in-progress">
              <TicketsTable tickets={inProgress} />
            </TabsContent>
            <TabsContent value="closed">
              <TicketsTable tickets={closed} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
