"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { inviteContactAsUser } from "@/actions/contact";
import { toast } from "sonner";

const ROLES = [
  { value: "LECTURE", label: "Lecture seule" },
  { value: "COMPTABLE", label: "Comptable" },
  { value: "GESTIONNAIRE", label: "Gestionnaire" },
  { value: "ADMIN_SOCIETE", label: "Administrateur" },
] as const;

export function InviteContactButton({
  contactId,
  contactName,
  contactEmail,
  societyId,
}: {
  contactId: string;
  contactName: string;
  contactEmail: string | null;
  societyId: string;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("LECTURE");
  const [isPending, startTransition] = useTransition();

  function handleInvite() {
    startTransition(async () => {
      const result = await inviteContactAsUser(societyId, contactId, role);
      if (!result.success) {
        toast.error(result.error);
      } else {
        toast.success(`${contactName} a été invité(e) avec le rôle ${ROLES.find((r) => r.value === role)?.label}`);
        setOpen(false);
      }
    });
  }

  if (!contactEmail) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4" />
          Inviter comme utilisateur
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inviter {contactName}</DialogTitle>
          <DialogDescription>
            Un compte utilisateur sera créé pour {contactEmail} avec un mot de passe temporaire envoyé par email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Rôle dans la société</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={handleInvite} disabled={isPending}>
            {isPending ? "Invitation…" : "Envoyer l'invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
