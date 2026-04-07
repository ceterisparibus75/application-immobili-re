"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addComment, updateTicket, closeTicket } from "@/actions/ticket";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import type { TicketStatus } from "@/generated/prisma/client";

interface TicketActionsProps {
  societyId: string;
  ticketId: string;
  currentStatus: TicketStatus;
}

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: "OUVERT", label: "Ouvert" },
  { value: "EN_COURS", label: "En cours" },
  { value: "EN_ATTENTE", label: "En attente" },
  { value: "CLOTURE", label: "Clôturé" },
];

export function TicketActions({ societyId, ticketId, currentStatus }: TicketActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  function handleStatusChange(value: string) {
    startTransition(async () => {
      const status = value as TicketStatus;
      let result;
      if (status === "CLOTURE") {
        result = await closeTicket(societyId, ticketId);
      } else {
        result = await updateTicket(societyId, { id: ticketId, status });
      }
      if (result.success) {
        toast.success("Statut mis à jour");
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  function handleAddComment() {
    if (!comment.trim()) return;
    startTransition(async () => {
      const result = await addComment(societyId, {
        ticketId,
        content: comment.trim(),
        isInternal,
      });
      if (result.success) {
        setComment("");
        setIsInternal(false);
        toast.success("Commentaire ajouté");
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  function handleClose() {
    startTransition(async () => {
      const result = await closeTicket(societyId, ticketId);
      if (result.success) {
        toast.success("Ticket clôturé");
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Changer le statut */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Statut</Label>
            <Select
              defaultValue={currentStatus}
              onValueChange={handleStatusChange}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {currentStatus !== "CLOTURE" && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleClose}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Clôturer le ticket
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Ajouter un commentaire */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Ajouter un commentaire</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Votre commentaire..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            disabled={isPending}
          />
          <div className="flex items-center gap-2">
            <Switch
              id="internal"
              checked={isInternal}
              onCheckedChange={setIsInternal}
              disabled={isPending}
            />
            <Label htmlFor="internal" className="text-sm text-muted-foreground">
              Note interne (non visible par le locataire)
            </Label>
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={handleAddComment}
            disabled={isPending || !comment.trim()}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Envoyer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
