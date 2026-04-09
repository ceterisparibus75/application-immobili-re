"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addTicketMessageFromManager } from "@/actions/ticket";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function TicketReplyForm({
  ticketId,
  societyId,
}: {
  ticketId: string;
  societyId: string;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setSending(true);
    const result = await addTicketMessageFromManager(societyId, {
      ticketId,
      content: content.trim(),
    });

    if (result.success) {
      setContent("");
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur lors de l'envoi");
    }
    setSending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Repondre au locataire..."
        rows={2}
        className="flex-1 resize-none"
        maxLength={5000}
      />
      <Button
        type="submit"
        size="icon"
        disabled={sending || !content.trim()}
        className="self-end"
      >
        {sending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </form>
  );
}
