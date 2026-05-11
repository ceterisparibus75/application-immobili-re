"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { ArrowRight, FileSearch, FileText, Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createLeaseAmendment } from "@/actions/lease-amendment";
import { formatCurrency, formatDate } from "@/lib/utils";

const AMENDMENT_TYPES = [
  { value: "RENOUVELLEMENT", label: "Renouvellement" },
  { value: "AVENANT_LOYER", label: "Avenant loyer" },
  { value: "AVENANT_DUREE", label: "Avenant duree" },
  { value: "AVENANT_LOT", label: "Avenant lots" },
  { value: "AVENANT_DIVERS", label: "Avenant divers" },
  { value: "RESILIATION", label: "Resiliation" },
] as const;

type AmendmentType = (typeof AMENDMENT_TYPES)[number]["value"];

type AmendmentData = {
  id: string;
  amendmentNumber: number;
  effectiveDate: Date;
  description: string;
  amendmentType: string;
  previousRentHT: number | null;
  newRentHT: number | null;
  previousEndDate: Date | null;
  newEndDate: Date | null;
  createdAt: Date;
  documentId: string | null;
  document: { id: string; fileName: string; fileUrl: string; storagePath: string | null } | null;
  otherChanges: unknown;
};

type AmendmentDocument = {
  id: string;
  fileName: string;
  fileUrl: string;
  storagePath: string | null;
  description: string | null;
  createdAt: Date;
};

type LeaseDocument = {
  id: string;
  fileName: string;
  category: string | null;
  storagePath: string | null;
  fileUrl: string;
};

type SignedAmendmentAnalysis = {
  amendmentType?: string | null;
  effectiveDate?: string | null;
  description?: string | null;
  newRentHT?: number | null;
  newEndDate?: string | null;
  otherChangesSummary?: string | null;
};

function getBadgeVariant(type: string): "default" | "secondary" | "destructive" {
  if (type === "RESILIATION") return "destructive";
  if (type === "RENOUVELLEMENT") return "default";
  return "secondary";
}

function isAmendmentType(value: string): value is AmendmentType {
  return AMENDMENT_TYPES.some((type) => type.value === value);
}

function defaultDescription(type: AmendmentType) {
  switch (type) {
    case "RENOUVELLEMENT": return "Renouvellement du bail";
    case "AVENANT_LOYER": return "Modification du loyer";
    case "AVENANT_DUREE": return "Modification de la duree du bail";
    case "AVENANT_LOT": return "Modification des lots du bail";
    case "RESILIATION": return "Resiliation du bail";
    default: return "Avenant au bail";
  }
}

function DocumentPickerField({
  value,
  onChange,
  leaseDocuments,
}: {
  value: string;
  onChange: (v: string) => void;
  leaseDocuments: LeaseDocument[];
}) {
  const options = [
    { value: "", label: "— Aucun document GED —" },
    ...leaseDocuments.map((d) => ({
      value: d.id,
      label: `${d.fileName}${d.category ? ` [${d.category}]` : ""}`,
    })),
  ];
  return (
    <div>
      <Label>Lier a un document existant (GED)</Label>
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)} options={options} />
      <p className="mt-1 text-xs text-muted-foreground">
        Rattache un document deja archive dans la base documentaire du bail.
      </p>
    </div>
  );
}

