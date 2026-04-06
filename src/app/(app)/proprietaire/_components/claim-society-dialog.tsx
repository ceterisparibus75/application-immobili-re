"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, CheckCircle2, Loader2 } from "lucide-react";
import { claimSociety } from "@/actions/owner";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const LEGAL_FORM_LABELS: Record<string, string> = {
  SCI: "SCI", SARL: "SARL", SAS: "SAS", SA: "SA", SNC: "SNC",
  EURL: "EURL", EI: "EI", SASU: "SASU", GIE: "GIE", AUTRE: "Autre",
};

type ClaimableSociety = {
  id: string;
  name: string;
  legalForm: string;
  siret: string;
  city: string;
};

export function ClaimSocietyDialog({ societies }: { societies: ClaimableSociety[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function handleClaim(societyId: string) {
    setLoadingId(societyId);
    startTransition(async () => {
      const result = await claimSociety(societyId);
      if (result.success) {
        setClaimedIds((prev) => new Set([...prev, societyId]));
        toast.success("Societe rattachee a votre compte proprietaire");
        router.refresh();
      } else {
        toast.error(result.error ?? "Une erreur est survenue");
      }
      setLoadingId(null);
    });
  }

  if (societies.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Link2 className="h-4 w-4" />
          Rattacher une societe existante
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Rattacher une societe</DialogTitle>
          <DialogDescription>
            Voici les societes dont vous etes administrateur et qui ne sont pas encore rattachees a un compte proprietaire.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {societies.map((s) => {
            const claimed = claimedIds.has(s.id);
            const loading = loadingId === s.id;
            return (
              <div key={s.id} className="flex items-center justify-between rounded-lg border p-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                    {s.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {LEGAL_FORM_LABELS[s.legalForm] ?? s.legalForm} &middot; {s.city}
                    </p>
                  </div>
                </div>
                {claimed ? (
                  <Badge variant="default" className="gap-1 shrink-0">
                    <CheckCircle2 className="h-3 w-3" />
                    Rattachee
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleClaim(s.id)}
                    className="shrink-0"
                  >
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Rattacher"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {claimedIds.size > 0 && (
          <Button variant="outline" className="w-full mt-2" onClick={() => setOpen(false)}>
            Fermer
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
