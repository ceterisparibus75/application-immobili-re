"use client";

import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { toggleEmailCopy } from "@/actions/user";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EmailCopyToggleProps {
  userId: string;
  societyId: string;
  enabled: boolean;
  /** L'utilisateur courant peut-il modifier ce toggle ? */
  canToggle: boolean;
}

export function EmailCopyToggle({ userId, societyId, enabled, canToggle }: EmailCopyToggleProps) {
  const [isPending, startTransition] = useTransition();

  function handleChange(checked: boolean) {
    startTransition(async () => {
      const result = await toggleEmailCopy(userId, societyId, checked);
      if (result.success) {
        toast.success(checked ? "Copie cachée activée" : "Copie cachée désactivée");
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  if (isPending) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  return (
    <Switch
      checked={enabled}
      onCheckedChange={handleChange}
      disabled={!canToggle || isPending}
      title={canToggle ? "Activer/désactiver la copie cachée des emails" : "Seul un administrateur peut modifier cette option pour les autres"}
    />
  );
}