export function LeaseAmendments({
  amendments,
  amendmentDocuments,
  leaseDocuments,
  leaseId,
  societyId,
  isActive,
  currentRentHT,
  tenantId,
  primaryLotId,
}: {
  amendments: AmendmentData[];
  amendmentDocuments: AmendmentDocument[];
  leaseDocuments: LeaseDocument[];
  leaseId: string;
  societyId: string;
  isActive: boolean;
  currentRentHT: number;
  tenantId: string;
  primaryLotId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signedOpen, setSignedOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signedLoading, setSignedLoading] = useState(false);
  const [amendmentType, setAmendmentType] = useState<AmendmentType>("AVENANT_LOYER");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [newRentHT, setNewRentHT] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDocId, setSelectedDocId] = useState("");
  const [signedPdfFile, setSignedPdfFile] = useState<File | null>(null);
  const [isAnalyzingPdf, setIsAnalyzingPdf] = useState(false);
  const [analysisHint, setAnalysisHint] = useState("");
  const [signedDocId, setSignedDocId] = useState("");

  const showRent = ["AVENANT_LOYER", "RENOUVELLEMENT"].includes(amendmentType);
  const showEndDate = ["AVENANT_DUREE", "RENOUVELLEMENT"].includes(amendmentType);
  const documentsByAmendmentNumber = new Map<number, AmendmentDocument>();

  for (const document of amendmentDocuments) {
    const match = document.description?.match(/Avenant\s+(\d+)\s+signe/i);
    const amendmentNumber = match ? Number.parseInt(match[1] ?? "", 10) : Number.NaN;
    if (!Number.isNaN(amendmentNumber) && !documentsByAmendmentNumber.has(amendmentNumber)) {
      documentsByAmendmentNumber.set(amendmentNumber, document);
    }
  }

  function resetForm() {
    setAmendmentType("AVENANT_LOYER");
    setEffectiveDate("");
    setNewRentHT("");
    setNewEndDate("");
    setDescription("");
    setSelectedDocId("");
    setSignedPdfFile(null);
    setAnalysisHint("");
    setIsAnalyzingPdf(false);
    setSignedDocId("");
  }

  function applySignedAmendmentAnalysis(analysis: SignedAmendmentAnalysis) {
    const nextType = analysis.amendmentType && isAmendmentType(analysis.amendmentType)
      ? analysis.amendmentType
      : "AVENANT_DIVERS";

    setAmendmentType(nextType);
    setEffectiveDate(analysis.effectiveDate ?? "");
    setNewRentHT(
      analysis.newRentHT !== null && analysis.newRentHT !== undefined
        ? String(analysis.newRentHT)
        : ""
    );
    setNewEndDate(analysis.newEndDate ?? "");

    const nextDescription = [
      analysis.description?.trim(),
      analysis.otherChangesSummary?.trim(),
    ]
      .filter(Boolean)
      .join(" — ");

    setDescription(nextDescription || defaultDescription(nextType));

    const hints: string[] = [];
    hints.push(AMENDMENT_TYPES.find((t) => t.value === nextType)?.label ?? nextType);
    if (analysis.effectiveDate) hints.push(`effet ${analysis.effectiveDate}`);
    if (analysis.newRentHT !== null && analysis.newRentHT !== undefined) {
      hints.push(`nouveau loyer ${analysis.newRentHT} euro`);
    }
    if (analysis.newEndDate) hints.push(`echeance ${analysis.newEndDate}`);

    setAnalysisHint(
      hints.length > 0
        ? `Analyse IA terminee : ${hints.join(", ")}.`
        : "Analyse IA terminee. Verifiez les informations proposees."
    );
  }

  function blobToBase64(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") { reject(new Error("Conversion du PDF impossible")); return; }
        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = () => reject(reader.error ?? new Error("Lecture du PDF impossible"));
      reader.readAsDataURL(blob);
    });
  }

  async function uploadPdfForAnalysis(file: File) {
    const chunkSize = 2.5 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);
    const uploadId = crypto.randomUUID();
    let storagePath = "";

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      const data = await blobToBase64(chunk);

      const response = await fetch("/api/import/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, chunkIndex, totalChunks, data, uploadId }),
      });

      const payload = (await response.json().catch(() => ({}))) as { storagePath?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Import temporaire du PDF impossible");
      if (payload.storagePath) storagePath = payload.storagePath;
    }

    if (!storagePath) throw new Error("Aucun chemin temporaire retourne pour l'analyse");
    return storagePath;
  }

  async function analyzeSignedAmendment(file: File) {
    setIsAnalyzingPdf(true);
    setAnalysisHint("");
    try {
      const storagePath = await uploadPdfForAnalysis(file);
      const response = await fetch("/api/lease-amendments/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath, leaseId }),
      });
      const payload = (await response.json().catch(() => ({}))) as SignedAmendmentAnalysis | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error ?? "Analyse impossible" : "Analyse impossible");
      }
      applySignedAmendmentAnalysis(payload as SignedAmendmentAnalysis);
      toast.success("Analyse IA terminee. Les champs ont ete preremphis.");
    } catch (error) {
      setAnalysisHint("");
      toast.error(error instanceof Error ? error.message : "L'analyse IA a echoue");
    } finally {
      setIsAnalyzingPdf(false);
    }
  }

  async function uploadSignedAmendmentDocument(file: File, amendmentNumber: number) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", "avenant");
    formData.append("description", `Avenant ${amendmentNumber} signe`);
    formData.append("leaseId", leaseId);
    formData.append("tenantId", tenantId);
    formData.append("lotId", primaryLotId);
    const response = await fetch("/api/documents/upload", { method: "POST", body: formData });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Archivage du PDF signe impossible");
  }

  async function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!effectiveDate || !description) { toast.error("Veuillez remplir les champs obligatoires"); return; }
    setLoading(true);
    const result = await createLeaseAmendment(societyId, {
      leaseId,
      effectiveDate,
      description,
      amendmentType,
      newRentHT: newRentHT ? parseFloat(newRentHT) : undefined,
      newEndDate: newEndDate || undefined,
      documentId: selectedDocId || undefined,
    });
    setLoading(false);
    if (result.success) {
      toast.success("Avenant cree avec succes");
      setOpen(false);
      resetForm();
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  async function handleSignedSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signedPdfFile) { toast.error("Ajoutez le PDF signe de l'avenant"); return; }
    if (!effectiveDate || !description) { toast.error("Veuillez remplir les champs obligatoires"); return; }
    setSignedLoading(true);
    const result = await createLeaseAmendment(societyId, {
      leaseId,
      effectiveDate,
      description,
      amendmentType,
      newRentHT: newRentHT ? parseFloat(newRentHT) : undefined,
      newEndDate: newEndDate || undefined,
      documentId: signedDocId || undefined,
    });
    if (!result.success || !result.data) {
      setSignedLoading(false);
      toast.error(result.error ?? "Erreur lors de la creation de l'avenant");
      return;
    }
    try {
      await uploadSignedAmendmentDocument(signedPdfFile, result.data.amendmentNumber);
      toast.success("Avenant signe ajoute et archive avec succes");
      setSignedOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Avenant cree, mais le PDF signe n'a pas pu etre archive");
      router.refresh();
    } finally {
      setSignedLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Avenants</h2>
        {isActive && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Avenant signe avec IA */}
            <Dialog
              open={signedOpen}
              onOpenChange={(nextOpen) => { setSignedOpen(nextOpen); if (!nextOpen) resetForm(); }}
            >
              <DialogTrigger asChild>
                <Button variant="default" size="sm" className="gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Avenant signe
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[560px]">
                <DialogHeader><DialogTitle>Ajouter un avenant signe</DialogTitle></DialogHeader>
                <form onSubmit={handleSignedSubmit} className="space-y-4">
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <Label htmlFor="signed-amendment-pdf">PDF signe de l&apos;avenant</Label>
                    <Input
                      id="signed-amendment-pdf"
                      type="file"
                      accept="application/pdf"
                      className="mt-2"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setSignedPdfFile(file);
                        if (file) void analyzeSignedAmendment(file);
                        else setAnalysisHint("");
                      }}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Le PDF sera analyse par l&apos;IA, puis archive dans les documents du bail.
                    </p>
                    {isAnalyzingPdf && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Analyse IA en cours...
                      </div>
                    )}
                    {!isAnalyzingPdf && analysisHint && (
                      <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
                        {analysisHint}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Type</Label>
                    <NativeSelect
                      value={amendmentType}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAmendmentType(isAmendmentType(v) ? v : "AVENANT_DIVERS");
                      }}
                      options={AMENDMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                    />
                  </div>
                  <div>
                    <Label>Date d&apos;effet</Label>
                    <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} required />
                  </div>
                  {showRent && (
                    <div>
                      <Label>Nouveau loyer HT (actuel : {formatCurrency(currentRentHT)})</Label>
                      <Input type="number" step="0.01" placeholder={String(currentRentHT)} value={newRentHT} onChange={(e) => setNewRentHT(e.target.value)} />
                    </div>
                  )}
                  {showEndDate && (
                    <div>
                      <Label>Nouvelle date de fin</Label>
                      <Input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} />
                    </div>
                  )}
                  <div>
                    <Label>Description</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Resume de la modification contractuelle..." required />
                  </div>
                  {leaseDocuments.length > 0 && (
                    <DocumentPickerField value={signedDocId} onChange={setSignedDocId} leaseDocuments={leaseDocuments} />
                  )}
                  <Button type="submit" disabled={signedLoading || isAnalyzingPdf} className="w-full">
                    {(signedLoading || isAnalyzingPdf) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Ajouter l&apos;avenant signe
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {/* Nouvel avenant manuel */}
            <Dialog
              open={open}
              onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) resetForm(); }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  Nouvel avenant
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader><DialogTitle>Nouvel avenant</DialogTitle></DialogHeader>
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div>
                    <Label>Type</Label>
                    <NativeSelect
                      value={amendmentType}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAmendmentType(isAmendmentType(v) ? v : "AVENANT_DIVERS");
                      }}
                      options={AMENDMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                    />
                  </div>
                  <div>
                    <Label>Date d&apos;effet</Label>
                    <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} required />
                  </div>
                  {showRent && (
                    <div>
                      <Label>Nouveau loyer HT (actuel : {formatCurrency(currentRentHT)})</Label>
                      <Input type="number" step="0.01" placeholder={String(currentRentHT)} value={newRentHT} onChange={(e) => setNewRentHT(e.target.value)} />
                    </div>
                  )}
                  {showEndDate && (
                    <div>
                      <Label>Nouvelle date de fin</Label>
                      <Input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} />
                    </div>
                  )}
                  <div>
                    <Label>Description</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Motif..." required />
                  </div>
                  {leaseDocuments.length > 0 && (
                    <DocumentPickerField value={selectedDocId} onChange={setSelectedDocId} leaseDocuments={leaseDocuments} />
                  )}
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Creer l&apos;avenant
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {amendments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun avenant enregistre</p>
      ) : (
        <div className="divide-y">
          {amendments.map((amendment) => {
            const uploadedDoc = documentsByAmendmentNumber.get(amendment.amendmentNumber);
            const linkedDoc = amendment.document;

            const docHref = uploadedDoc
              ? (uploadedDoc.storagePath
                  ? `/api/storage/view?path=${encodeURIComponent(uploadedDoc.storagePath)}`
                  : uploadedDoc.fileUrl)
              : linkedDoc
              ? (linkedDoc.storagePath
                  ? `/api/storage/view?path=${encodeURIComponent(linkedDoc.storagePath)}`
                  : linkedDoc.fileUrl)
              : null;

            const docLabel = uploadedDoc ? "Voir le PDF signe" : linkedDoc ? `Document : ${linkedDoc.fileName}` : null;

            const otherChanges = amendment.otherChanges as Record<string, unknown> | null;
            const lotAdded = otherChanges?.lotAdded as string | undefined;
            const lotRemoved = otherChanges?.lotRemoved as string | undefined;
            const newPrimaryLot = otherChanges?.newPrimaryLot as string | undefined;

            return (
              <div key={amendment.id} className="space-y-1 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Avenant {amendment.amendmentNumber}</span>
                  <Badge variant={getBadgeVariant(amendment.amendmentType)}>
                    {AMENDMENT_TYPES.find((t) => t.value === amendment.amendmentType)?.label ?? amendment.amendmentType}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDate(new Date(amendment.effectiveDate))}
                  </span>
                </div>
                <p className="pl-6 text-sm text-muted-foreground">{amendment.description}</p>
                {amendment.newRentHT !== null && amendment.previousRentHT !== null && (
                  <div className="flex items-center gap-2 pl-6 text-sm">
                    <span className="text-muted-foreground">{formatCurrency(amendment.previousRentHT)}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{formatCurrency(amendment.newRentHT)}</span>
                  </div>
                )}
                {amendment.newEndDate !== null && amendment.previousEndDate !== null && (
                  <div className="flex items-center gap-2 pl-6 text-sm">
                    <span className="text-muted-foreground">{formatDate(new Date(amendment.previousEndDate))}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{formatDate(new Date(amendment.newEndDate))}</span>
                  </div>
                )}
                {(lotAdded ?? lotRemoved ?? newPrimaryLot) && (
                  <p className="pl-6 text-xs text-muted-foreground">
                    {lotAdded && `Lot ajoute : ${lotAdded}`}
                    {lotRemoved && `Lot retire : ${lotRemoved}`}
                    {newPrimaryLot && `Nouveau lot principal : ${newPrimaryLot}`}
                  </p>
                )}
                {docHref && docLabel && (
                  <div className="pl-6 pt-1">
                    <a
                      href={docHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {docLabel}
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isActive && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-dashed bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
          <FileSearch className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Le parcours <span className="font-medium text-foreground">Avenant signe</span>
            {" "}analyse le PDF, prefremplit les champs puis archive le document dans la GED du bail.
            Vous pouvez aussi lier n&apos;importe quel document existant de la GED a un avenant.
          </p>
        </div>
      )}
    </div>
  );
}
