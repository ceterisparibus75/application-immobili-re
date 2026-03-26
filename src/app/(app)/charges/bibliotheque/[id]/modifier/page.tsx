"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { updateSocietyChargeCategory } from "@/actions/charge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";

const NATURE_OPTIONS = [
  { value: "RECUPERABLE", label: "Récupérable" },
  { value: "PROPRIETAIRE", label: "Propriétaire" },
  { value: "MIXTE", label: "Mixte" },
];
const ALLOCATION_OPTIONS = [
  { value: "TANTIEME", label: "Tantièmes" },
  { value: "SURFACE", label: "Surface (m²)" },
  { value: "NB_LOTS", label: "Nombre de lots" },
  { value: "COMPTEUR", label: "Relevé de compteur" },
  { value: "PERSONNALISE", label: "Clé personnalisée" },
];

type CatData = {
  id: string;
  name: string;
  nature: string;
  recoverableRate: number | null;
  allocationMethod: string;
  description: string | null;
};

export default function ModifierBiblioCategoryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { activeSociety } = useSociety();
  const [cat, setCat] = useState<CatData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState("");
  const [nature, setNature] = useState("RECUPERABLE");

  useEffect(() => {
    async function fetchCat() {
      const res = await fetch(`/api/society-charge-categories/${params.id}`);
      if (res.ok) {
        const json = await res.json() as { data: CatData };
        setCat(json.data);
        setNature(json.data.nature);
      }
      setIsFetching(false);
    }
    void fetchCat();
  }, [params.id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) return;
    setError("");
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;
    const result = await updateSocietyChargeCategory(activeSociety.id, {
      id: params.id,
      name: data.name!,
      nature: data.nature as "PROPRIETAIRE" | "RECUPERABLE" | "MIXTE",
      recoverableRate: data.nature === "MIXTE" ? parseFloat(data.recoverableRate ?? "50") : null,
      allocationMethod: data.allocationMethod as "TANTIEME" | "SURFACE" | "NB_LOTS" | "COMPTEUR" | "PERSONNALISE",
      description: data.description || null,
    });
    setIsLoading(false);
    if (result.success) router.push("/charges/bibliotheque");
    else setError(result.error ?? "Erreur inconnue");
  }

  if (isFetching) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!cat) {
    return <div className="text-center py-12 text-muted-foreground">Catégorie introuvable</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/charges/bibliotheque">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Modifier la catégorie</h1>
          <p className="text-muted-foreground">{cat.name}</p>
        </div>
      </div>
      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Identification</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom *</Label>
              <Input id="name" name="name" defaultValue={cat.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} defaultValue={cat.description ?? ""} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Nature et répartition</CardTitle>
            <CardDescription>Clé de répartition par défaut lors de l&apos;import dans un immeuble.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nature">Nature *</Label>
                <NativeSelect
                  id="nature"
                  name="nature"
                  options={NATURE_OPTIONS}
                  defaultValue={cat.nature}
                  onChange={(e) => setNature(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="allocationMethod">Répartition</Label>
                <NativeSelect
                  id="allocationMethod"
                  name="allocationMethod"
                  options={ALLOCATION_OPTIONS}
                  defaultValue={cat.allocationMethod}
                />
              </div>
            </div>
            {nature === "MIXTE" && (
              <div className="space-y-2">
                <Label htmlFor="recoverableRate">Taux récupérable (%)</Label>
                <Input
                  id="recoverableRate"
                  name="recoverableRate"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  defaultValue={cat.recoverableRate ?? 50}
                  className="w-32"
                />
              </div>
            )}
          </CardContent>
        </Card>
        <div className="flex justify-end gap-3">
          <Link href="/charges/bibliotheque">
            <Button variant="outline" type="button">Annuler</Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement...</>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
