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
};

type AmendmentDocument = {
  id: string;
  fileName: string;
  fileUrl: string;
  storagePath: string | null;
  description: string | null;
  createdAt: Date;
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
    case "RENOUVELLEMENT":
      return "Renouvellement du bail";
    case "AVENANT_LOYER":
      return "Modification du loyer";
    case "AVENANT_DUREE":
      return "Modification de la durée du bail";
    case "RESILIATION":
      return "Résiliation du bail";
    default:
      return "Avenant au bail";
  }
}

export function LeaseAmendments({
  amendments,
  amendmentDocuments,
  leaseId,
  societyId,
  isActive,
  currentRentHT,
  tenantId,
  primaryLotId,
}: {
  amendments: AmendmentData[];
  amendmentDocuments: AmendmentDocument[];
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
  const [signedPdfFile, setSignedPdfFile] = useState<File | null>(null);
  const [isAnalyzingPdf, setIsAnalyzingPdf] = useState(false);
  const [analysisHint, setAnalysisHint] = useState("");

  const showRent = ["AVENANT_LOYER", "RENOUVELLEMENT"].includes(amendmentType);
  const showEndDate = ["AVENANT_DUREE", "RENOUVELLEMENT"].includes(amendmentType);
  const documentsByAmendmentNumber = new Map<number, AmendmentDocument>();

  for (const document of amendmentDocuments) {
    const match = document.description?.match(/Avenant\s+(\d+)\s+signé/i);
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
    setSignedPdfFile(null);
    setAnalysisHint("");
    setIsAnalyzingPdf(false);
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
    hints.push(
      AMENDMENT_TYPES.find((type) => type.value === nextType)?.label ?? nextType
    );
    if (analysis.effectiveDate) hints.push(`effet ${analysis.effectiveDate}`);
    if (analysis.newRentHT !== null && analysis.newRentHT !== undefined) {
      hints.push(`nouveau loyer ${analysis.newRentHT} €`);
    }
    if (analysis.newEndDate) hints.push(`échéance ${analysis.newEndDate}`);

    setAnalysisHint(
      hints.length > 0
        ? `Analyse IA terminée : ${hints.join(", ")}.`
        : "Analyse IA terminée. Vérifiez les informations proposées."
    );
  }

  function blobToBase64(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Conversion du PDF impossible"));
          return;
        }
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
        body: JSON.stringify({
          fileName: file.name,
          chunkIndex,
          totalChunks,
          data,
          uploadId,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        storagePath?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Import temporaire du PDF impossible");
      }

      if (payload.storagePath) {
        storagePath = payload.storagePath;
      }
    }

    if (!storagePath) {
      throw new Error("Aucun chemin temporaire retourné pour l'analyse de l'avenant");
    }

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

      const payload = (await response.json().catch(() => ({}))) as
        | SignedAmendmentAnalysis
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload
            ? payload.error ?? "Analyse de l'avenant impossible"
            : "Analyse de l'avenant impossible"
        );
      }

      applySignedAmendmentAnalysis(payload as SignedAmendmentAnalysis);
      toast.success("Analyse IA terminée. Les champs ont été préremplis.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "L'analyse IA de l'avenant a échoué";
      setAnalysisHint("");
      toast.error(message);
    } finally {
      setIsAnalyzingPdf(false);
    }
  }

  async function uploadSignedAmendmentDocument(file: File, amendmentNumber: number) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", "avenant");
    formData.append("description", `Avenant ${amendmentNumber} signé`);
    formData.append("leaseId", leaseId);
    formData.append("tenantId", tenantId);
    formData.append("lotId", primaryLotId);

    const response = await fetch("/api/documents/upload", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Archivage du PDF signé impossible");
    }
  }

  async function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!effectiveDate || !description) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }

    setLoading(true);
    const result = await createLeaseAmendment(societyId, {
      leaseId,
      effectiveDate,
      description,
      amendmentType,
      newRentHT: newRentHT ? parseFloat(newRentHT) : undefined,
      newEndDate: newEndDate || undefined,
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

    if (!signedPdfFile) {
      toast.error("Ajoutez le PDF signé de l'avenant");
      return;
    }
    if (!effectiveDate || !description) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }

    setSignedLoading(true);
    const result = await createLeaseAmendment(societyId, {
      leaseId,
      effectiveDate,
      description,
      amendmentType,
      newRentHT: newRentHT ? parseFloat(newRentHT) : undefined,
      newEndDate: newEndDate || undefined,
    });

    if (!result.success || !result.data) {
      setSignedLoading(false);
      toast.error(result.error ?? "Erreur lors de la création de l'avenant");
      return;
    }

    try {
      await uploadSignedAmendmentDocument(signedPdfFile, result.data.amendmentNumber);
      toast.success("Avenant signé ajouté et archivé avec succès");
      setSignedOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Avenant créé, mais le PDF signé n'a pas pu être archivé";
      toast.error(message);
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
            <Dialog
              open={signedOpen}
              onOpenChange={(nextOpen) => {
                setSignedOpen(nextOpen);
                if (!nextOpen) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button variant="default" size="sm" className="gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Avenant signe
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                  <DialogTitle>Ajouter un avenant signé</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSignedSubmit} className="space-y-4">
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <Label htmlFor="signed-amendment-pdf">PDF signé de l&apos;avenant</Label>
                    <Input
                      id="signed-amendment-pdf"
                      type="file"
                      accept="application/pdf"
                      className="mt-2"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setSignedPdfFile(file);
                        if (file) {
                          void analyzeSignedAmendment(file);
                        } else {
                          setAnalysisHint("");
                        }
                      }}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Le PDF sera analysé par l&apos;IA, puis archivé dans les documents du bail.
                    </p>
                    {isAnalyzingPdf && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyse IA en cours...
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
                      onChange={(event) => {
                        const value = event.target.value;
                        setAmendmentType(
                          isAmendmentType(value) ? value : "AVENANT_DIVERS"
                        );
                      }}
                      options={AMENDMENT_TYPES.map((type) => ({
                        value: type.value,
                        label: type.label,
                      }))}
                    />
                  </div>

                  <div>
                    <Label>Date d&apos;effet</Label>
                    <Input
                      type="date"
                      value={effectiveDate}
                      onChange={(event) => setEffectiveDate(event.target.value)}
                      required
                    />
                  </div>

                  {showRent && (
                    <div>
                      <Label>
                        Nouveau loyer HT (actuel : {formatCurrency(currentRentHT)})
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={String(currentRentHT)}
                        value={newRentHT}
                        onChange={(event) => setNewRentHT(event.target.value)}
                      />
                    </div>
                  )}

                  {showEndDate && (
                    <div>
                      <Label>Nouvelle date de fin</Label>
                      <Input
                        type="date"
                        value={newEndDate}
                        onChange={(event) => setNewEndDate(event.target.value)}
                      />
                    </div>
                  )}

                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Résumé de la modification contractuelle..."
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={signedLoading || isAnalyzingPdf}
                    className="w-full"
                  >
                    {(signedLoading || isAnalyzingPdf) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Ajouter l&apos;avenant signé
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog
              open={open}
              onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  Nouvel avenant
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle>Nouvel avenant</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div>
                    <Label>Type</Label>
                    <NativeSelect
                      value={amendmentType}
                      onChange={(event) => {
                        const value = event.target.value;
                        setAmendmentType(
                          isAmendmentType(value) ? value : "AVENANT_DIVERS"
                        );
                      }}
                      options={AMENDMENT_TYPES.map((type) => ({
                        value: type.value,
                        label: type.label,
                      }))}
                    />
                  </div>
                  <div>
                    <Label>Date d&apos;effet</Label>
                    <Input
                      type="date"
                      value={effectiveDate}
                      onChange={(event) => setEffectiveDate(event.target.value)}
                      required
                    />
                  </div>
                  {showRent && (
                    <div>
                      <Label>
                        Nouveau loyer HT (actuel : {formatCurrency(currentRentHT)})
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={String(currentRentHT)}
                        value={newRentHT}
                        onChange={(event) => setNewRentHT(event.target.value)}
                      />
                    </div>
                  )}
                  {showEndDate && (
                    <div>
                      <Label>Nouvelle date de fin</Label>
                      <Input
                        type="date"
                        value={newEndDate}
                        onChange={(event) => setNewEndDate(event.target.value)}
                      />
                    </div>
                  )}
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Motif..."
                      required
                    />
                  </div>
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
          {amendments.map((amendment) => (
            <div key={amendment.id} className="space-y-1 py-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Avenant {amendment.amendmentNumber}
                </span>
                <Badge variant={getBadgeVariant(amendment.amendmentType)}>
                  {AMENDMENT_TYPES.find((type) => type.value === amendment.amendmentType)?.label ??
                    amendment.amendmentType}
                </Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDate(new Date(amendment.effectiveDate))}
                </span>
              </div>
              <p className="pl-6 text-sm text-muted-foreground">{amendment.description}</p>
              {amendment.newRentHT !== null && amendment.previousRentHT !== null && (
                <div className="flex items-center gap-2 pl-6 text-sm">
                  <span className="text-muted-foreground">
                    {formatCurrency(amendment.previousRentHT)}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">
                    {formatCurrency(amendment.newRentHT)}
                  </span>
                </div>
              )}
              {amendment.newEndDate !== null && amendment.previousEndDate !== null && (
                <div className="flex items-center gap-2 pl-6 text-sm">
                  <span className="text-muted-foreground">
                    {formatDate(new Date(amendment.previousEndDate))}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">
                    {formatDate(new Date(amendment.newEndDate))}
                  </span>
                </div>
              )}
              {(() => {
                const document = documentsByAmendmentNumber.get(amendment.amendmentNumber);
                if (!document) return null;

                const href = document.storagePath
                  ? `/api/storage/view?path=${encodeURIComponent(document.storagePath)}`
                  : document.fileUrl;

                return (
                  <div className="pl-6 pt-1">
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Voir le PDF signé
                    </a>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {isActive && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-dashed bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
          <FileSearch className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Le parcours <span className="font-medium text-foreground">Avenant signe</span>
            {" "}analyse le PDF, préremplit les champs puis archive le document dans la GED du bail.
          </p>
        </div>
      )}
    </div>
  );
}
