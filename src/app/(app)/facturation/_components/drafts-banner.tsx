"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, ChevronDown, ChevronUp,
  CheckCircle2, Loader2, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { InvoiceType, TenantEntityType } from "@/generated/prisma/client";
import { validateInvoice } from "@/actions/invoice";

type DraftInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  dueDate: Date;
  totalTTC: number;
  totalHT: number;
  tenant: {
    entityType: TenantEntityType;
    companyName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
  lease?: { lot?: { building?: { name: string } | null } | null } | null;
};

function getTenantName(t: DraftInvoice["tenant"]): string {
  return t.entityType === "PERSONNE_MORALE"
    ? (t.companyName ?? "---")
    : [t.firstName, t.lastName].filter(Boolean).join(" ") || "---";
}

export function DraftsBanner({ drafts, societyId }: { drafts: DraftInvoice[]; societyId: string }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [validating, setValidating] = useState<Set<string>>(new Set());

  if (drafts.length === 0) return null;

  const handleValidate = async (invoiceId: string) => {
    setValidating((prev) => new Set([...prev, invoiceId]));
    try {
      const result = await validateInvoice(societyId, invoiceId);
      if (result.success) {
        toast.success("Facture validee");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur de validation");
      }
    } finally {
      setValidating((prev) => {
        const next = new Set(prev);
        next.delete(invoiceId);
        return next;
      });
    }
  };


  const totalBrouillons = drafts.reduce((s, d) => s + d.totalTTC, 0);

  return (
    <div className="rounded-lg border-2 border-[var(--color-status-caution)]/30 bg-[var(--color-status-caution-bg)]/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-[var(--color-status-caution-bg)]">
          <AlertTriangle className="h-4 w-4 text-[var(--color-status-caution)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-status-caution)]">
            {drafts.length} brouillon{drafts.length > 1 ? "s" : ""} en attente de validation
          </p>
          <p className="text-xs text-[var(--color-status-caution)]/70">
            Total : {formatCurrency(totalBrouillons)} TTC
          </p>
        </div>
        <Badge variant="outline" className="border-[var(--color-status-caution)]/60 text-[var(--color-status-caution)] shrink-0">
          {drafts.length}
        </Badge>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-[var(--color-status-caution)] shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[var(--color-status-caution)] shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-[var(--color-status-caution)]/20">
          <div className="divide-y divide-[var(--color-status-caution)]/15">
            {drafts.map((draft) => {
              const isValidating = validating.has(draft.id);
              const building = draft.lease?.lot?.building?.name ?? "";
              return (
                <div key={draft.id} className="flex items-center gap-3 px-4 py-2.5">
                  <FileText className="h-4 w-4 text-[var(--color-status-caution)]/70 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/facturation/${draft.id}`}
                        className="text-sm font-medium hover:underline text-[var(--color-status-caution)]"
                      >
                        {draft.invoiceNumber}
                      </Link>
                      {building && (
                        <span className="text-xs text-[var(--color-status-caution)]/60 truncate">
                          {building}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-status-caution)]/60 truncate">
                      {getTenantName(draft.tenant)} — Echeance {formatDate(draft.dueDate)}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-[var(--color-status-caution)] shrink-0 hidden sm:block">
                    {formatCurrency(draft.totalTTC)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 border-[var(--color-status-caution)]/60 text-[var(--color-status-caution)] hover:bg-[var(--color-status-caution-bg)] shrink-0"
                    onClick={() => handleValidate(draft.id)}
                    disabled={isValidating}
                  >
                    {isValidating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">Valider</span>
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
