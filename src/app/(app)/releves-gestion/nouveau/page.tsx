"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSociety } from "@/providers/society-provider";
import { createStatement, getThirdPartyManagedLeases } from "@/actions/third-party-statement";
import type { StatementLineInput } from "@/validations/third-party-statement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Loader2, Plus, Save, Trash2, Users, Building2, Upload, Sparkles, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface ManagedLease {
  id: string;
  leaseNumber: string | null;
  currentRentHT: number;
  vatApplicable: boolean;
  vatRate: number | null;
  managementFeeType: string | null;
  managementFeeValue: number | null;
  managementFeeBasis: string | null;
  managementFeeVatRate: number | null;
  lot: {
    id: string;
    number: string;
    lotType: string;
    building: { id: string; name: string; addressLine1: string | null } | null;
  } | null;
  tenant: {
    id: string;
    firstName: string;
    lastName: string;
    companyName: string | null;
  } | null;
  chargeProvisions: Array<{ id: string; label: string; monthlyAmount: number }>;
}

const LINE_TYPES = [
  { value: "ENCAISSEMENT", label: "Encaissement" },
  { value: "HONORAIRES", label: "Honoraires" },
  { value: "DEDUCTION", label: "Déduction" },
];

function emptyLine(leaseId?: string): StatementLineInput & { key: string } {
  return {
    key: Math.random().toString(36).slice(2),
    lineType: "ENCAISSEMENT",
    label: "",
    amount: 0,
    leaseId: leaseId ?? undefined,
  };
}

