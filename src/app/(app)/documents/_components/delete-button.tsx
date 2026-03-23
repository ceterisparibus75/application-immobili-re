"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { deleteDocument } from "@/actions/document";
import { useRouter } from "next/navigation";

export function DeleteDocumentButton({
  societyId,
  documentId,
  fileName,
}: {
  societyId: string;
  documentId: string;
  fileName: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Supprimer "${fileName}" ? Cette action est irréversible.`)) return;
    setLoading(true);
    await deleteDocument(societyId, documentId);
    setLoading(false);
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground hover:text-destructive"
      onClick={handleDelete}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </Button>
  );
}
