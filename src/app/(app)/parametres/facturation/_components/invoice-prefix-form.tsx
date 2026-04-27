"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Hash, CheckCircle2 } from "lucide-react";
import { updateSociety } from "@/actions/society";
import { toast } from "sonner";

interface InvoicePrefixFormProps {
  societyId: string;
  initialPrefix: string;
}

export function InvoicePrefixForm({ societyId, initialPrefix }: InvoicePrefixFormProps) {
  const [prefix, setPrefix] = useState(initialPrefix);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateSociety({ id: societyId, invoicePrefix: prefix });
      if (result.success) {
        toast.success("Préfixe mis à jour");
      } else {
        toast.error(result.error ?? "Erreur lors de la mise à jour");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Hash className="h-4 w-4 text-muted-foreground" />
          Numérotation des factures
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Définissez le préfixe utilisé pour la numérotation de vos factures. Par défaut : <span className="font-mono font-medium">FAC</span>.
        </p>
        <div className="flex items-end gap-3">
          <div className="space-y-1.5 flex-1 max-w-xs">
            <Label htmlFor="invoicePrefix">Préfixe</Label>
            <Input
              id="invoicePrefix"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              maxLength={10}
              placeholder="FAC"
              className="font-mono"
            />
          </div>
          <Button onClick={handleSave} disabled={isPending} size="sm">
            <CheckCircle2 className="h-4 w-4" />
            {isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Exemple avec le préfixe <span className="font-mono font-medium">{prefix || "FAC"}</span> : <span className="font-mono">{prefix || "FAC"}-2026-0001</span>
        </p>
      </CardContent>
    </Card>
  );
}
