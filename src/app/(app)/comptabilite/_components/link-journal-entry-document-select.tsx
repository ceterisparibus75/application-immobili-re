"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { linkJournalEntryDocument, type AccountingDocumentOption } from "@/actions/accounting";

type Props = {
  societyId: string;
  entryId: string;
  currentDocumentId: string | null;
  documents: AccountingDocumentOption[];
};

export function LinkJournalEntryDocumentSelect({
  societyId,
  entryId,
  currentDocumentId,
  documents,
}: Props) {
  const [documentId, setDocumentId] = useState(currentDocumentId ?? "none");
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={documentId}
      disabled={isPending}
      onChange={(event) => {
        const value = event.target.value;
        setDocumentId(value);
        startTransition(async () => {
          const result = await linkJournalEntryDocument(societyId, entryId, value === "none" ? null : value);
          if (result.success) {
            toast.success(value === "none" ? "Pièce détachée" : "Pièce liée à l'écriture");
            return;
          }
          setDocumentId(currentDocumentId ?? "none");
          toast.error(result.error ?? "Erreur lors de la liaison");
        });
      }}
      className="h-8 w-44 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      aria-label="Pièce GED liée"
    >
      <option value="none">Aucune pièce GED</option>
      {documents.map((document) => (
        <option key={document.id} value={document.id}>
          {document.fileName}
        </option>
      ))}
    </select>
  );
}
