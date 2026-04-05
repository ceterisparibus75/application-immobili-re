"use client";

import { useState } from "react";
import { createBankTransaction } from "@/actions/bank";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AddTransactionForm({
  bankAccountId,
  societyId,
}: {
  bankAccountId: string;
  societyId: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const result = await createBankTransaction(societyId, {
      bankAccountId,
      transactionDate: data.transactionDate!,
      amount: parseFloat(data.amount!),
      label: data.label!,
      reference: data.reference || null,
      category: data.category || null,
    });

    setIsLoading(false);

    if (result.success) {
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <p className="text-xs font-medium text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="space-y-1">
        <Label htmlFor="transactionDate" className="text-xs text-[var(--color-brand-deep)]">Date *</Label>
        <Input id="transactionDate" name="transactionDate" type="date" required className="border-border/60 rounded-lg focus:ring-[var(--color-brand-blue)]" />
      </div>

      <div className="space-y-1">
        <Label htmlFor="label" className="text-xs text-[var(--color-brand-deep)]">Libellé *</Label>
        <Input
          id="label"
          name="label"
          placeholder="Ex: Loyer lot 12 - janvier"
          required
          className="border-border/60 rounded-lg"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="amount" className="text-xs text-[var(--color-brand-deep)]">
          Montant (€) — négatif pour une sortie *
        </Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step={0.01}
          placeholder="Ex: 1500 ou -350"
          required
          className="border-border/60 rounded-lg"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="reference" className="text-xs text-[var(--color-brand-deep)]">Référence</Label>
        <Input
          id="reference"
          name="reference"
          placeholder="N° de virement..."
          className="border-border/60 rounded-lg"
        />
      </div>

      <Button type="submit" size="sm" className="w-full bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg" disabled={isLoading}>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Ajouter"
        )}
      </Button>
    </form>
  );
}
