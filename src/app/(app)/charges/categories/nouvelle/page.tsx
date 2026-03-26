"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createChargeCategory } from "@/actions/charge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ArrowLeft, Loader2, BookOpen } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";

const NATURE_OPTIONS = [
  { value: "RECUPERABLE", label: "Récupérable (refacturée aux locataires)" },
  { value: "PROPRIETAIRE", label: "Propriétaire (non récupérable)" },
  { value: "MIXTE", label: "Mixte (taux de récupération à définir)" },
];

const ALLOCATION_OPTIONS = [
  { value: "TANTIEME", label: "Tantièmes" },
  { value: "SURFACE", label: "Surface (m²)" },
  { value: "NB_LOTS", label: "Nombre de lots" },
  { value: "COMPTEUR", label: "Relevé de compteur" },
  { value: "PERSONNALISE", label: "Clé personnalisée" },
];

type BuildingOption = { id: string; name: string; city: string };
type LibraryCat = { id: string; name: string; nature: string; allocationMethod: string; recoverableRate: number | null; description: string | null };

export default function NouvelleCategorieChargePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeSociety } = useSociety();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [libraryCategories, setLibraryCategories] = useState<LibraryCat[]>([]);
  const [nature, setNature] = useState("RECUPERABLE");
  const [selectedLibCatId, setSelectedLibCatId] = useState("");

  const defaultBuildingId = searchParams.get("buildingId") ?? "";

  useEffect(() => {
    async function fetchData() {
      const [buildingsRes, libRes] = await Promise.all([
        fetch("/api/buildings"),
        fetch("/api/society-charge-categories"),
      ]);
      if (buildingsRes.ok) {
        const json = await buildingsRes.json() as { data: BuildingOption[] };
        setBuildings(json.data);
      }
      if (libRes.ok) {
        const json = await libRes.json() as { data: LibraryCat[] };
        setLibraryCategories(json.data);
      }
    }
    void fetchData();
  }, []);

  function applyLibraryCategory(catId: string) {
    const cat = libraryCategories.find((c) => c.id === catId);
    if (cat) {
      setNature(cat.nature);
      setSelectedLibCatId(catId);
    }
  }

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

    const result = await createChargeCategory(activeSociety.id, {
      buildingId: data.buildingId!,
      name: data.name!,
      nature: data.nature as "PROPRIETAIRE" | "RECUPERABLE" | "MIXTE",
      recoverableRate: parseFloat(data.recoverableRate ?? "100"),
      allocationMethod: data.allocationMethod as
        | "TANTIEME"
        | "SURFACE"
        | "NB_LOTS"
        | "COMPTEUR"
        | "PERSONNALISE",
      description: data.description || null,
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
          <h1 className="text-2xl font-bold tracking-tight">
            Nouvelle catégorie de charge
          </h1>
          <p className="text-muted-foreground">
            Définir un type de charge et sa méthode de répartition
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {libraryCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookOpen className="h-4 w-4" />Importer depuis la bibliothèque</CardTitle>
            <CardDescription>Pré-remplir le formulaire à partir d&apos;une catégorie de la bibliothèque société.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <select
                value={selectedLibCatId}
                onChange={(e) => applyLibraryCategory(e.target.value)}
                className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Sélectionner une catégorie...</option>
                {libraryCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Catégorie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="buildingId">Immeuble *</Label>
              <select
                id="buildingId"
                name="buildingId"
                defaultValue={defaultBuildingId}
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
              <Label htmlFor="name">Nom de la catégorie *</Label>
              <Input
                id="name"
                name="name"
                placeholder="Ex: Entretien ascenseur, Eau, Électricité parties communes..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                placeholder="Description optionnelle..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nature et répartition</CardTitle>
            <CardDescription>
              Définit si la charge est refacturée aux locataires et comment elle
              est répartie.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nature">Nature *</Label>
                <NativeSelect
                  id="nature"
                  name="nature"
                  options={NATURE_OPTIONS}
                  defaultValue="RECUPERABLE"
                  onChange={(e) => setNature(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="allocationMethod">Méthode de répartition</Label>
                <NativeSelect
                  id="allocationMethod"
                  name="allocationMethod"
                  options={ALLOCATION_OPTIONS}
                  defaultValue="TANTIEME"
                />
              </div>
            </div>

            {nature === "MIXTE" && (
              <div className="space-y-2">
                <Label htmlFor="recoverableRate">
                  Taux récupérable (%)
                </Label>
                <Input
                  id="recoverableRate"
                  name="recoverableRate"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  defaultValue={50}
                  className="w-32"
                />
              </div>
            )}
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
                Création...
              </>
            ) : (
              "Créer la catégorie"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
