"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  AlertTriangle, ChevronDown, ChevronUp,
  CheckCircle2, Loader2, FileText, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { InvoiceType, TenantEntityType } from "@/generated/prisma/client";
import { validateInvoice, deleteDraftInvoice } from "@/actions/invoice";

type DraftInvoice = {
  id: string;
  invoiceNumber: string | null;
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
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  if (drafts.length === 0) return null;

  const handleValidate = async (invoiceId: string) => {
    setValidating((prev) => new Set([...prev, invoiceId]));
    try {
      const result = await validateInvoice(societyId, invoiceId);
      if (result.success) {
        toast.success("Facture validée");
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

  const handleDelete = async (invoiceId: string) => {
    setDeleting((prev) => new Set([...prev, invoiceId]));
    try {
      const result = await deleteDraftInvoice(societyId, invoiceId);
      if (result.success) {
        toast.success("Brouillon supprimé");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors de la suppression");
      }
    } finally {
      setDeleting((prev) => {
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
              const isDeleting = deleting.has(draft.id);
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
                        {draft.invoiceNumber ?? "Brouillon"}
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
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 px-2"
                        disabled={isDeleting || isValidating}
                        title="Supprimer ce brouillon"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce brouillon ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible. Le brouillon sera définitivement supprimé.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(draft.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Supprimer définitivement
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 border-[var(--color-status-caution)]/60 text-[var(--color-status-caution)] hover:bg-[var(--color-status-caution-bg)] shrink-0"
                    onClick={() => handleValidate(draft.id)}
                    disabled={isValidating || isDeleting}
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