"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Loader2,
  Trash2,
  Pencil,
  Save,
  X,
  CalendarDays,
} from "lucide-react";
import { createRentSteps, deleteRentStep, updateRentStep } from "@/actions/lease";
import { useRouter } from "next/navigation";

interface RentStepData {
  id: string;
  label: string;
  startDate: string;
  endDate: string | null;
  rentHT: number;
  chargesHT: number | null;
  position: number;
}

interface RentStepsProps {
  leaseId: string;
  societyId: string;
  steps: RentStepData[];
  isActive: boolean;
  leaseStartDate: string;
  leaseEndDate: string | null;
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface StepFormData {
  label: string;
  startDate: string;
  endDate: string;
  rentHT: string;
  chargesHT: string;
}

const emptyStep: StepFormData = {
  label: "",
  startDate: "",
  endDate: "",
  rentHT: "",
  chargesHT: "",
};

export function RentSteps({
  leaseId,
  societyId,
  steps,
  isActive,
  leaseStartDate,
  leaseEndDate,
}: RentStepsProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<StepFormData>(emptyStep);
  const [newSteps, setNewSteps] = useState<StepFormData[]>([
    { ...emptyStep },
  ]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Déterminer quel palier est actif aujourd'hui
  const today = new Date();
  const activeStepId = steps.find((s) => {
    const start = new Date(s.startDate);
    const end = s.endDate ? new Date(s.endDate) : null;
    return start <= today && (!end || end >= today);
  })?.id;

  function addNewStepRow() {
    setNewSteps([...newSteps, { ...emptyStep }]);
  }

  function removeNewStepRow(index: number) {
    if (newSteps.length <= 1) return;
    setNewSteps(newSteps.filter((_, i) => i !== index));
  }

  function updateNewStep(index: number, field: keyof StepFormData, value: string) {
    const updated = [...newSteps];
    updated[index] = { ...updated[index], [field]: value };
    setNewSteps(updated);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const stepsData = newSteps.map((s) => ({
      label: s.label,
      startDate: s.startDate,
      endDate: s.endDate || null,
      rentHT: parseFloat(s.rentHT),
      chargesHT: s.chargesHT ? parseFloat(s.chargesHT) : null,
    }));

    // Combiner les paliers existants avec les nouveaux
    const allSteps = [
      ...steps.map((s) => ({
        label: s.label,
        startDate: s.startDate.split("T")[0],
        endDate: s.endDate?.split("T")[0] ?? null,
        rentHT: s.rentHT,
        chargesHT: s.chargesHT,
      })),
      ...stepsData,
    ];

    const result = await createRentSteps(societyId, {
      leaseId,
      steps: allSteps,
    });

    if (!result.success) {
      setError(result.error ?? "Erreur");
    } else {
      setShowForm(false);
      setNewSteps([{ ...emptyStep }]);
      router.refresh();
    }
    setIsLoading(false);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError("");
    setIsLoading(true);

    const result = await updateRentStep(societyId, {
      id: editingId,
      label: editForm.label,
      startDate: editForm.startDate,
      endDate: editForm.endDate || null,
      rentHT: parseFloat(editForm.rentHT),
      chargesHT: editForm.chargesHT ? parseFloat(editForm.chargesHT) : null,
    });

    if (!result.success) {
      setError(result.error ?? "Erreur");
    } else {
      setEditingId(null);
      router.refresh();
    }
    setIsLoading(false);
  }

  async function handleDelete(stepId: string) {
    setDeletingId(stepId);
    const result = await deleteRentStep(societyId, stepId);
    if (!result.success) {
      setError(result.error ?? "Erreur");
    } else {
      router.refresh();
    }
    setDeletingId(null);
  }

  function startEdit(step: RentStepData) {
    setEditingId(step.id);
    setEditForm({
      label: step.label,
      startDate: step.startDate.split("T")[0],
      endDate: step.endDate?.split("T")[0] ?? "",
      rentHT: String(step.rentHT),
      chargesHT: step.chargesHT != null ? String(step.chargesHT) : "",
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {steps.length === 0 && !showForm && (
        <div className="text-center py-6">
          <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            Aucun palier de loyer défini. Le loyer de base s&apos;applique sur toute la durée du bail.
          </p>
          {isActive && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Définir des paliers
            </Button>
          )}
        </div>
      )}

      {/* Liste des paliers existants */}
      {steps.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Palier</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Période</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Loyer HT</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Charges HT</th>
                  {isActive && <th className="w-20" />}
                </tr>
              </thead>
              <tbody>
                {steps.map((step) => {
                  if (editingId === step.id) {
                    return (
                      <tr key={step.id} className="border-b bg-muted/10">
                        <td colSpan={isActive ? 5 : 4} className="p-3">
                          <form onSubmit={handleUpdate} className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-5">
                              <div className="space-y-1">
                                <Label className="text-xs">Libellé</Label>
                                <Input
                                  value={editForm.label}
                                  onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                                  required
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Début</Label>
                                <Input
                                  type="date"
                                  value={editForm.startDate}
                                  onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                                  required
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Fin</Label>
                                <Input
                                  type="date"
                                  value={editForm.endDate}
                                  onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Loyer HT</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editForm.rentHT}
                                  onChange={(e) => setEditForm({ ...editForm, rentHT: e.target.value })}
                                  required
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Charges HT</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editForm.chargesHT}
                                  onChange={(e) => setEditForm({ ...editForm, chargesHT: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                                <X className="h-3.5 w-3.5" /> Annuler
                              </Button>
                              <Button type="submit" size="sm" disabled={isLoading}>
                                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                Enregistrer
                              </Button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={step.id} className={`border-b last:border-0 hover:bg-muted/20 ${activeStepId === step.id ? "bg-primary/5" : ""}`}>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{step.label}</span>
                          {activeStepId === step.id && (
                            <Badge variant="default" className="text-xs">Actif</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {fmtDate(step.startDate)}
                        {step.endDate ? ` — ${fmtDate(step.endDate)}` : " — …"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium tabular-nums">
                        {fmt(step.rentHT)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                        {step.chargesHT != null ? fmt(step.chargesHT) : "—"}
                      </td>
                      {isActive && (
                        <td className="py-2.5 px-1 flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => startEdit(step)}
                            aria-label="Modifier le palier"
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDelete(step.id)}
                            disabled={deletingId === step.id}
                            aria-label="Supprimer le palier"
                          >
                            {deletingId === step.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                            )}
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {isActive && !showForm && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" />
                Ajouter un palier
              </Button>
            </div>
          )}
        </>
      )}

      {/* Formulaire d'ajout de nouveaux paliers */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-md border p-4 space-y-4 bg-muted/30">
          <p className="text-sm font-semibold">Ajouter des paliers de loyer</p>
          <p className="text-xs text-muted-foreground">
            Définissez des montants de loyer différents selon les périodes (franchise, loyer progressif, etc.)
          </p>

          {newSteps.map((step, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-6 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Libellé *</Label>
                <Input
                  value={step.label}
                  onChange={(e) => updateNewStep(index, "label", e.target.value)}
                  placeholder={index === 0 ? "Franchise" : `Palier ${index + 1}`}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Début *</Label>
                <Input
                  type="date"
                  value={step.startDate}
                  onChange={(e) => updateNewStep(index, "startDate", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fin</Label>
                <Input
                  type="date"
                  value={step.endDate}
                  onChange={(e) => updateNewStep(index, "endDate", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Loyer HT (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={step.rentHT}
                  onChange={(e) => updateNewStep(index, "rentHT", e.target.value)}
                  placeholder="0"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Charges HT (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={step.chargesHT}
                  onChange={(e) => updateNewStep(index, "chargesHT", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                {newSteps.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => removeNewStepRow(index)}
                    aria-label="Retirer cette ligne"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={addNewStepRow}>
            <Plus className="h-4 w-4" />
            Ajouter une ligne
          </Button>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setNewSteps([{ ...emptyStep }]);
                setError("");
              }}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement…</>
              ) : (
                "Enregistrer les paliers"
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
