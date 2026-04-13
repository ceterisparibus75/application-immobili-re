"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { createStatement } from "@/actions/third-party-statement";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

/* ─── Types ───────────────────────────────────────────────────────── */

interface FormLine {
  id: string;
  lineType: "ENCAISSEMENT" | "HONORAIRES" | "DEDUCTION";
  label: string;
  amount: string;
}

interface LeaseInfo {
  managingContact: { name: string; company: string | null } | null;
  managementFeeType: string | null;
  managementFeeValue: number | null;
  managementFeeBasis: string | null;
  managementFeeVatRate: number | null;
  currentRentHT: number;
  tenant: {
    entityType: string;
    companyName: string | null;
    firstName: string | null;
    lastName: string | null;
  };
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

let lineCounter = 0;
function nextLineId(): string {
  lineCounter += 1;
  return `line-${lineCounter}`;
}

function defaultLines(): FormLine[] {
  return [
    {
      id: nextLineId(),
      lineType: "ENCAISSEMENT",
      label: "Loyers encaisses",
      amount: "",
    },
    {
      id: nextLineId(),
      lineType: "ENCAISSEMENT",
      label: "Provisions sur charges",
      amount: "",
    },
    {
      id: nextLineId(),
      lineType: "HONORAIRES",
      label: "Honoraires de gestion",
      amount: "",
    },
  ];
}

const FEE_TYPE_LABELS: Record<string, string> = {
  POURCENTAGE: "Pourcentage",
  FORFAIT: "Forfait",
};

const FEE_BASIS_LABELS: Record<string, string> = {
  LOYER_HT: "Loyer HT",
  LOYER_CHARGES_HT: "Loyer + charges HT",
  TOTAL_TTC: "Total TTC",
};

/* ─── Page ────────────────────────────────────────────────────────── */

export default function NouveauDecompteGestionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const leaseId = params.id;

  const [loading, setLoading] = useState(false);
  const [leaseInfo, setLeaseInfo] = useState<LeaseInfo | null>(null);
  const [societyId, setSocietyId] = useState<string | null>(null);

