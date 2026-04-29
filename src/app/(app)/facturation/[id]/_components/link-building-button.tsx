"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { linkInvoiceToBuilding } from "@/actions/invoice";

interface Building {
  id: string;
  name: string;
  addressLine1: string;
  postalCode: string;
  city: string;
}

interface Props {
  invoiceId: string;
  societyId: string;
  buildings: Building[];
  currentBuildingId?: string | null;
}

export function LinkBuildingButton({ invoiceId, societyId, buildings, currentBuildingId }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>(currentBuildingId ?? "__none__");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSave() {
    setLoading(true);
    try {
      const buildingId = selected === "__none__" ? null : selected;
      const result = await linkInvoiceToBuilding(societyId, invoiceId, buildingId);
      if (result.success) {
        toast.success(buildingId ? "Facture rattachée à l'immeuble" : "Rattachement supprimé");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors du rattachement");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Building2 className="h-4 w-4" />
        {currentBuildingId ? "Changer l'immeuble" : "Rattacher à un immeuble"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rattacher à un immeuble</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un immeuble…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Aucun immeuble —</SelectItem>
                {buildings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} — {b.addressLine1}, {b.postalCode} {b.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Annuler</Button>
            <Button onClick={handleSave} disabled={loading || selected === (currentBuildingId ?? "__none__")}>
              {loading ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
