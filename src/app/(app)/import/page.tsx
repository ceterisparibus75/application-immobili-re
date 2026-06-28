"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  Building2,
  Users,
  ScrollText,
  Loader2,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Bot,
  ExternalLink,
} from "lucide-react";
import { useSociety } from "@/providers/society-provider";
import { importFromPdf, type ImportInput, type ImportResult } from "@/actions/import";
import { AiConfirmDialog } from "@/components/ai-confirm-dialog";
import { getBuildings } from "@/actions/building";
import { getActiveTenants } from "@/actions/tenant-queries";
import { getLots } from "@/actions/lot";
import { cn } from "@/lib/utils";
import {
  type BuildingOption,
  type TenantOption,
  type LotOption,
  type ReviewForm,
  type ImmeubleForm,
  type LotForm,
  type LocataireForm,
  type BailForm,
  FREQ_PERIOD_LABELS,
} from "./_components/import-types";
import { emptyReview, aiToForm, tenantLabel } from "./_components/import-helpers";
import {
  SectionImmeuble,
  SectionLot,
  SectionLocataire,
  SectionBail,
  type AgencyOption,
} from "./_components/import-sections";

export default function ImportPage() {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const societyId = activeSociety?.id;

  const [step, setStep] = useState<"upload" | "review" | "success">("upload");
  const [isPending, startTransition] = useTransition();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [importError, setImportError] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ReviewForm>(emptyReview());
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [useExistingBuilding, setUseExistingBuilding] = useState(false);
  const [existingBuildingId, setExistingBuildingId] = useState("");
  const [useExistingLot, setUseExistingLot] = useState(false);
  const [existingLotId, setExistingLotId] = useState("");
  const [lots, setLots] = useState<LotOption[]>([]);
  const [useExistingTenant, setUseExistingTenant] = useState(false);
  const [existingTenantId, setExistingTenantId] = useState("");

  const [agencies, setAgencies] = useState<AgencyOption[]>([]);

  const [result, setResult] = useState<ImportResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Load buildings, tenants & lots
  useEffect(() => {
    if (!societyId) return;
    getBuildings(societyId).then((list) =>
      setBuildings(list.map((b) => ({ id: b.id, name: b.name, city: b.city })))
    );
    getActiveTenants(societyId).then(setTenants);
    getLots(societyId).then((list) =>
      setLots(list.map((l) => ({
        id: l.id,
        number: l.number,
        lotType: l.lotType,
        area: l.area,
        status: l.status,
        building: { id: l.building.id, name: l.building.name },
      })))
    );
    fetch("/api/contacts?type=AGENCE")
      .then((r) => r.json())
      .then((res) => setAgencies(res.data ?? []))
      .catch(() => {});
  }, [societyId]);

  // File handlers
  function handleFileSelect(selected: File | null) {
    if (!selected) return;
    if (selected.type !== "application/pdf") {
      setAnalyzeError("Seuls les fichiers PDF sont acceptés");
      return;
    }
    setFile(selected);
    setAnalyzeError("");
  }

  async function handleAnalyze() {
    if (!file || !societyId) return;
    setIsAnalyzing(true);
    setAnalyzeError("");

    try {
      // 1. Lire le fichier et le découper en chunks de 2.5 Mo (base64 ~3.3 Mo, reste sous 4.5 Mo Vercel)
      const CHUNK_SIZE = 2.5 * 1024 * 1024;
      const arrayBuffer = await file.arrayBuffer();
      const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);
      const uploadId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      let storagePath = "";

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength);
        const chunkBuffer = arrayBuffer.slice(start, end);
        const base64 = btoa(
          new Uint8Array(chunkBuffer).reduce((s, b) => s + String.fromCharCode(b), "")
        );

        const res = await fetch("/api/import/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            chunkIndex: i,
            totalChunks,
            data: base64,
            uploadId,
          }),
        });
        const text = await res.text();
        let result: Record<string, unknown>;
        try {
          result = JSON.parse(text);
        } catch {
          setAnalyzeError(`Erreur serveur upload chunk ${i + 1}/${totalChunks} : ${text.slice(0, 200)}`);
          return;
        }
        if (!res.ok) {
          setAnalyzeError((result.error as string) ?? `Erreur upload chunk ${i + 1}/${totalChunks}`);
          return;
        }
        if (result.storagePath) storagePath = result.storagePath as string;
      }

      if (!storagePath) {
        setAnalyzeError("Erreur : aucun chemin de stockage retourné");
        return;
      }

      // 2. Analyser via l'API (envoie seulement le chemin, pas le fichier)
      const analyzeRes = await fetch("/api/import/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath }),
      });
      const analyzeText = await analyzeRes.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(analyzeText);
      } catch {
        setAnalyzeError(`Erreur serveur analyse : ${analyzeText.slice(0, 200)}`);
        return;
      }
      if (!analyzeRes.ok) {
        setAnalyzeError((data.error as string) ?? "Erreur lors de l'analyse");
        return;
      }
      setForm(aiToForm(data as Record<string, unknown>));
      setStep("review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'analyse";
      setAnalyzeError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function updateImmeuble(updates: Partial<ImmeubleForm>) {
    setForm((f) => ({ ...f, immeuble: { ...f.immeuble, ...updates } }));
  }
  function updateLot(updates: Partial<LotForm>) {
    setForm((f) => ({ ...f, lot: { ...f.lot, ...updates } }));
  }
  function updateLocataire(updates: Partial<LocataireForm>) {
    setForm((f) => ({ ...f, locataire: { ...f.locataire, ...updates } }));
  }
  function updateBail(updates: Partial<BailForm>) {
    setForm((f) => ({ ...f, bail: { ...f.bail, ...updates } }));
  }

  function validateForm(): string | null {
    if (!useExistingBuilding) {
      if (!form.immeuble.name) return "Nom de l'immeuble requis";
      if (!form.immeuble.addressLine1) return "Adresse de l'immeuble requise";
      if (!form.immeuble.city) return "Ville requise";
      if (!form.immeuble.postalCode) return "Code postal requis";
    } else if (!existingBuildingId) {
      return "Sélectionner un immeuble existant";
    }
    if (!useExistingLot) {
      if (!form.lot.number) return "Numéro de lot requis";
      if (!form.lot.area || isNaN(parseFloat(form.lot.area))) return "Surface du lot requise";
    } else if (!existingLotId) {
      return "Sélectionner un lot existant";
    }
    if (!useExistingTenant) {
      if (!form.locataire.email) return "Email du locataire requis";
      if (form.locataire.entityType === "PERSONNE_MORALE" && !form.locataire.companyName) return "Raison sociale requise";
      if (form.locataire.entityType === "PERSONNE_PHYSIQUE" && (!form.locataire.firstName || !form.locataire.lastName)) return "Prénom et nom du locataire requis";
    } else if (!existingTenantId) {
      return "Sélectionner un locataire existant";
    }
    if (!form.bail.startDate) return "Date de début du bail requise";
    if (!form.bail.baseRentHT || isNaN(parseFloat(form.bail.baseRentHT))) return "Loyer HT requis";
    return null;
  }

  function doImport() {
    if (!societyId) return;
    setImportError("");

    const input: ImportInput = {
      building: {
        existingId: useExistingBuilding ? existingBuildingId : undefined,
        name: form.immeuble.name,
        addressLine1: form.immeuble.addressLine1,
        city: form.immeuble.city,
        postalCode: form.immeuble.postalCode,
        buildingType: form.immeuble.buildingType as ImportInput["building"]["buildingType"],
      },
      lot: {
        existingId: useExistingLot ? existingLotId : undefined,
        number: form.lot.number,
        lotType: form.lot.lotType as ImportInput["lot"]["lotType"],
        area: parseFloat(form.lot.area),
        floor: form.lot.floor || null,
        position: form.lot.position || null,
      },
      tenant: {
        existingId: useExistingTenant ? existingTenantId : undefined,
        entityType: form.locataire.entityType,
        companyName: form.locataire.companyName || null,
        companyLegalForm: form.locataire.companyLegalForm || null,
        siret: form.locataire.siret || null,
        legalRepName: form.locataire.legalRepName || null,
        legalRepTitle: form.locataire.legalRepTitle || null,
        legalRepEmail: form.locataire.legalRepEmail || null,
        legalRepPhone: form.locataire.legalRepPhone || null,
        firstName: form.locataire.firstName || null,
        lastName: form.locataire.lastName || null,
        email: form.locataire.email,
        phone: form.locataire.phone || null,
        mobile: form.locataire.mobile || null,
      },
      lease: {
        leaseType: form.bail.leaseType as ImportInput["lease"]["leaseType"],
        destination: (form.bail.destination || null) as ImportInput["lease"]["destination"],
        startDate: form.bail.startDate,
        durationMonths: parseInt(form.bail.durationMonths) || 108,
        baseRentHT: parseFloat(form.bail.baseRentHT),
        depositAmount: parseFloat(form.bail.depositAmount) || 0,
        paymentFrequency: form.bail.paymentFrequency as ImportInput["lease"]["paymentFrequency"],
        billingTerm: form.bail.billingTerm as ImportInput["lease"]["billingTerm"],
        vatApplicable: form.bail.vatApplicable,
        vatRate: parseFloat(form.bail.vatRate) || 20,
        indexType: (form.bail.indexType || null) as ImportInput["lease"]["indexType"],
        baseIndexValue: form.bail.baseIndexValue ? parseFloat(form.bail.baseIndexValue) : null,
        baseIndexQuarter: form.bail.baseIndexQuarter || null,
        fixedAnnualIndexationRate: form.bail.fixedAnnualIndexationRate ? parseFloat(form.bail.fixedAnnualIndexationRate) : null,
        billingAnchorMonth: form.bail.billingAnchorMonth ? parseInt(form.bail.billingAnchorMonth) : null,
        billingAnchorDay: form.bail.billingAnchorDay ? parseInt(form.bail.billingAnchorDay) : null,
        revisionFrequency: parseInt(form.bail.revisionFrequency) || 12,
        revisionDateBasis: (form.bail.revisionDateBasis || "DATE_SIGNATURE") as ImportInput["lease"]["revisionDateBasis"],
        revisionCustomMonth: form.bail.revisionCustomMonth ? parseInt(form.bail.revisionCustomMonth) : null,
        revisionCustomDay: form.bail.revisionCustomDay ? parseInt(form.bail.revisionCustomDay) : null,
        rentFreeMonths: parseInt(form.bail.rentFreeMonths) || 0,
        entryFee: parseFloat(form.bail.entryFee) || 0,
        tenantWorksClauses: form.bail.tenantWorksClauses || null,
        isThirdPartyManaged: form.bail.isThirdPartyManaged,
        managingContactId: form.bail.managingContactId || null,
        managementFeeType: form.bail.isThirdPartyManaged ? (form.bail.managementFeeType || null) as ImportInput["lease"]["managementFeeType"] : null,
        managementFeeValue: form.bail.isThirdPartyManaged ? (parseFloat(form.bail.managementFeeValue) || null) : null,
        managementFeeBasis: form.bail.isThirdPartyManaged ? (form.bail.managementFeeBasis || null) as ImportInput["lease"]["managementFeeBasis"] : null,
        managementFeeVatRate: form.bail.isThirdPartyManaged ? (parseFloat(form.bail.managementFeeVatRate) || 20) : null,
      },
    };

    startTransition(async () => {
      const res = await importFromPdf(societyId, input);
      if (res.success && res.data) {
        // Auto-attach the PDF to the documents module
        if (file) {
          try {
            const docFd = new FormData();
            docFd.append("file", file);
            docFd.append("category", "bail");
            docFd.append("leaseId", res.data.leaseId);
            docFd.append("lotId", res.data.lotId);
            docFd.append("description", `Bail importé par IA — ${file.name}`);
            await fetch("/api/documents/upload", { method: "POST", body: docFd });
          } catch {
            // Document upload is best-effort, don't block the import
          }
        }
        setResult(res.data);
        setStep("success");
      } else {
        setImportError(res.error ?? "Erreur lors de l'import");
      }
    });
  }

  function handleImport() {
    if (!societyId) return;
    const err = validateForm();
    if (err) { setImportError(err); return; }
    setImportError("");
    setConfirmOpen(true);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const tenantName = useExistingTenant
    ? tenants.find((t) => t.id === existingTenantId) ? tenantLabel(tenants.find((t) => t.id === existingTenantId)!) : ""
    : form.locataire.entityType === "PERSONNE_MORALE"
      ? form.locataire.companyName
      : `${form.locataire.firstName} ${form.locataire.lastName}`.trim();

  const buildingName = useExistingBuilding
    ? buildings.find((b) => b.id === existingBuildingId)?.name ?? ""
    : form.immeuble.name;

  return (
    <div className="space-y-6 max-w-5xl">
      <AiConfirmDialog
        open={confirmOpen}
        description="Bail extrait depuis le PDF"
        lines={[
          { label: "Immeuble", value: buildingName },
          { label: "Lot", value: form.lot.number ? `Lot ${form.lot.number} — ${form.lot.lotType}` : undefined },
          { label: "Surface", value: form.lot.area ? `${form.lot.area} m²` : undefined },
          { label: "Locataire", value: tenantName },
          { label: "Type de bail", value: form.bail.leaseType },
          { label: "Destination", value: form.bail.destination || undefined },
          { label: "Loyer HT", value: form.bail.baseRentHT ? `${parseFloat(form.bail.baseRentHT).toLocaleString("fr-FR")} € / ${FREQ_PERIOD_LABELS[form.bail.paymentFrequency] ?? "mois"}` : undefined },
          { label: "Début", value: form.bail.startDate },
          { label: "Durée", value: form.bail.durationMonths ? `${form.bail.durationMonths} mois` : undefined },
          { label: "Indice", value: form.bail.indexType || undefined },
          { label: "Indice de base", value: form.bail.baseIndexValue ? `${form.bail.baseIndexValue} (${form.bail.baseIndexQuarter || "?"})` : undefined },
        ]}
        onConfirm={() => { setConfirmOpen(false); doImport(); }}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Migration guidée par PDF</h1>
          <p className="text-muted-foreground text-sm">
            Reprenez un bail existant : l&apos;IA extrait les données, vous vérifiez, puis MyGestia crée immeuble, lot, locataire et bail.
          </p>
        </div>
        </div>
        <Button asChild variant="outline" className="gap-1.5 sm:mt-1">
          <Link href="/import/en-masse">
            <FileSpreadsheet className="h-4 w-4" />
            Import CSV / Excel
          </Link>
        </Button>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["upload", "review", "success"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
              step === s ? "bg-primary text-primary-foreground" :
              (["upload", "review", "success"].indexOf(step) > i)
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"
            )}>
              {i + 1}
            </div>
            <span className={cn(
              "text-xs",
              step === s ? "text-foreground font-medium" : "text-muted-foreground"
            )}>
              {s === "upload" ? "Importation PDF" : s === "review" ? "Vérification" : "Terminé"}
            </span>
            {i < 2 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <div className="space-y-4">
        <Card>
          <CardHeader className="pb-0">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-muted/35 p-4">
                <Building2 className="mb-3 h-5 w-5 text-primary" />
                <p className="text-sm font-medium">Structure reprise</p>
                <p className="mt-1 text-xs text-muted-foreground">Immeuble, lot et locataire sont préparés ensemble.</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/35 p-4">
                <Bot className="mb-3 h-5 w-5 text-primary" />
                <p className="text-sm font-medium">Extraction vérifiable</p>
                <p className="mt-1 text-xs text-muted-foreground">Aucune donnée n'est créée avant votre validation.</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/35 p-4">
                <ScrollText className="mb-3 h-5 w-5 text-primary" />
                <p className="text-sm font-medium">Premier bail opérationnel</p>
                <p className="mt-1 text-xs text-muted-foreground">Le bail débloque facturation, portail et reporting.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div
              className={cn(
                "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors cursor-pointer",
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/30"
              )}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFileSelect(e.dataTransfer.files[0] ?? null);
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <FileText className="h-12 w-12 text-primary" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} Mo
                  </p>
                  <Badge variant="outline">PDF sélectionné</Badge>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <Upload className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Glissez un PDF ou cliquez pour sélectionner</p>
                    <p className="text-sm text-muted-foreground mt-1">Bail commercial, dérogatoire ou précaire — max 15 Mo</p>
                  </div>
                </div>
              )}
            </div>

            {analyzeError && (
              <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {analyzeError}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button onClick={handleAnalyze} disabled={!file || isAnalyzing}>
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyse en cours…
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4" />
                    Analyser avec l&apos;IA
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Migration par tableur</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Importez en masse des locataires, contacts, immeubles ou lots depuis un fichier CSV ou Excel.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="gap-1.5">
              <Link href="/import/en-masse">
                Ouvrir l&apos;import en masse
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        </div>
      )}

      {/* ── Step 2: Review ── */}
      {step === "review" && (
        <>
          <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300">
            <Bot className="h-4 w-4 shrink-0" />
            Données extraites par l&apos;IA — vérifiez et corrigez si nécessaire avant d&apos;importer
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <SectionImmeuble
                form={form.immeuble}
                onChange={updateImmeuble}
                buildings={buildings}
                useExisting={useExistingBuilding}
                existingId={existingBuildingId}
                onToggleExisting={() => { setUseExistingBuilding((v) => !v); setExistingBuildingId(""); }}
                onExistingChange={setExistingBuildingId}
              />
              <SectionLot
                form={form.lot}
                onChange={updateLot}
                lots={useExistingBuilding && existingBuildingId
                  ? lots.filter((l) => l.building.id === existingBuildingId && l.status === "VACANT")
                  : lots.filter((l) => l.status === "VACANT")}
                useExisting={useExistingLot}
                existingId={existingLotId}
                onToggleExisting={() => { setUseExistingLot((v) => !v); setExistingLotId(""); }}
                onExistingChange={setExistingLotId}
              />
            </div>
            <div className="space-y-4">
              <SectionLocataire
                form={form.locataire}
                onChange={updateLocataire}
                tenants={tenants}
                useExisting={useExistingTenant}
                existingId={existingTenantId}
                onToggleExisting={() => { setUseExistingTenant((v) => !v); setExistingTenantId(""); }}
                onExistingChange={setExistingTenantId}
              />
              <SectionBail form={form.bail} onChange={updateBail} agencies={agencies} />
            </div>
          </div>

          {importError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {importError}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => { setStep("upload"); setImportError(""); }}>
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
            <Button onClick={handleImport} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {isPending ? "Import en cours…" : "Importer"}
            </Button>
          </div>
        </>
      )}

      {/* ── Step 3: Success ── */}
      {step === "success" && result && (
        <Card>
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-16 w-16 text-[var(--color-status-positive)]" />
              <div>
                <h2 className="text-xl font-bold">Import réalisé avec succès</h2>
                <p className="text-muted-foreground mt-1">
                  L&apos;immeuble, le lot, le locataire et le bail ont été créés
                </p>
              </div>
              <div className="flex flex-wrap gap-3 mt-2">
                <Link href={`/patrimoine/immeubles/${result.buildingId}`}>
                  <Button variant="outline" size="sm">
                    <Building2 className="h-4 w-4" />
                    Voir l&apos;immeuble
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Link href={`/locataires/${result.tenantId}`}>
                  <Button variant="outline" size="sm">
                    <Users className="h-4 w-4" />
                    Voir le locataire
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Link href={`/baux/${result.leaseId}`}>
                  <Button size="sm">
                    <ScrollText className="h-4 w-4" />
                    Voir le bail
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
              <Button
                variant="ghost"
                className="mt-2"
                onClick={() => {
                  setStep("upload");
                  setFile(null);
                  setForm(emptyReview());
                  setResult(null);
                  setUseExistingBuilding(false);
                  setUseExistingTenant(false);
                  setExistingBuildingId("");
                  setExistingTenantId("");
                }}
              >
                Importer un autre bail
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
