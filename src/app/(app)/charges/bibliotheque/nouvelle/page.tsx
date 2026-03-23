"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSocietyChargeCategory } from "@/actions/charge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";

const NATURE_OPTIONS = [
  { value: "RECUPERABLE", label: "Récupérable (refacturée aux locataires)" },
  { value: "PROPRIETAIRE", label: "Propriétaire (non récupérable)" },
  { value: "MIXTE", label: "Mixte (taux de récupération partiel)" },
];
const ALLOCATION_OPTIONS = [
  { value: "TANTIEME", label: "Tantièmes" },
  { value: "SURFACE", label: "Surface (m²)" },
  { value: "NB_LOTS", label: "Nombre de lots" },
  { value: "COMPTEUR", label: "Relevé de compteur" },
  { value: "PERSONNALISE", label: "Clé personnalisée" },
];

export default function NouvelleBiblioCategoryPage() {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [nature, setNature] = useState("RECUPERABLE");

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
    const result = await createSocietyChargeCategory(activeSociety.id, {
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/charges/bibliotheque">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouvelle catégorie</h1>
          <p className="text-muted-foreground">Ajouter à la bibliothèque de charges de la société</p>
        </div>
      </div>
      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Identification</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom *</Label>
              <Input id="name" name="name" placeholder="Ex : Entretien ascenseur, Eau froide, Électricité..." required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} placeholder="Détail optionnel..." />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Nature et répartition</CardTitle>
            <CardDescription>Définit la récupération et la clé de répartition par défaut.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nature">Nature *</Label>
                <Select
                  id="nature"
                  name="nature"
                  options={NATURE_OPTIONS}
                  defaultValue="RECUPERABLE"
                  onChange={(e) => setNature(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="allocationMethod">Répartition</Label>
                <Select
                  id="allocationMethod"
                  name="allocationMethod"
                  options={ALLOCATION_OPTIONS}
                  defaultValue="TANTIEME"
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
                  defaultValue={50}
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
              <><Loader2 className="h-4 w-4 animate-spin" />Création...</>
            ) : (
              "Créer la catégorie"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
