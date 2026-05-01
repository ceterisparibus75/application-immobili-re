"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { validateInvoice, validateBatchInvoices, deleteDraftInvoice } from "@/actions/invoice";

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchValidating, setBatchValidating] = useState(false);

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
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(invoiceId);
          return next;
        });
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
  const draftIds = drafts.map((draft) => draft.id);
  const selectedIds = draftIds.filter((id) => selected.has(id));
  const allSelected = selectedIds.length === drafts.length && drafts.length > 0;

  const toggleDraft = (invoiceId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (draftIds.every((id) => prev.has(id))) return new Set();
      return new Set(draftIds);
    });
  };

  const handleValidateBatch = async () => {
    if (selectedIds.length === 0) return;
    setBatchValidating(true);
    try {
      const result = await validateBatchInvoices(societyId, selectedIds);
      if (result.success) {
        const count = result.data?.validated ?? selectedIds.length;
        toast.success(`${count} brouillon${count > 1 ? "s" : ""} validé${count > 1 ? "s" : ""}`);
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur de validation groupée");
      }
    } finally {
      setBatchValidating(false);
    }
  };

  return (
    <div className="rounded-lg border-2 border-[var(--color-status-caution)]/30 bg-[var(--color-status-caution-bg)]/50">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
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
        {selectedIds.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1 border-[var(--color-status-caution)]/60 text-[var(--color-status-caution)] hover:bg-[var(--color-status-caution-bg)] shrink-0"
            onClick={handleValidateBatch}
            disabled={batchValidating}
          >
            {batchValidating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Valider {selectedIds.length}
          </Button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-[var(--color-status-caution)]/20">
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-[var(--color-status-caution)]/70">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              disabled={batchValidating}
              aria-label="Sélectionner tous les brouillons"
            />
            <button
              type="button"
              onClick={toggleAll}
              disabled={batchValidating}
              className="font-medium hover:underline disabled:cursor-not-allowed"
            >
              {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
            </button>
            {selectedIds.length > 0 && (
              <span>
                {selectedIds.length} sélectionné{selectedIds.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="divide-y divide-[var(--color-status-caution)]/15">
            {drafts.map((draft) => {
              const isValidating = validating.has(draft.id);
              const isDeleting = deleting.has(draft.id);
              const building = draft.lease?.lot?.building?.name ?? "";
              return (
                <div key={draft.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Checkbox
                    checked={selected.has(draft.id)}
                    onCheckedChange={() => toggleDraft(draft.id)}
                    disabled={batchValidating || isDeleting || isValidating}
                    aria-label={`Sélectionner ${draft.invoiceNumber ?? "brouillon"}`}
                    className="shrink-0"
                  />
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
