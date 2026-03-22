"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBuilding } from "@/actions/building";
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
import { BUILDING_TYPES } from "@/lib/constants";
import { ArrowLeft, Loader2, Upload, FileText, Sparkles, X, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";

type ExtractedLot = {
  number: string;
  lotType: string;
  area: number | null;
  floor: string | null;
  description: string | null;
};

type PdfAnalysisResult = {
  name?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  buildingType?: string | null;
  yearBuilt?: number | null;
  totalArea?: number | null;
  acquisitionPrice?: number | null;
  acquisitionDate?: string | null;
  description?: string | null;
  lots?: ExtractedLot[];
  error?: string;
};

type DuplicateMatch = {
  buildings: Array<{ id: string; name: string; addressLine1: string; city: string; matchReason: string }>;
  lots: Array<{ id: string; number: string; buildingName: string; matchReason: string }>;
};

export default function NouvelImmeubleePage() {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extractedLots, setExtractedLots] = useState<ExtractedLot[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateMatch | null>(null);
  const [analysisSuccess, setAnalysisSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handlePdfUpload(file: File) {
    setPdfFile(file);
    setError("");
    setIsAnalyzing(true);
    setAnalysisSuccess(false);
    setExtractedLots([]);
    setDuplicates(null);

    try {
      // Étape 1 : obtenir une URL d'upload signée (contourne la limite de taille Vercel)
      const uploadUrlRes = await fetch("/api/storage/signed-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      if (!uploadUrlRes.ok) {
        const err = await uploadUrlRes.json().catch(() => ({}));
        setError(err.error ?? "Erreur lors de la préparation de l'upload");
        setIsAnalyzing(false);
        return;
      }
      const { signedUrl, storagePath } = await uploadUrlRes.json() as { signedUrl: string; storagePath: string };

      // Étape 2 : upload direct vers Supabase Storage (bypasse le serveur Next.js)
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      if (!uploadRes.ok) {
        setError("Erreur lors de l'envoi du fichier vers le stockage");
        setIsAnalyzing(false);
        return;
      }

      // Étape 3 : demander l'analyse en passant uniquement le chemin de stockage
      const response = await fetch("/api/buildings/analyze-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Erreur lors de l'analyse");
        setIsAnalyzing(false);
        return;
      }

      const data = result.data as PdfAnalysisResult;

      if (data.error) {
        setError(data.error);
        setIsAnalyzing(false);
        return;
      }

      // Pre-remplir le formulaire
      const form = formRef.current;
      if (form) {
        const setValue = (name: string, value: string | number | null | undefined) => {
          const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
          if (el && value != null && value !== "") {
            el.value = String(value);
          }
        };

        setValue("name", data.name);
        setValue("addressLine1", data.addressLine1);
        setValue("addressLine2", data.addressLine2);
        setValue("city", data.city);
        setValue("postalCode", data.postalCode);
        setValue("yearBuilt", data.yearBuilt);
        setValue("totalArea", data.totalArea);
        setValue("acquisitionPrice", data.acquisitionPrice);
        setValue("description", data.description);

        if (data.acquisitionDate) {
          setValue("acquisitionDate", data.acquisitionDate);
        }

        // BuildingType
        if (data.buildingType) {
          const validTypes = BUILDING_TYPES.map((t) => t.value);
          const matched = validTypes.find((v) => v === data.buildingType);
          if (matched) {
            setValue("buildingType", matched);
          }
        }

        // Prix d'acquisition comme valeur comptable nette si pas d'autre info
        if (data.acquisitionPrice) {
          setValue("netBookValue", data.acquisitionPrice);
          setValue("marketValue", data.acquisitionPrice);
        }
      }

      // Stocker les lots extraits
      if (data.lots && data.lots.length > 0) {
        setExtractedLots(data.lots);
      }

      // Stocker les doublons détectés
      if (result.duplicates) {
        const d = result.duplicates as DuplicateMatch;
        if (d.buildings.length > 0 || d.lots.length > 0) {
          setDuplicates(d);
        }
      }

      setAnalysisSuccess(true);
    } catch {
      setError("Erreur lors de l'analyse du PDF");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        setError("Seuls les fichiers PDF sont acceptés");
        return;
      }
      handlePdfUpload(file);
    }
  }

  function removePdf() {
    setPdfFile(null);
    setExtractedLots([]);
    setAnalysisSuccess(false);
    setDuplicates(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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

    const result = await createBuilding(activeSociety.id, {
      name: data.name,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      city: data.city,
      postalCode: data.postalCode,
      country: data.country || "France",
      buildingType: data.buildingType as "BUREAU" | "COMMERCE" | "MIXTE" | "ENTREPOT",
      yearBuilt: data.yearBuilt ? parseInt(data.yearBuilt) : undefined,
      totalArea: data.totalArea ? parseFloat(data.totalArea) : undefined,
      marketValue: data.marketValue ? parseFloat(data.marketValue) : undefined,
      netBookValue: data.netBookValue ? parseFloat(data.netBookValue) : undefined,
      acquisitionPrice: data.acquisitionPrice ? parseFloat(data.acquisitionPrice) : undefined,
      acquisitionDate: data.acquisitionDate || undefined,
      description: data.description,
    });

    setIsLoading(false);

    if (result.success && result.data) {
      router.push(`/patrimoine/immeubles/${result.data.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/patrimoine/immeubles">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouvel immeuble</h1>
          <p className="text-muted-foreground">
            Ajoutez un immeuble à votre patrimoine
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Import PDF */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Import intelligent
          </CardTitle>
          <CardDescription>
            Importez l'acte d'acquisition (PDF) pour pré-remplir automatiquement le formulaire via l'IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!pdfFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Cliquez pour importer un PDF</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Acte d'acquisition, compromis de vente... (max 20 Mo)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{pdfFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(pdfFile.size / 1024 / 1024).toFixed(1)} Mo
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAnalyzing && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyse en cours...
                    </div>
                  )}
                  <Button variant="ghost" size="icon" onClick={removePdf} disabled={isAnalyzing}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {analysisSuccess && (
                <div className="rounded-md bg-green-100 dark:bg-green-900/30 p-3 text-sm text-green-800 dark:text-green-200">
                  Analyse terminée — les champs ont été pré-remplis. Vérifiez et complétez les informations ci-dessous.
                </div>
              )}

              {/* Alertes doublons */}
              {duplicates && duplicates.buildings.length > 0 && (
                <div className="rounded-md border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-900/20 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0" />
                    <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                      Immeubles similaires détectés
                    </p>
                  </div>
                  <div className="space-y-1.5 ml-6">
                    {duplicates.buildings.map((b) => (
                      <div key={b.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-orange-800 dark:text-orange-300">
                            <span className="font-medium">{b.name}</span> — {b.addressLine1}, {b.city}
                          </p>
                          <p className="text-xs text-orange-600 dark:text-orange-400">{b.matchReason}</p>
                        </div>
                        <Link href={`/patrimoine/immeubles/${b.id}`}>
                          <Badge variant="outline" className="cursor-pointer hover:bg-accent text-xs">
                            Voir l'immeuble
                          </Badge>
                        </Link>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-orange-600 dark:text-orange-400 ml-6">
                    Si cet immeuble existe déjà, utilisez le lien ci-dessus au lieu de le recréer.
                  </p>
                </div>
              )}

              {duplicates && duplicates.lots.length > 0 && (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-900/20 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                      Lots existants correspondants
                    </p>
                  </div>
                  <div className="space-y-1 ml-6">
                    {duplicates.lots.map((l) => (
                      <p key={l.id} className="text-sm text-yellow-800 dark:text-yellow-300">
                        Lot <span className="font-medium">{l.number}</span> — {l.matchReason}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        {/* Identification */}
        <Card>
          <CardHeader>
            <CardTitle>Identification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Nom de l'immeuble *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Ex: Immeuble Le Châtelet"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buildingType">Type *</Label>
                <Select
                  id="buildingType"
                  name="buildingType"
                  options={[...BUILDING_TYPES]}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yearBuilt">Année de construction</Label>
                <Input
                  id="yearBuilt"
                  name="yearBuilt"
                  type="number"
                  min={1800}
                  max={new Date().getFullYear()}
                  placeholder="Ex: 1985"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Adresse */}
        <Card>
          <CardHeader>
            <CardTitle>Adresse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="addressLine1">Adresse *</Label>
              <Input
                id="addressLine1"
                name="addressLine1"
                placeholder="Numéro et nom de rue"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine2">Complément d'adresse</Label>
              <Input
                id="addressLine2"
                name="addressLine2"
                placeholder="Bâtiment, étage..."
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Code postal *</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  maxLength={5}
                  placeholder="75001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ville *</Label>
                <Input id="city" name="city" required />
              </div>
            </div>
            <input type="hidden" name="country" value="France" />
          </CardContent>
        </Card>

        {/* Acquisition */}
        <Card>
          <CardHeader>
            <CardTitle>Acquisition</CardTitle>
            <CardDescription>Informations issues de l'acte d'acquisition</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="acquisitionPrice">Prix d'acquisition (€)</Label>
                <Input
                  id="acquisitionPrice"
                  name="acquisitionPrice"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acquisitionDate">Date d'acquisition</Label>
                <Input
                  id="acquisitionDate"
                  name="acquisitionDate"
                  type="date"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Valorisation */}
        <Card>
          <CardHeader>
            <CardTitle>Valorisation</CardTitle>
            <CardDescription>Informations financières et surfaces</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="totalArea">Surface totale (m²)</Label>
                <Input
                  id="totalArea"
                  name="totalArea"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marketValue">Valeur vénale (€)</Label>
                <Input
                  id="marketValue"
                  name="marketValue"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="netBookValue">Valeur comptable nette (€)</Label>
                <Input
                  id="netBookValue"
                  name="netBookValue"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="description">Description / Notes</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Informations complémentaires sur l'immeuble..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Lots extraits du PDF */}
        {extractedLots.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Lots détectés dans l'acte ({extractedLots.length})
              </CardTitle>
              <CardDescription>
                Ces lots seront créés automatiquement avec l'immeuble
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {extractedLots.map((lot, idx) => (
                  <div key={idx} className="flex items-center justify-between py-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">
                        Lot {lot.number}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {lot.lotType}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lot.area ? `${lot.area} m²` : ""}
                        {lot.floor ? ` — Étage ${lot.floor}` : ""}
                        {lot.description ? ` — ${lot.description}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Link href="/patrimoine/immeubles">
            <Button variant="outline" type="button">
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading || isAnalyzing}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Création...
              </>
            ) : (
              "Créer l'immeuble"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
