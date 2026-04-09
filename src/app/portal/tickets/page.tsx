"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, MessageSquare, Loader2, Clock } from "lucide-react";
import {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
} from "@/validations/ticket";

type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  _count: { messages: number };
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  OUVERT: "default",
  EN_COURS: "default",
  EN_ATTENTE: "secondary",
  RESOLU: "outline",
  FERME: "secondary",
};

const PRIORITY_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  BASSE: "outline",
  NORMALE: "secondary",
  HAUTE: "default",
  URGENTE: "destructive",
};

export default function PortalTicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const didMount = useRef(false);

  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/portal/tickets");
        if (res.ok && !cancelled) {
          const json = await res.json();
          setTickets(json.data ?? []);
        }
      } catch {
        // ignore
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function refreshTickets() {
    const res = await fetch("/api/portal/tickets");
    if (res.ok) {
      const json = await res.json();
      setTickets(json.data ?? []);
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      subject: formData.get("subject") as string,
      description: formData.get("description") as string,
      category: formData.get("category") as string,
      priority: (formData.get("priority") as string) || "NORMALE",
      location: (formData.get("location") as string) || null,
    };

    try {
      const res = await fetch("/api/portal/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (res.ok) {
        setDialogOpen(false);
        void refreshTickets();
      } else {
        setError(json.error ?? "Erreur");
      }
    } catch {
      setError("Erreur de connexion");
    }
    setCreating(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mes demandes</h1>
          <p className="text-muted-foreground">
            Signalez un probleme ou faites une demande a votre gestionnaire.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle demande
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouvelle demande</DialogTitle>
              <DialogDescription>
                Decrivez votre probleme ou votre demande. Votre gestionnaire sera notifie immediatement.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Sujet *</Label>
                <Input
                  id="subject"
                  name="subject"
                  required
                  maxLength={200}
                  placeholder="Ex: Fuite d'eau salle de bain"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Categorie *</Label>
                  <select
                    id="category"
                    name="category"
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {TICKET_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {TICKET_CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priorite</Label>
                  <select
                    id="priority"
                    name="priority"
                    defaultValue="NORMALE"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="BASSE">Basse</option>
                    <option value="NORMALE">Normale</option>
                    <option value="HAUTE">Haute</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Localisation (optionnel)</Label>
                <Input
                  id="location"
                  name="location"
                  placeholder="Ex: Salle de bain, cuisine..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  name="description"
                  required
                  rows={5}
                  maxLength={5000}
                  placeholder="Decrivez votre probleme en detail..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Envoyer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground mb-2">Aucune demande</p>
            <p className="text-sm text-muted-foreground mb-4">
              Vous n&apos;avez pas encore cree de demande.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card
              key={ticket.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => router.push(`/portal/tickets/${ticket.id}`)}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        {ticket.ticketNumber}
                      </span>
                      <Badge variant={STATUS_COLORS[ticket.status] ?? "default"} className="text-xs">
                        {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                      </Badge>
                      <Badge variant={PRIORITY_COLORS[ticket.priority] ?? "secondary"} className="text-xs">
                        {TICKET_PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                      </Badge>
                    </div>
                    <p className="font-medium truncate">{ticket.subject}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(ticket.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                      <span>{TICKET_CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>
                      <span>{ticket._count.messages} message{ticket._count.messages > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
