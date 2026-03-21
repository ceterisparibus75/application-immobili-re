"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { updateCharge } from "@/actions/charge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";

type ChargeData = {
  id: string;
  description: string;
  amount: number;
  date: string;
  periodStart: string;
  periodEnd: string;
  supplierName: string | null;
  isPaid: boolean;
  building: { id: string; name: string };
  category: { id: string; name: string };
};

function toInputDate(d: string | Date) {
  return new Date(d).toISOString().slice(0, 10);
}

export default function ModifierChargePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { activeSociety } = useSociety();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState("");
  const [charge, setCharge] = useState<ChargeData | null>(null);

  useEffect(() => {
    fetch(`/api/charges/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setCharge(data);
        setIsFetching(false);
      })
      .catch(() => setIsFetching(false));
  }, [params.id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety || !charge) return;

    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const result = await updateCharge(activeSociety.id, {
      id: charge.id,
      description: data.description,
      amount: Number(data.amount),
      date: data.date,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      supplierName: data.supplierName || null,
      isPaid: data.isPaid === "on",
    });

    setIsLoading(false);

    if (result.success) {
      router.push(`/charges/${params.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  if (isFetching) {
    return <div className="text-sm text-muted-foreground p-6">Chargement...</div>;
  }

  if (!charge) {
    return <div className="text-sm text-destructive p-6">Charge introuvable</div>;
  }

  const amountEuros = charge.amount.toFixed(2);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href={`/charges/${params.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Modifier la charge</h1>
          <p className="text-muted-foreground">
            {charge.building.name} — {charge.category.name}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Détails de la charge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                name="description"
                defaultValue={charge.description}
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Montant (€) *</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={amountEuros}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplierName">Fournisseur</Label>
                <Input
                  id="supplierName"
                  name="supplierName"
                  defaultValue={charge.supplierName ?? ""}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={toInputDate(charge.date)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodStart">Début de période *</Label>
                <Input
                  id="periodStart"
                  name="periodStart"
                  type="date"
                  defaultValue={toInputDate(charge.periodStart)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodEnd">Fin de période *</Label>
                <Input
                  id="periodEnd"
                  name="periodEnd"
                  type="date"
                  defaultValue={toInputDate(charge.periodEnd)}
                  required
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="isPaid"
                name="isPaid"
                type="checkbox"
                defaultChecked={charge.isPaid}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="isPaid" className="cursor-pointer">
                Charge réglée
              </Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href={`/charges/${params.id}`}>
            <Button variant="outline" type="button">
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
