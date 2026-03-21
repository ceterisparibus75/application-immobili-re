"use client";

import { useState, useTransition } from "react";
import { inviteOrReinviteTenant } from "@/actions/tenant";
import { Button } from "@/components/ui/button";
import { useSociety } from "@/providers/society-provider";
import { Loader2, Mail } from "lucide-react";

export function InviteTenantButton({ tenantId }: { tenantId: string }) {
  const { activeSociety } = useSociety();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleInvite() {
    if (!activeSociety) return;
    setMessage(null);

    startTransition(async () => {
      const result = await inviteOrReinviteTenant(activeSociety.id, tenantId);
      if (result.success) {
        setMessage({ type: "success", text: "Invitation envoyée" });
      } else {
        setMessage({ type: "error", text: result.error ?? "Erreur" });
      }
    });
  }

  return (
    <div>
      <Button variant="outline" onClick={handleInvite} disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        Inviter au portail
      </Button>
      {message && (
        <p className={`text-xs mt-1 ${message.type === "success" ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
