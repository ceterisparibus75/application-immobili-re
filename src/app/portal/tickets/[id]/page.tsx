"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2, Send, User, Headset } from "lucide-react";
import Link from "next/link";
import {
  TICKET_CATEGORY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
} from "@/validations/ticket";

type Message = {
  id: string;
  createdAt: string;
  authorType: string;
  authorName: string;
  content: string;
};

type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  location?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  messages: Message[];
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  OUVERT: "default",
  EN_COURS: "default",
  EN_ATTENTE: "secondary",
  RESOLU: "outline",
  FERME: "secondary",
};

export default function PortalTicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const didMount = useRef(false);

  async function refreshTicket() {
    try {
      const res = await fetch(`/api/portal/tickets/${ticketId}`);
      if (res.ok) {
        const json = await res.json();
        setTicket(json.data);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/portal/tickets/${ticketId}`);
        if (res.ok && !cancelled) {
          const json = await res.json();
          setTicket(json.data);
        }
      } catch {
        // ignore
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages.length]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !ticket) return;

    setSending(true);
    try {
      const res = await fetch(`/api/portal/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage.trim() }),
      });

      if (res.ok) {
        setNewMessage("");
        void refreshTicket();
      }
    } catch {
      // ignore
    }
    setSending(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Ticket introuvable</p>
        <Link href="/portal/tickets">
          <Button variant="outline" className="mt-4">Retour</Button>
        </Link>
      </div>
    );
  }

  const isClosed = ticket.status === "FERME";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/portal/tickets">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">
              {ticket.ticketNumber}
            </span>
            <Badge variant={STATUS_COLORS[ticket.status] ?? "default"}>
              {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {TICKET_PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
            </Badge>
          </div>
          <h1 className="text-xl font-bold tracking-tight mt-1">{ticket.subject}</h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span>{TICKET_CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>
            {ticket.location && <span>- {ticket.location}</span>}
            <span>Cree le {new Date(ticket.createdAt).toLocaleDateString("fr-FR")}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {ticket.messages.map((msg) => {
              const isTenant = msg.authorType === "TENANT";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isTenant ? "justify-end" : "justify-start"}`}
                >
                  {!isTenant && (
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Headset className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-lg px-4 py-3 ${
                      isTenant
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
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
                  {isTenant && (
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Formulaire de reponse */}
          {!isClosed ? (
            <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Ecrivez votre message..."
                rows={2}
                className="flex-1 resize-none"
                maxLength={5000}
              />
              <Button
                type="submit"
                size="icon"
                disabled={sending || !newMessage.trim()}
                className="self-end"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          ) : (
            <div className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground text-center">
              Ce ticket est ferme. Vous ne pouvez plus y repondre.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
