"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateInvoiceNote } from "@/actions/invoice-lifecycle";
import { toast } from "sonner";
import { StickyNote } from "lucide-react";

interface NoteEditorProps {
  invoiceId: string;
  societyId: string;
  initialNote: string | null;
}

export function NoteEditor({ invoiceId, societyId, initialNote }: NoteEditorProps) {
  const [note, setNote] = useState(initialNote ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateInvoiceNote(societyId, invoiceId, note.trim() || null);
      if (result.success) {
        toast.success("Note enregistree");
      } else {
        toast.error(result.error ?? "Erreur lors de l'enregistrement");
      }
    });
  }

  const isDirty = note !== (initialNote ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <StickyNote className="h-4 w-4" />
          Note
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note libre, visible sur le PDF de la facture..."
          rows={4}
          maxLength={2000}
          className="resize-none text-sm"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{note.length}/2000</span>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending || !isDirty}
          >
            {isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}