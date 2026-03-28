"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { sendManualReminder } from "@/actions/reminder";
import { toast } from "sonner";
import { Bell, Loader2 } from "lucide-react";
import type { ReminderLevel } from "@/generated/prisma/client";

const LEVEL_OPTIONS = [
  { value: "RELANCE_1", label: "1ère relance (amiable)" },
  { value: "RELANCE_2", label: "2ème relance (formelle)" },
  { value: "MISE_EN_DEMEURE", label: "Mise en demeure" },
];

interface SendReminderButtonProps {
  societyId: string;
  invoiceId: string;
  defaultLevel?: ReminderLevel;
}

export default function SendReminderButton({
  societyId,
  invoiceId,
  defaultLevel = "RELANCE_1",
}: SendReminderButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [level, setLevel] = useState<ReminderLevel>(defaultLevel);
  const [open, setOpen] = useState(false);

  function handleSend() {
    startTransition(async () => {
      const result = await sendManualReminder(societyId, invoiceId, level);
      if (result.success) {
        if (result.error) {
          toast.warning(result.error);
        } else {
          toast.success("Relance envoyée par email");
        }
        setOpen(false);
      } else {
        toast.error(result.error ?? "Erreur lors de l'envoi");
      }
    });
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={() => setOpen(true)}
      >
        <Bell className="h-3 w-3" />
        Relancer
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <NativeSelect
        value={level}
        onChange={(e) => setLevel(e.target.value as ReminderLevel)}
        options={LEVEL_OPTIONS}
        className="h-7 text-xs w-48"
      />
      <Button
        size="sm"
        className="h-7 text-xs"
        onClick={handleSend}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Bell className="h-3 w-3" />
        )}
        Envoyer
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() => setOpen(false)}
        disabled={isPending}
      >
        Annuler
      </Button>
    </div>
  );
}
