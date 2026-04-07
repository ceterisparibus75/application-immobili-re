"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBuilding } from "@/actions/building";
import { createLot } from "@/actions/lot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
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
import { ArrowLeft, Loader2, Upload, FileText, Sparkles, X, AlertTriangle, Calculator } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";
import { AiConfirmDialog } from "@/components/ai-confirm-dialog";
import type { AiConfirmLine } from "@/components/ai-confirm-dialog";

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
  // Champs valeur vénale (calcul en temps réel)
  const [acqPrice, setAcqPrice] = useState("");
  const [acqFees, setAcqFees] = useState("");
  const [acqTaxes, setAcqTaxes] = useState("");
  const [acqOther, setAcqOther] = useState("");
  const [worksCost, setWorksCost] = useState("");
  const acqTotal =
    (parseFloat(acqPrice) || 0) +
    (parseFloat(acqFees) || 0) +
    (parseFloat(acqTaxes) || 0) +
    (parseFloat(acqOther) || 0);
  const totalCost = acqTotal + (parseFloat(worksCost) || 0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<Parameters<typeof createBuilding>[1] | null>(null);
  const [confirmLines, setConfirmLines] = useState<AiConfirmLine[]>([]);
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
      let response: Response;

      if (file.size > 4 * 1024 * 1024) {
        // Grands fichiers (> 4 Mo) : upload via Supabase signé pour contourner la limite Vercel
        const uploadUrlRes = await fetch("/api/storage/signed-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name }),
        });
        if (!uploadUrlRes.ok) {
          const err = await uploadUrlRes.json().catch(() => ({})) as { error?: string };
          setError(err.error ?? "Erreur lors de la préparation de l'upload");
          setIsAnalyzing(false);
          return;
        }
        const { signedUrl, storagePath } = await uploadUrlRes.json() as { signedUrl: string; storagePath: string };

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

        response = await fetch("/api/buildings/analyze-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath }),
        });
      } else {
        // Petits fichiers (≤ 4 Mo) : envoi direct en multipart
        const formData = new FormData();
        formData.append("file", file);
        response = await fetch("/api/buildings/analyze-pdf", {
          method: "POST",
          body: formData,
        });
      }

      const rawText = await response.text();
      let result: { data?: PdfAnalysisResult; duplicates?: DuplicateMatch; error?: string };
      try {
        result = JSON.parse(rawText) as typeof result;
      } catch {
        console.error("[analyze-pdf] réponse non-JSON:", rawText.slice(0, 300));
        setError("Le serveur a renvoyé une réponse inattendue — réessayez");
        setIsAnalyzing(false);
        return;
      }

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
    } catch (err) {
      console.error("[handlePdfUpload]", err);
      setError(err instanceof Error ? err.message : "Erreur lors de l'analyse du PDF");
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

  async function doSave(input: Parameters<typeof createBuilding>[1]) {
    if (!activeSociety) return;
    setIsLoading(true);
    const result = await createBuilding(activeSociety.id, input);
    if (!result.success || !result.data) {
      setIsLoading(false);
      setError(result.error ?? "Erreur inconnue");
      return;
    }
    const buildingId = result.data.id;
    // Create extracted lots if any
    if (extractedLots.length > 0) {
      const lotTypeMap: Record<string, string> = {
        BUREAU: "BUREAUX", BUREAUX: "BUREAUX",
        LOCAL_ACTIVITE: "LOCAL_ACTIVITE", LOCAL_COMMERCIAL: "LOCAL_COMMERCIAL",
        APPARTEMENT: "APPARTEMENT", RESERVE: "RESERVE",
        PARKING: "PARKING", CAVE: "CAVE", TERRASSE: "TERRASSE", ENTREPOT: "ENTREPOT",
      };
      const lotErrors: string[] = [];
      for (let i = 0; i < extractedLots.length; i++) {
        const lot = extractedLots[i];
        const lotType = (lotTypeMap[lot.lotType] ?? "LOCAL_COMMERCIAL") as "LOCAL_COMMERCIAL" | "BUREAUX" | "LOCAL_ACTIVITE" | "APPARTEMENT" | "RESERVE" | "PARKING" | "CAVE" | "TERRASSE" | "ENTREPOT";
        const area = lot.area && lot.area > 0 ? lot.area : 1;
        const number = lot.number && lot.number.trim() ? lot.number.trim() : String(i + 1);
        const lotResult = await createLot(activeSociety.id, {
          buildingId,
          number,
          lotType,
          area,
          floor: lot.floor ?? undefined,
          description: lot.description ?? undefined,
          status: "VACANT",
          exploitationStatus: "INCONNU",
        });
        if (!lotResult.success) {
          lotErrors.push(`Lot ${number} : ${lotResult.error}`);
        }
      }
      if (lotErrors.length > 0) {
        console.warn("[doSave] Lots non créés :", lotErrors);
      }
    }
    setIsLoading(false);
    router.push(`/patrimoine/immeubles/${buildingId}`);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) {
      setError("Aucune société sélectionnée");
      return;
    }
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const aqPrice = parseFloat(data.acquisitionPrice) || 0;
    const aqFees = parseFloat(data.acquisitionFees) || 0;
    const aqTaxes = parseFloat(data.acquisitionTaxes) || 0;
    const aqOther = parseFloat(data.acquisitionOtherCosts) || 0;
    const totalAcq = aqPrice + aqFees + aqTaxes + aqOther;

    const input: Parameters<typeof createBuilding>[1] = {
      name: data.name,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      city: data.city,
      postalCode: data.postalCode,
      country: data.country || "France",
      buildingType: data.buildingType as "BUREAU" | "COMMERCE" | "MIXTE" | "ENTREPOT",
      yearBuilt: data.yearBuilt ? parseInt(data.yearBuilt) : undefined,
      totalArea: data.totalArea ? parseFloat(data.totalArea) : undefined,
      marketValue: totalAcq > 0 ? totalAcq : (data.marketValue ? parseFloat(data.marketValue) : undefined),
      netBookValue: data.netBookValue ? parseFloat(data.netBookValue) : undefined,
      acquisitionPrice: aqPrice || undefined,
      acquisitionFees: aqFees || undefined,
      acquisitionTaxes: aqTaxes || undefined,
      acquisitionOtherCosts: aqOther || undefined,
      acquisitionDate: data.acquisitionDate || undefined,
      worksCost: data.worksCost ? parseFloat(data.worksCost) : undefined,
      description: data.description,
    };

    // Si l'IA a été utilisée, demander confirmation avant sauvegarde
    if (analysisSuccess) {
      setPendingData(input);
      setConfirmLines([
        { label: "Nom", value: input.name },
        { label: "Adresse", value: input.addressLine1 },
        { label: "Ville", value: input.city ? `${input.postalCode} ${input.city}` : undefined },
        { label: "Type", value: input.buildingType },
        { label: "Surface", value: input.totalArea ? `${input.totalArea} m²` : undefined },
        { label: "Prix d'acquisition", value: input.acquisitionPrice ? `${input.acquisitionPrice.toLocaleString("fr-FR")} €` : undefined },
        { label: "Frais notaire / acte", value: input.acquisitionFees ? `${input.acquisitionFees.toLocaleString("fr-FR")} €` : undefined },
        { label: "Droits de mutation", value: input.acquisitionTaxes ? `${input.acquisitionTaxes.toLocaleString("fr-FR")} €` : undefined },
        { label: "Autres frais", value: input.acquisitionOtherCosts ? `${input.acquisitionOtherCosts.toLocaleString("fr-FR")} €` : undefined },
        { label: "Valeur vénale totale", value: input.marketValue ? `${input.marketValue.toLocaleString("fr-FR")} €` : undefined },
        { label: "Date d'acquisition", value: input.acquisitionDate },
        { label: "Lots à créer", value: extractedLots.length > 0 ? `${extractedLots.length} lot(s)` : undefined },
      ]);
      setConfirmOpen(true);
      return;
    }

    await doSave(input);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <AiConfirmDialog
        open={confirmOpen}
        lines={confirmLines}
        description="Les champs ont été pré-remplis depuis l'acte d'acquisition"
        onConfirm={async () => {
          setConfirmOpen(false);
          if (pendingData) await doSave(pendingData);
        }}
        onCancel={() => setConfirmOpen(false)}
      />

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
                <div className="rounded-md bg-[var(--color-status-positive-bg)] p-3 text-sm text-[var(--color-status-positive)]">
                  Analyse terminée — les champs ont été pré-remplis. Vérifiez et complétez les informations ci-dessous.
                </div>
              )}

              {/* Alertes doublons */}
              {duplicates && duplicates.buildings.length > 0 && (
                <div className="rounded-md border border-[var(--color-status-caution)]/30 bg-[var(--color-status-caution-bg)] p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[var(--color-status-caution)] shrink-0" />
                    <p className="text-sm font-medium text-[var(--color-status-caution)]">
                      Immeubles similaires détectés
                    </p>
                  </div>
                  <div className="space-y-1.5 ml-6">
                    {duplicates.buildings.map((b) => (
                      <div key={b.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[var(--color-status-caution)]">
                            <span className="font-medium">{b.name}</span> — {b.addressLine1}, {b.city}
                          </p>
                          <p className="text-xs text-[var(--color-status-caution)]">{b.matchReason}</p>
                        </div>
                        <Link href={`/patrimoine/immeubles/${b.id}`}>
                          <Badge variant="outline" className="cursor-pointer hover:bg-accent text-xs">
                            Voir l'immeuble
                          </Badge>
                        </Link>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--color-status-caution)] ml-6">
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
                <NativeSelect
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

        {/* Acquisition + Valeur vénale */}
        <Card>
          <CardHeader>
            <CardTitle>Acquisition</CardTitle>
            <CardDescription>Informations issues de l'acte d'acquisition</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="acquisitionDate">Date d'acquisition</Label>
                <Input id="acquisitionDate" name="acquisitionDate" type="date" />
              </div>
            </div>

            <Separator />

            {/* Détail valeur vénale */}
            <div className="space-y-1">
              <p className="text-sm font-medium flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                Valeur vénale — détail
              </p>
              <p className="text-xs text-muted-foreground">
                Le total est calculé automatiquement et enregistré comme valeur vénale du bien.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="acquisitionPrice">Prix d'acquisition (€)</Label>
                <Input
                  id="acquisitionPrice"
                  name="acquisitionPrice"
                  type="number"
                  step={0.01}
                  placeholder="0.00"
                  value={acqPrice}
                  onChange={(e) => setAcqPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acquisitionFees">Frais de notaire / frais d'acte (€)</Label>
                <Input
                  id="acquisitionFees"
                  name="acquisitionFees"
                  type="number"
                  step={0.01}
                  placeholder="0.00"
                  value={acqFees}
                  onChange={(e) => setAcqFees(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acquisitionTaxes">Droits de mutation / taxes (€)</Label>
                <Input
                  id="acquisitionTaxes"
                  name="acquisitionTaxes"
                  type="number"
                  step={0.01}
                  placeholder="0.00"
                  value={acqTaxes}
                  onChange={(e) => setAcqTaxes(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acquisitionOtherCosts">Autres frais (€)</Label>
                <Input
                  id="acquisitionOtherCosts"
                  name="acquisitionOtherCosts"
                  type="number"
                  step={0.01}
                  placeholder="0.00"
                  value={acqOther}
                  onChange={(e) => setAcqOther(e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Coût des travaux */}
            <div className="space-y-2">
              <Label htmlFor="worksCost">Coût des travaux (€)</Label>
              <Input
                id="worksCost"
                name="worksCost"
                type="number"
                step={0.01}
                placeholder="0.00"
                value={worksCost}
                onChange={(e) => setWorksCost(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Montant total des travaux réalisés sur l'immeuble</p>
            </div>

            {/* Totaux calculés */}
            <div className="space-y-2">
              <div className="rounded-md bg-muted/50 border p-4 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Coût d'acquisition</span>
                <span className="text-base font-semibold tabular-nums">
                  {acqTotal > 0
                    ? acqTotal.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
                    : "—"}
                </span>
              </div>
              <div className="rounded-md bg-primary/5 border border-primary/20 p-4 flex items-center justify-between">
                <span className="text-sm font-medium">Coût complet (acquisition + travaux)</span>
                <span className="text-lg font-bold text-primary">
                  {totalCost > 0
                    ? totalCost.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
                    : "—"}
                </span>
              </div>
            </div>
            {/* Champ caché transmis au formulaire */}
            <input type="hidden" name="marketValue" value={acqTotal > 0 ? acqTotal : ""} />
          </CardContent>
        </Card>

        {/* Valorisation complémentaire */}
        <Card>
          <CardHeader>
            <CardTitle>Valorisation complémentaire</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
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
