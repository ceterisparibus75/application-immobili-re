"use client";

import { useState } from "react";
import { recordPayment } from "@/actions/invoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

const PAYMENT_METHODS = ["Virement", "Chèque", "Prélèvement", "Espèces", "Autre"];

export default function PaymentForm({
  invoiceId,
  societyId,
}: {
  invoiceId: string;
  societyId: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  if (!showForm) {
    return (
      <Button onClick={() => setShowForm(true)} variant="default" size="sm">
        Enregistrer un paiement
      </Button>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const result = await recordPayment(societyId, {
      invoiceId,
      amount: parseFloat(data.amount!),
      paidAt: data.paidAt!,
      method: data.method || null,
      reference: data.reference || null,
    });

    setIsLoading(false);

    if (result.success) {
      router.refresh();
      setShowForm(false);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border rounded-md p-4">
      <p className="text-sm font-medium">Nouveau paiement</p>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="amount" className="text-xs">Montant (€) *</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            min={0.01}
            step={0.01}
            placeholder="0.00"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="paidAt" className="text-xs">Date de paiement *</Label>
          <Input id="paidAt" name="paidAt" type="date" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="method" className="text-xs">Mode de paiement</Label>
          <select
            id="method"
            name="method"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">—</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="reference" className="text-xs">Référence</Label>
          <Input
            id="reference"
            name="reference"
            placeholder="N° de virement..."
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Valider"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowForm(false)}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
