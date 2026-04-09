"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTicket } from "@/actions/ticket";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { MoreHorizontal, CheckCircle2, Clock, Pause, XCircle } from "lucide-react";

export function TicketActions({
  ticketId,
  societyId,
  currentStatus,
  currentPriority,
}: {
  ticketId: string;
  societyId: string;
  currentStatus: string;
  currentPriority?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStatusChange(status: string) {
    setLoading(true);
    const result = await updateTicket(societyId, { id: ticketId, status: status as "OUVERT" | "EN_COURS" | "EN_ATTENTE" | "RESOLU" | "FERME" });
    if (result.success) {
      toast.success(`Ticket mis a jour`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur");
    }
    setLoading(false);
  }

  async function handlePriorityChange(priority: string) {
    setLoading(true);
    const result = await updateTicket(societyId, { id: ticketId, priority: priority as "BASSE" | "NORMALE" | "HAUTE" | "URGENTE" });
    if (result.success) {
      toast.success("Priorite mise a jour");
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur");
    }
    setLoading(false);
  }

  if (currentStatus === "FERME") return null;

  return (
    <div className="flex items-center gap-2">
      {currentStatus !== "RESOLU" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleStatusChange("RESOLU")}
          disabled={loading}
        >
          <CheckCircle2 className="mr-2 h-3 w-3" />
          Resoudre
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={loading}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleStatusChange("EN_COURS")}>
            <Clock className="mr-2 h-3 w-3" />
            En cours
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusChange("EN_ATTENTE")}>
            <Pause className="mr-2 h-3 w-3" />
            En attente
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusChange("RESOLU")}>
            <CheckCircle2 className="mr-2 h-3 w-3" />
            Resolu
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handleStatusChange("FERME")}
            className="text-destructive"
          >
            <XCircle className="mr-2 h-3 w-3" />
            Fermer
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handlePriorityChange("BASSE")}>
            Priorite : Basse
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePriorityChange("NORMALE")}>
            Priorite : Normale
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePriorityChange("HAUTE")}>
            Priorite : Haute
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePriorityChange("URGENTE")}>
            Priorite : Urgente
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
