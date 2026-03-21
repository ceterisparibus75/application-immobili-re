"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { updateLot } from "@/actions/lot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LOT_TYPES, LOT_STATUSES } from "@/lib/constants";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";

type Lot = {
  id: string;
  number: string;
  lotType: string;
  area: number;
  commonShares: number | null;
  floor: string | null;
  position: string | null;
  description: string | null;
  status: string;
  marketRentValue: number | null;
  currentRent: number | null;
};

export default function ModifierLotPage() {
  const router = useRouter();
  const params = useParams<{ id: string; lotId: string }>();
  const { activeSociety } = useSociety();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState("");
  const [lot, setLot] = useState<Lot | null>(null);

  useEffect(() => {
    async function fetchLot() {
      try {
        const res = await fetch(`/api/lots/${params.lotId}`);
        if (res.ok) {
          const json = await res.json() as { data: Lot };
          setLot(json.data);
        }
      } finally {
        setIsFetching(false);
      }
    }
    void fetchLot();
  }, [params.lotId]);

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

    const result = await updateLot(activeSociety.id, {
      id: params.lotId,
      number: data.number,
      lotType: data.lotType as
        | "LOCAL_COMMERCIAL"
        | "BUREAUX"
        | "LOCAL_ACTIVITE"
        | "RESERVE"
        | "PARKING"
        | "CAVE"
        | "TERRASSE"
        | "ENTREPOT"
        | "APPARTEMENT",
      area: parseFloat(data.area),
      commonShares: data.commonShares ? parseInt(data.commonShares) : undefined,
      floor: data.floor,
      position: data.position,
      description: data.description,
      status: data.status as "OCCUPE" | "VACANT" | "EN_TRAVAUX" | "RESERVE",
      marketRentValue: data.marketRentValue ? parseFloat(data.marketRentValue) : undefined,
      currentRent: data.currentRent ? parseFloat(data.currentRent) : undefined,
    });

    setIsLoading(false);

    if (result.success) {
      router.push(`/patrimoine/immeubles/${params.id}/lots/${params.lotId}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Lot introuvable
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href={`/patrimoine/immeubles/${params.id}/lots/${params.lotId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Modifier le lot</h1>
          <p className="text-muted-foreground">Lot {lot.number}</p>
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
            <CardTitle>Identification du lot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="number">Numéro de lot *</Label>
                <Input
                  id="number"
                  name="number"
                  defaultValue={lot.number}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lotType">Type *</Label>
                <Select
                  id="lotType"
                  name="lotType"
                  options={[...LOT_TYPES]}
                  defaultValue={lot.lotType}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="floor">Étage</Label>
                <Input
                  id="floor"
                  name="floor"
                  defaultValue={lot.floor ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  name="position"
                  defaultValue={lot.position ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Statut</Label>
                <Select
                  id="status"
                  name="status"
                  options={[...LOT_STATUSES]}
                  defaultValue={lot.status}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Surface et charges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="area">Surface privative (m²) *</Label>
                <Input
                  id="area"
                  name="area"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={lot.area}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commonShares">Tantièmes</Label>
                <Input
                  id="commonShares"
                  name="commonShares"
                  type="number"
                  min={0}
                  defaultValue={lot.commonShares ?? ""}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Valeur locative</CardTitle>
            <CardDescription>Loyer pratiqué ou de marché</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="marketRentValue">
                  Valeur locative de marché (€ HT/mois)
                </Label>
                <Input
                  id="marketRentValue"
                  name="marketRentValue"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={lot.marketRentValue ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentRent">
                  Loyer pratiqué (€ HT/mois)
                </Label>
                <Input
                  id="currentRent"
                  name="currentRent"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={lot.currentRent ?? ""}
                />
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="description">Description / Notes</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                defaultValue={lot.description ?? ""}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link
            href={`/patrimoine/immeubles/${params.id}/lots/${params.lotId}`}
          >
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
