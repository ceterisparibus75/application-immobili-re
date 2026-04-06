"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Loader2, FileBarChart2 } from "lucide-react";
import { generateAnnualChargeReport } from "@/actions/charge";

type Building = { id: string; name: string; city: string };

export function GenerateReportButton({ societyId }: { societyId: string }) {
  const [open, setOpen] = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear() - 1);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/buildings")
      .then((r) => r.json())
      .then((j: { data: Building[] }) => {
        setBuildings(j.data ?? []);
        if (j.data?.[0]) setBuildingId(j.data[0].id);
      });
  }, [open]);

  async function handleGenerate() {
    if (!buildingId) {
      setError("Sélectionner un immeuble");
      return;
    }
    setError("");
    setSuccess("");
    setIsLoading(true);
    const result = await generateAnnualChargeReport(societyId, buildingId, year);
    setIsLoading(false);
    if (result.success && result.data) {
      setSuccess(`${result.data.created} compte(s) rendu(s) généré(s) avec succès.`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setError("");
          setSuccess("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Générer un compte rendu
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBarChart2 className="h-5 w-5" />
            Générer les comptes rendus annuels
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Calcule automatiquement la quote-part de charges de chaque locataire pour l&apos;exercice sélectionné et
            dépose le compte rendu dans son espace.
          </p>
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          {success && (
            <div className="rounded-md bg-[var(--color-status-positive-bg)] p-3 text-sm text-[var(--color-status-positive)]">
              {success}
            </div>
          )}
          <div className="space-y-2">
            <Label>Immeuble</Label>
            <select
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Sélectionner...</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {b.city}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Exercice (année)</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              min={2000}
              max={new Date().getFullYear()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fermer
          </Button>
          <Button onClick={handleGenerate} disabled={isLoading || !!success}>
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Calcul en cours...</>
            ) : (
              "Générer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