  // Form state
  const [thirdPartyName, setThirdPartyName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [receivedDate, setReceivedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [lines, setLines] = useState<FormLine[]>(defaultLines);
  const [notes, setNotes] = useState("");

  // Fetch lease info
  useEffect(() => {
    const sid = document.cookie
      .split("; ")
      .find((row) => row.startsWith("active-society-id="))
      ?.split("=")[1];
    setSocietyId(sid ?? null);

    if (!sid) return;

    fetch(`/api/leases/${leaseId}`, {
      headers: { "x-society-id": sid },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data) {
          setLeaseInfo(data.data);
          if (data.data.managingContact?.company) {
            setThirdPartyName(data.data.managingContact.company);
          } else if (data.data.managingContact?.name) {
            setThirdPartyName(data.data.managingContact.name);
          }
        }
      })
      .catch(() => {
        // Silently fail — user can fill in manually
      });
  }, [leaseId]);

  // Auto-compute net amount
  const computedNet = useCallback(() => {
    let total = 0;
    for (const line of lines) {
      const val = parseFloat(line.amount);
      if (!isNaN(val)) {
        total += val;
      }
    }
    return total;
  }, [lines]);

  // Line management
  function updateLine(id: string, field: keyof FormLine, value: string) {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        id: nextLineId(),
        lineType: "DEDUCTION",
        label: "",
        amount: "",
      },
    ]);
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!societyId) {
      toast.error("Societe non selectionnee");
      return;
    }

    if (!periodStart || !periodEnd) {
      toast.error("Les dates de periode sont requises");
      return;
    }

    const parsedLines = lines
      .filter((l) => l.label.trim() && l.amount)
      .map((l) => ({
        lineType: l.lineType as "ENCAISSEMENT" | "HONORAIRES" | "DEDUCTION",
        label: l.label.trim(),
        amount: parseFloat(l.amount) || 0,
      }));

    if (parsedLines.length === 0) {
      toast.error("Au moins une ligne est requise");
      return;
    }

    const totalAmount = parsedLines.reduce(
      (sum, l) => sum + Math.abs(l.amount),
      0
    );
    const netAmount = parsedLines.reduce((sum, l) => sum + l.amount, 0);

    setLoading(true);
    try {
      const result = await createStatement(societyId, {
        type: "DECOMPTE_GESTION",
        leaseId,
        thirdPartyName: thirdPartyName || "Agence",
        periodStart,
        periodEnd,
        periodLabel: periodLabel || undefined,
        receivedDate,
        totalAmount,
        netAmount,
        notes: notes || undefined,
        lines: parsedLines,
      });

      if (result.success && result.data) {
        toast.success("Decompte cree avec succes");
        router.push(`/baux/${leaseId}/releves-gestion/${result.data.id}`);
      } else {
        toast.error(result.error ?? "Erreur lors de la creation");
      }
    } catch {
      toast.error("Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }

  const net = computedNet();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/baux/${leaseId}/releves-gestion`}>
          <Button variant="ghost" size="icon" type="button">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Nouveau decompte de gestion
          </h1>
          <p className="text-muted-foreground">
            Saisissez les informations du decompte transmis par l&apos;agence
          </p>
        </div>
      </div>

      {/* Reference info from lease */}
      {leaseInfo && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Informations de reference (bail)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Loyer HT actuel</p>
                <p className="text-sm font-semibold tabular-nums">
                  {leaseInfo.currentRentHT.toLocaleString("fr-FR", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  &euro;
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Honoraires</p>
                <p className="text-sm font-medium">
                  {leaseInfo.managementFeeType && leaseInfo.managementFeeValue != null
                    ? leaseInfo.managementFeeType === "POURCENTAGE"
                      ? `${leaseInfo.managementFeeValue} % (${FEE_BASIS_LABELS[leaseInfo.managementFeeBasis ?? ""] ?? ""})`
                      : `${leaseInfo.managementFeeValue.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} \u20ac / mois`
                    : "Non configure"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">TVA honoraires</p>
                <p className="text-sm font-medium">
                  {leaseInfo.managementFeeVatRate != null
                    ? `${leaseInfo.managementFeeVatRate} %`
                    : "20 % (defaut)"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations generales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="thirdPartyName">Nom de l&apos;agence</Label>
              <Input
                id="thirdPartyName"
                value={thirdPartyName}
                onChange={(e) => setThirdPartyName(e.target.value)}
                placeholder="Nom de l'agence de gestion"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodLabel">Libelle de la periode</Label>
              <Input
                id="periodLabel"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="Ex: Mars 2026, T1 2026..."
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="periodStart">Debut de periode</Label>
              <Input
                id="periodStart"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodEnd">Fin de periode</Label>
              <Input
                id="periodEnd"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receivedDate">Date de reception</Label>
              <Input
                id="receivedDate"
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lines */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Lignes du decompte
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLine}
            >
              <Plus className="h-4 w-4" />
              Ajouter une ligne
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.map((line) => (
            <div
              key={line.id}
              className="flex items-end gap-3 rounded-lg border p-3"
            >
              <div className="w-40 space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select
                  value={line.lineType}
                  onValueChange={(val) =>
                    updateLine(
                      line.id,
                      "lineType",
                      val as "ENCAISSEMENT" | "HONORAIRES" | "DEDUCTION"
                    )
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENCAISSEMENT">Encaissement</SelectItem>
                    <SelectItem value="HONORAIRES">Honoraires</SelectItem>
                    <SelectItem value="DEDUCTION">Deduction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Libelle</Label>
                <Input
                  value={line.label}
                  onChange={(e) =>
                    updateLine(line.id, "label", e.target.value)
                  }
                  placeholder="Description de la ligne"
                  className="h-9"
                />
              </div>
              <div className="w-36 space-y-1.5">
                <Label className="text-xs">Montant (&euro;)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={line.amount}
                  onChange={(e) =>
                    updateLine(line.id, "amount", e.target.value)
                  }
                  placeholder={
                    line.lineType === "ENCAISSEMENT"
                      ? "Ex: 2400"
                      : "Ex: -216"
                  }
                  className="h-9 tabular-nums"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => removeLine(line.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Separator />

          {/* Net calculated */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
            <p className="text-sm font-medium">Net reverse (calcule)</p>
            <p
              className={`text-lg font-bold tabular-nums ${
                net >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {net.toLocaleString("fr-FR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              &euro;
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observations, remarques..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <Link href={`/baux/${leaseId}/releves-gestion`}>
          <Button type="button" variant="outline">
            Annuler
          </Button>
        </Link>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Creer le decompte
        </Button>
      </div>
    </form>
  );
}
