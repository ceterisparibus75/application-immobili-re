"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Plus, FileText, ArrowRight, Loader2 } from "lucide-react";
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

function getBadgeVariant(type: string): "default" | "secondary" | "destructive" {
  if (type === "RESILIATION") return "destructive";
  if (type === "RENOUVELLEMENT") return "default";
  return "secondary";
}

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

export function LeaseAmendments({
  amendments, leaseId, societyId, isActive, currentRentHT,
}: {
  amendments: AmendmentData[];
  leaseId: string;
  societyId: string;
  isActive: boolean;
  currentRentHT: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amendmentType, setAmendmentType] = useState("AVENANT_LOYER");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [newRentHT, setNewRentHT] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [description, setDescription] = useState("");

  const showRent = ["AVENANT_LOYER", "RENOUVELLEMENT"].includes(amendmentType);
  const showEndDate = ["AVENANT_DUREE", "RENOUVELLEMENT"].includes(amendmentType);

  const resetForm = () => {
    setAmendmentType("AVENANT_LOYER");
    setEffectiveDate("");
    setNewRentHT("");
    setNewEndDate("");
    setDescription("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveDate || !description) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }
    setLoading(true);
    const result = await createLeaseAmendment(societyId, {
      leaseId, effectiveDate, description, amendmentType,
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
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-muted-foreground">Avenants</h2>
        {isActive && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Nouvel avenant
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Nouvel avenant</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Type</Label>
                  <NativeSelect
                    value={amendmentType}
                    onChange={(e) => setAmendmentType(e.target.value)}
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
                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Creer l&apos;avenant
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {amendments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun avenant enregistre</p>
      ) : (
        <div className="divide-y">
          {amendments.map((a) => (
            <div key={a.id} className="py-3 space-y-1">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Avenant {a.amendmentNumber}</span>
                <Badge variant={getBadgeVariant(a.amendmentType)}>
                  {AMENDMENT_TYPES.find((t) => t.value === a.amendmentType)?.label ?? a.amendmentType}
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatDate(new Date(a.effectiveDate))}
                </span>
              </div>
              <p className="text-sm text-muted-foreground pl-6">{a.description}</p>
              {a.newRentHT !== null && a.previousRentHT !== null && (
                <div className="flex items-center gap-2 pl-6 text-sm">
                  <span className="text-muted-foreground">{formatCurrency(a.previousRentHT)}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{formatCurrency(a.newRentHT)}</span>
                </div>
              )}
              {a.newEndDate !== null && a.previousEndDate !== null && (
                <div className="flex items-center gap-2 pl-6 text-sm">
                  <span className="text-muted-foreground">{formatDate(new Date(a.previousEndDate))}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{formatDate(new Date(a.newEndDate))}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
