"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Banknote, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { triggerSepaPayment } from "@/actions/sepa";
import { formatCurrency } from "@/lib/utils";

type SepaButtonProps = {
  invoiceId: string;
  societyId: string;
  mandateId: string;
  mandateRef: string | null;
  ibanLast4: string | null;
  remaining: number;
};

export function SepaButton({
  invoiceId, societyId, mandateId,
  mandateRef, ibanLast4, remaining,
}: SepaButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(String(remaining));
  const [chargeDate, setChargeDate] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await triggerSepaPayment(societyId, {
      mandateId,
      invoiceId,
      amount: parseFloat(amount),
      chargeDate: chargeDate || undefined,
    });
    setLoading(false);
    if (result.success) {
      toast.success("Prelevement SEPA declenche");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Banknote className="h-4 w-4" />
          SEPA
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Prelevement SEPA</DialogTitle>
          <DialogDescription>
            Mandat {mandateRef ?? "—"} (****{ibanLast4 ?? "—"})
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Montant (reste : {formatCurrency(remaining)})</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Date de prelevement (optionnel)</Label>
            <Input
              type="date"
              value={chargeDate}
              onChange={(e) => setChargeDate(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Lancer le prelevement
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
