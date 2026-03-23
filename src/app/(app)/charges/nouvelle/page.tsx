"use client";

import { useState, useEffect, useRef } from "react";
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
import { ArrowLeft, Loader2, FileUp, Sparkles, CheckCircle2, X } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";
import { cn } from "@/lib/utils";

type BuildingOption = { id: string; name: string; city: string };
type CategoryOption = { id: string; name: string; nature: string };

type ParsedCharge = {
  description?: string | null;
  amount?: number | null;
  date?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  supplierName?: string | null;
  categoryHint?: string | null;
  invoiceNumber?: string | null;
  error?: string;
};

export default function NouvelleChargePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeSociety } = useSociety();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState(
    searchParams.get("buildingId") ?? ""
  );

  // PDF AI pre-fill
  const [pdfAnalyzing, setPdfAnalyzing] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfFileName, setPdfFileName] = useState("");
  const [aiPrefilled, setAiPrefilled] = useState(false);

  // Form values (controlled to support AI pre-fill)
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isPaid, setIsPaid] = useState(false);

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
      setCategoryId("");
      return;
    }
    async function fetchCategories() {
      const res = await fetch(`/api/charge-categories?buildingId=${selectedBuildingId}`);
      if (res.ok) {
        const json = await res.json() as { data: CategoryOption[] };
        setCategories(json.data);
      }
    }
    void fetchCategories();
  }, [selectedBuildingId]);

  async function handlePdfUpload(file: File) {
    setPdfAnalyzing(true);
    setPdfError("");
    setAiPrefilled(false);
    setPdfFileName(file.name);

    try {
      let storagePath: string;

      if (file.size > 4 * 1024 * 1024) {
        // Grands fichiers : upload direct vers Supabase
        const uploadUrlRes = await fetch("/api/storage/signed-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name }),
        });
        if (!uploadUrlRes.ok) {
          const { error: e } = await uploadUrlRes.json() as { error?: string };
          throw new Error(e ?? "Impossible de créer l'URL d'upload");
        }
        const { signedUrl, storagePath: sp } = await uploadUrlRes.json() as { signedUrl: string; storagePath: string };
        storagePath = sp;

        await fetch(signedUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/pdf" },
          body: file,
        });

        const analyzeRes = await fetch("/api/charges/analyze-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath }),
        });
        const json = await analyzeRes.json() as { data?: ParsedCharge; error?: string };
        if (!analyzeRes.ok || json.error) throw new Error(json.error ?? "Erreur d'analyse");
        applyParsedData(json.data!);
      } else {
        // Petits fichiers : envoi direct
        const formData = new FormData();
        formData.append("file", file);
        const analyzeRes = await fetch("/api/charges/analyze-pdf", {
          method: "POST",
          body: formData,
        });
        const json = await analyzeRes.json() as { data?: ParsedCharge; error?: string };
        if (!analyzeRes.ok || json.error) throw new Error(json.error ?? "Erreur d'analyse");
        applyParsedData(json.data!);
      }
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Erreur lors de l'analyse");
    } finally {
      setPdfAnalyzing(false);
    }
  }

  function applyParsedData(data: ParsedCharge) {
    if (data.error) {
      setPdfError(data.error);
      return;
    }
    if (data.description) setDescription(data.description);
    if (data.amount != null) setAmount(String(data.amount));
    if (data.date) setDate(data.date);
    if (data.periodStart) setPeriodStart(data.periodStart);
    if (data.periodEnd) setPeriodEnd(data.periodEnd);
    if (data.supplierName) setSupplierName(data.supplierName);
    setAiPrefilled(true);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) {
      setError("Aucune société sélectionnée");
      return;
    }

    setError("");
    setIsLoading(true);

    const result = await createCharge(activeSociety.id, {
      buildingId: selectedBuildingId,
      categoryId,
      description,
      amount: parseFloat(amount),
      date,
      periodStart,
      periodEnd,
      supplierName: supplierName || null,
      isPaid,
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

      {/* Zone import PDF IA */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Import intelligent par IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!pdfFileName && !pdfAnalyzing && (
            <div
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 px-6 py-8 text-center cursor-pointer hover:border-primary/40 hover:bg-accent/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file?.type === "application/pdf") void handlePdfUpload(file);
              }}
            >
              <FileUp className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Déposez une facture PDF</p>
              <p className="text-xs text-muted-foreground mt-1">
                L&apos;IA extrait automatiquement le montant, la date et le fournisseur
              </p>
              <Button variant="outline" size="sm" className="mt-3" type="button">
                Choisir un fichier
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handlePdfUpload(file);
                }}
              />
            </div>
          )}

          {pdfAnalyzing && (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Analyse en cours…</p>
                <p className="text-xs text-muted-foreground">{pdfFileName}</p>
              </div>
            </div>
          )}

          {!pdfAnalyzing && pdfFileName && (
            <div className={cn(
              "flex items-center gap-3 rounded-lg px-4 py-3",
              aiPrefilled ? "bg-green-500/10" : "bg-muted/50"
            )}>
              {aiPrefilled
                ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                : <FileUp className="h-4 w-4 text-muted-foreground shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{pdfFileName}</p>
                <p className="text-xs text-muted-foreground">
                  {aiPrefilled ? "Formulaire pré-rempli — vérifiez et complétez" : "Fichier chargé"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                type="button"
                onClick={() => {
                  setPdfFileName("");
                  setAiPrefilled(false);
                  setPdfError("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {pdfError && (
            <p className="mt-2 text-sm text-destructive">{pdfError}</p>
          )}
        </CardContent>
      </Card>

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
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
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
            <CardTitle className="flex items-center gap-2">
              Détail de la charge
              {aiPrefilled && (
                <span className="flex items-center gap-1 text-xs font-normal text-green-600 bg-green-500/10 rounded-full px-2 py-0.5">
                  <Sparkles className="h-3 w-3" />
                  Pré-rempli par IA
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Contrat d'entretien ascenseur"
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Montant TTC (€) *</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplierName">Fournisseur</Label>
                <Input
                  id="supplierName"
                  name="supplierName"
                  placeholder="Nom du prestataire"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="date">Date de la dépense *</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodStart">Début de période *</Label>
                <Input
                  id="periodStart"
                  name="periodStart"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodEnd">Fin de période *</Label>
                <Input
                  id="periodEnd"
                  name="periodEnd"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isPaid"
                name="isPaid"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
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
