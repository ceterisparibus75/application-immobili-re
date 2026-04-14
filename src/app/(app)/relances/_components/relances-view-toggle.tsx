"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LayoutList, Columns } from "lucide-react";
import { RelancesOverdue } from "./relances-overdue";
import { RelancesKanban } from "./relances-kanban";

type OverdueInvoice = {
  id: string;
  invoiceNumber: string;
  totalTTC: number;
  dueDate: string;
  status: string;
  paid: number;
  tenantName: string;
  tenantEmail: string | null;
};

type Props = {
  societyId: string;
  overdueInvoices: OverdueInvoice[];
};

export function RelancesViewToggle({ societyId, overdueInvoices }: Props) {
  const [view, setView] = useState<"table" | "kanban">("table");

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Toggle */}
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={view === "table" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setView("table")}
                  aria-label="Vue tableau"
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tableau (sélection + envoi)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={view === "kanban" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setView("kanban")}
                  aria-label="Vue colonnes"
                >
                  <Columns className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Par ancienneté</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {view === "table" ? (
          <RelancesOverdue societyId={societyId} overdueInvoices={overdueInvoices} />
        ) : (
          <RelancesKanban overdueInvoices={overdueInvoices} />
        )}
      </div>
    </TooltipProvider>
  );
}