export default function NouveauDecompteGestionPage() {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const societyId = activeSociety?.id;
  const [isPending, startTransition] = useTransition();

  // Baux disponibles
  const [leases, setLeases] = useState<ManagedLease[]>([]);
  const [loadingLeases, setLoadingLeases] = useState(true);
  const [selectedLeaseIds, setSelectedLeaseIds] = useState<string[]>([]);

  // Formulaire
  const [thirdPartyName, setThirdPartyName] = useState("");
  const [reference, setReference] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [netAmount, setNetAmount] = useState<number | undefined>();
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<(StatementLineInput & { key: string })[]>([]);

  // Extraction IA
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionConfidence, setExtractionConfidence] = useState<number | null>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setExtractionConfidence(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "DECOMPTE_GESTION");

      const res = await fetch("/api/statements/extract", { method: "POST", body: formData });
      const json = await res.json();

      if (!res.ok || json.error) {
        toast.error(json.error ?? "Erreur lors de l'extraction");
        return;
      }

      const data = json.data as {
        thirdPartyName: string | null;
        reference: string | null;
        periodStart: string | null;
        periodEnd: string | null;
        periodLabel: string | null;
        totalAmount: number | null;
        netAmount: number | null;
        lines: Array<{ lineType: string; label: string; amount: number }>;
        confidence: number;
      };

      // Remplir les champs du formulaire
      if (data.thirdPartyName) setThirdPartyName(data.thirdPartyName);
      if (data.reference) setReference(data.reference);
      if (data.periodStart) setPeriodStart(data.periodStart);
      if (data.periodEnd) setPeriodEnd(data.periodEnd);
      if (data.periodLabel) setPeriodLabel(data.periodLabel);
      if (data.netAmount) setNetAmount(data.netAmount);

      // Remplir les lignes
      if (data.lines.length > 0) {
        const newLines: (StatementLineInput & { key: string })[] = data.lines.map((l) => ({
          key: Math.random().toString(36).slice(2),
          lineType: (["ENCAISSEMENT", "HONORAIRES", "DEDUCTION"].includes(l.lineType)
            ? l.lineType
            : "ENCAISSEMENT") as "ENCAISSEMENT" | "CHARGE" | "HONORAIRES" | "DEDUCTION",
          label: l.label,
          amount: l.amount,
          leaseId: selectedLeaseIds.length === 1 ? selectedLeaseIds[0] : undefined,
        }));
        setLines(newLines);
      }

      setExtractionConfidence(data.confidence);
      toast.success("Extraction IA terminée — vérifiez les données extraites");
    } catch {
      toast.error("Erreur lors de l'extraction IA");
    } finally {
      setIsExtracting(false);
      e.target.value = "";
    }
  }

  // Charger les baux gérés par un tiers
  useEffect(() => {
    if (!societyId) return;
    let cancelled = false;
     
    getThirdPartyManagedLeases(societyId).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) {
        setLeases(res.data.leases as ManagedLease[]);
      }
      setLoadingLeases(false);
    });
    return () => { cancelled = true; };
  }, [societyId]);

  // Quand les baux sélectionnés changent, générer les lignes template
  function generateTemplateLines() {
    if (selectedLeaseIds.length === 0) return;

    const newLines: (StatementLineInput & { key: string })[] = [];

    for (const leaseId of selectedLeaseIds) {
      const lease = leases.find((l) => l.id === leaseId);
      if (!lease) continue;

      const tenantName = lease.tenant?.companyName || `${lease.tenant?.firstName} ${lease.tenant?.lastName}`;
      const prefix = selectedLeaseIds.length > 1 ? `[${lease.lot?.number ?? tenantName}] ` : "";

      // Loyers
      newLines.push({
        key: Math.random().toString(36).slice(2),
        lineType: "ENCAISSEMENT",
        label: `${prefix}Loyers encaissés`,
        amount: 0,
        leaseId,
      });

      // Provisions
      if (lease.chargeProvisions.length > 0) {
        newLines.push({
          key: Math.random().toString(36).slice(2),
          lineType: "ENCAISSEMENT",
          label: `${prefix}Provisions sur charges`,
          amount: 0,
          leaseId,
        });
      }

      // Honoraires
      if (lease.managementFeeType) {
        newLines.push({
          key: Math.random().toString(36).slice(2),
          lineType: "HONORAIRES",
          label: `${prefix}Honoraires de gestion`,
          amount: 0,
          leaseId,
        });
      }
    }

    setLines(newLines);
  }

  function toggleLease(leaseId: string) {
    setSelectedLeaseIds((prev) =>
      prev.includes(leaseId)
        ? prev.filter((id) => id !== leaseId)
        : [...prev, leaseId]
    );
  }

  function updateLine(key: string, field: string, value: unknown) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [field]: value } : l))
    );
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      emptyLine(selectedLeaseIds.length === 1 ? selectedLeaseIds[0] : undefined),
    ]);
  }

  // Calculer le total
  const totalAmount = lines.reduce((sum, l) => sum + l.amount, 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!societyId || selectedLeaseIds.length === 0) return;

    startTransition(async () => {
      const result = await createStatement(societyId, {
        type: "DECOMPTE_GESTION",
        leaseId: selectedLeaseIds.length === 1 ? selectedLeaseIds[0] : undefined,
        leaseIds: selectedLeaseIds,
        thirdPartyName,
        reference: reference || undefined,
        periodStart,
        periodEnd,
        periodLabel: periodLabel || undefined,
        receivedDate,
        totalAmount,
        netAmount,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          lineType: l.lineType,
          label: l.label,
          amount: l.amount,
          leaseId: l.leaseId,
          categoryId: l.categoryId,
          nature: l.nature,
          recoverableRate: l.recoverableRate,
        })),
        leases: selectedLeaseIds.map((leaseId) => {
          const leaseLines = lines.filter((l) => l.leaseId === leaseId);
          const rent = leaseLines.filter((l) => l.lineType === "ENCAISSEMENT" && l.label.toLowerCase().includes("loyer")).reduce((s, l) => s + l.amount, 0);
          const prov = leaseLines.filter((l) => l.lineType === "ENCAISSEMENT" && !l.label.toLowerCase().includes("loyer")).reduce((s, l) => s + l.amount, 0);
          const fees = leaseLines.filter((l) => l.lineType === "HONORAIRES").reduce((s, l) => s + l.amount, 0);
          const ded = leaseLines.filter((l) => l.lineType === "DEDUCTION").reduce((s, l) => s + l.amount, 0);
          return {
            leaseId,
            rentAmount: rent || undefined,
            provisionAmount: prov || undefined,
            feeAmount: fees || undefined,
            deductionAmount: ded || undefined,
            netAmount: rent + prov + fees + ded || undefined,
          };
        }),
      });

      if (result.success && result.data) {
        toast.success("Décompte de gestion créé");
        router.push(`/releves-gestion/${result.data.id}`);
      } else {
        toast.error(result.error ?? "Erreur lors de la création");
      }
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/releves-gestion"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--color-brand-blue)]" />
            Nouveau décompte de gestion
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Saisissez un décompte envoyé par votre gestionnaire tiers
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sélection des baux */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Baux concernés
            </CardTitle>
            <CardDescription>
              Sélectionnez un ou plusieurs baux couverts par ce décompte
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingLeases ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement des baux gérés par un tiers...
              </div>
            ) : leases.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                Aucun bail géré par un tiers trouvé. Activez la gestion par tiers sur un bail existant.
              </p>
            ) : (
              <div className="space-y-2">
                {leases.map((lease) => {
                  const tenantName = lease.tenant?.companyName || `${lease.tenant?.firstName} ${lease.tenant?.lastName}`;
                  const isSelected = selectedLeaseIds.includes(lease.id);
                  return (
                    <div
                      key={lease.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                      }`}
                      onClick={() => toggleLease(lease.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleLease(lease.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{tenantName}</span>
                          {lease.leaseNumber && (
                            <Badge variant="outline" className="text-[10px]">
                              Bail {lease.leaseNumber}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {lease.lot?.building && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {lease.lot.building.name}
                            </span>
                          )}
                          {lease.lot && <span>Lot {lease.lot.number}</span>}
                          <span>•</span>
                          <span>Loyer : {formatCurrency(lease.currentRentHT)} HT</span>
                          {lease.managementFeeType === "POURCENTAGE" && lease.managementFeeValue && (
                            <>
                              <span>•</span>
                              <span>Honoraires : {lease.managementFeeValue}%</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {selectedLeaseIds.length > 0 && (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-sm text-muted-foreground">
                      {selectedLeaseIds.length} bail{selectedLeaseIds.length > 1 ? "x" : ""} sélectionné{selectedLeaseIds.length > 1 ? "s" : ""}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateTemplateLines}
                    >
                      Générer les lignes
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Extraction IA */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Extraction IA depuis un PDF
            </CardTitle>
            <CardDescription>
              Importez le PDF du décompte pour pré-remplir automatiquement le formulaire
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <label
                className={`flex-1 flex items-center justify-center gap-3 px-4 py-6 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
                  isExtracting
                    ? "border-primary/30 bg-primary/5"
                    : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm text-primary font-medium">Analyse en cours...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Glissez ou cliquez pour importer un PDF, JPG ou PNG
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isExtracting}
                />
              </label>
            </div>
            {extractionConfidence !== null && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                {extractionConfidence >= 0.8 ? (
                  <Badge variant="success" className="text-xs">
                    Confiance : {Math.round(extractionConfidence * 100)}%
                  </Badge>
                ) : (
                  <Badge variant="warning" className="text-xs flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Confiance : {Math.round(extractionConfidence * 100)}%
                  </Badge>
                )}
                <span className="text-muted-foreground text-xs">
                  Vérifiez et corrigez les données extraites avant de valider
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Informations du décompte */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations du décompte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="thirdPartyName">Nom de l&apos;agence *</Label>
                <Input
                  id="thirdPartyName"
                  placeholder="Ex : Nexity, Foncia..."
                  value={thirdPartyName}
                  onChange={(e) => setThirdPartyName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Référence</Label>
                <Input
                  id="reference"
                  placeholder="N° du document"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="periodStart">Début de période *</Label>
                <Input
                  id="periodStart"
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
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodLabel">Libellé période</Label>
                <Input
                  id="periodLabel"
                  placeholder="Ex : Mars 2026"
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="receivedDate">Date de réception *</Label>
                <Input
                  id="receivedDate"
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="netAmount">Net reversé</Label>
                <Input
                  id="netAmount"
                  type="number"
                  step="0.01"
                  placeholder="Montant net reçu"
                  value={netAmount ?? ""}
                  onChange={(e) => setNetAmount(e.target.value ? parseFloat(e.target.value) : undefined)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lignes du décompte */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lignes du décompte</CardTitle>
            <CardDescription>
              {selectedLeaseIds.length > 1
                ? "Affectez chaque ligne au bail correspondant"
                : "Détaillez les postes du décompte"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lines.map((line) => (
              <div key={line.key} className="flex items-start gap-2 p-3 rounded-lg border bg-muted/20">
                <div className="flex-1 grid grid-cols-12 gap-2">
                  {selectedLeaseIds.length > 1 && (
                    <div className="col-span-3">
                      <Label className="text-[11px]">Bail</Label>
                      <Select
                        value={line.leaseId ?? ""}
                        onValueChange={(v) => updateLine(line.key, "leaseId", v || undefined)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Bail..." />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedLeaseIds.map((lid) => {
                            const l = leases.find((le) => le.id === lid);
                            if (!l) return null;
                            return (
                              <SelectItem key={lid} value={lid} className="text-xs">
                                {l.lot?.number ?? ""} — {l.tenant?.companyName || `${l.tenant?.firstName} ${l.tenant?.lastName}`}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className={selectedLeaseIds.length > 1 ? "col-span-2" : "col-span-3"}>
                    <Label className="text-[11px]">Type</Label>
                    <Select
                      value={line.lineType}
                      onValueChange={(v) => updateLine(line.key, "lineType", v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LINE_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={selectedLeaseIds.length > 1 ? "col-span-5" : "col-span-6"}>
                    <Label className="text-[11px]">Libellé</Label>
                    <Input
                      className="h-8 text-xs"
                      value={line.label}
                      onChange={(e) => updateLine(line.key, "label", e.target.value)}
                      placeholder="Description..."
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[11px]">Montant</Label>
                    <Input
                      className="h-8 text-xs text-right"
                      type="number"
                      step="0.01"
                      value={line.amount || ""}
                      onChange={(e) => updateLine(line.key, "amount", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 mt-4 text-muted-foreground hover:text-destructive"
                  onClick={() => removeLine(line.key)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addLine}>
              <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
            </Button>

            {lines.length > 0 && (
              <div className="flex justify-end pt-2 border-t">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">{formatCurrency(totalAmount)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes (optionnel)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Observations, commentaires..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" asChild>
            <Link href="/releves-gestion">Annuler</Link>
          </Button>
          <Button
            type="submit"
            disabled={isPending || selectedLeaseIds.length === 0 || !thirdPartyName || !periodStart || !periodEnd || lines.length === 0}
            className="gap-1.5 bg-brand-gradient-soft hover:opacity-90 text-white"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Créer le décompte
          </Button>
        </div>
      </form>
    </div>
  );
}
