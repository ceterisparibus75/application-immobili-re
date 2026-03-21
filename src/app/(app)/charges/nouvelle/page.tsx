"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createCharge } from "@/actions/charge";
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

type BuildingOption = { id: string; name: string; city: string };
type CategoryOption = { id: string; name: string; nature: string };

export default function NouvelleChargePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeSociety } = useSociety();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState(
    searchParams.get("buildingId") ?? ""
  );

  useEffect(() => {
    async function fetchBuildings() {
      const res = await fetch("/api/buildings");
      if (res.ok) {
        const json = await res.json() as { data: BuildingOption[] };
        setBuildings(json.data);
      }
    }
    void fetchBuildings();
  }, []);

  useEffect(() => {
    if (!selectedBuildingId) {
      setCategories([]);
      return;
    }
    async function fetchCategories() {
      const res = await fetch(
        `/api/charge-categories?buildingId=${selectedBuildingId}`
      );
      if (res.ok) {
        const json = await res.json() as { data: CategoryOption[] };
        setCategories(json.data);
      }
    }
    void fetchCategories();
  }, [selectedBuildingId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) {
      setError("Aucune société sélectionnée");
      return;
    }

    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const result = await createCharge(activeSociety.id, {
      buildingId: data.buildingId!,
      categoryId: data.categoryId!,
      description: data.description!,
      amount: parseFloat(data.amount!),
      date: data.date!,
      periodStart: data.periodStart!,
      periodEnd: data.periodEnd!,
      supplierName: data.supplierName || null,
      isPaid: data.isPaid === "on",
    });

    setIsLoading(false);

    if (result.success) {
      router.push("/charges");
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/charges">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouvelle charge</h1>
          <p className="text-muted-foreground">
            Enregistrer une dépense d&apos;immeuble
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
            <CardTitle>Immeuble et catégorie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="buildingId">Immeuble *</Label>
              <select
                id="buildingId"
                name="buildingId"
                value={selectedBuildingId}
                onChange={(e) => setSelectedBuildingId(e.target.value)}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Sélectionner un immeuble...</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.city}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">Catégorie *</Label>
              <select
                id="categoryId"
                name="categoryId"
                required
                disabled={!selectedBuildingId}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <option value="">
                  {selectedBuildingId
                    ? categories.length === 0
                      ? "Aucune catégorie — créez-en une d'abord"
                      : "Sélectionner une catégorie..."
                    : "Sélectionnez d'abord un immeuble"}
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {selectedBuildingId && categories.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  <Link
                    href={`/charges/categories/nouvelle?buildingId=${selectedBuildingId}`}
                    className="underline"
                  >
                    Créer une catégorie de charge
                  </Link>{" "}
                  pour cet immeuble.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Détail de la charge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                name="description"
                placeholder="Ex: Contrat d'entretien ascenseur"
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
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplierName">Fournisseur</Label>
                <Input
                  id="supplierName"
                  name="supplierName"
                  placeholder="Nom du prestataire"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="date">Date de la dépense *</Label>
                <Input id="date" name="date" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodStart">Début de période *</Label>
                <Input id="periodStart" name="periodStart" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodEnd">Fin de période *</Label>
                <Input id="periodEnd" name="periodEnd" type="date" required />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isPaid"
                name="isPaid"
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="isPaid">Dépense réglée</Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/charges">
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
              "Enregistrer la charge"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
