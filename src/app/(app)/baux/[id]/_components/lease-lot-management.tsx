"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Crown, Plus, Trash2, ArrowRightLeft, Loader2 } from "lucide-react";
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
import { toast } from "sonner";
import { createLeaseAmendment, getAvailableLotsForLease } from "@/actions/lease-amendment";

type LotData = {
  id: string;
  number: string;
  area: number;
  isPrimary: boolean;
  building: { id: string; name: string; city: string; postalCode: string | null };
};

type LeaseDocument = {
  id: string;
  fileName: string;
  category: string | null;
  storagePath: string | null;
  fileUrl: string;
};

type AvailableLot = {
  id: string;
  number: string;
  area: number;
  building: { id: string; name: string; city: string };
  leaseLots: { id: string; isPrimary: boolean }[];
};

export function LeaseLotManagement({
  leaseId,
  societyId,
  isActive,
  leaseLots,
  leaseDocuments,
}: {
  leaseId: string;
  societyId: string;
  isActive: boolean;
  leaseLots: LotData[];
  leaseDocuments: LeaseDocument[];
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<LotData | null>(null);
  const [primaryTarget, setPrimaryTarget] = useState<LotData | null>(null);
  const [loading, setLoading] = useState(false);
  const [availableLots, setAvailableLots] = useState<AvailableLot[]>([]);
  const [loadingLots, setLoadingLots] = useState(false);

  // Add dialog state
  const [selectedLotId, setSelectedLotId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDocId, setSelectedDocId] = useState("");
  const [createAmendment, setCreateAmendment] = useState(true);

  // Remove dialog state
  const [removeDate, setRemoveDate] = useState("");
  const [removeDesc, setRemoveDesc] = useState("");
  const [removeDocId, setRemoveDocId] = useState("");
  const [removeAmendment, setRemoveAmendment] = useState(true);

  // Primary dialog state
  const [primaryDate, setPrimaryDate] = useState("");
  const [primaryDesc, setPrimaryDesc] = useState("");
  const [primaryDocId, setPrimaryDocId] = useState("");
  const [primaryAmendment, setPrimaryAmendment] = useState(true);

  async function openAddDialog() {
    setAddOpen(true);
    setLoadingLots(true);
    const lots = await getAvailableLotsForLease(societyId, leaseId);
    setAvailableLots(
      lots.filter((l) => l.leaseLots.length === 0) // only lots not yet on this lease
    );
    setLoadingLots(false);
  }

  function resetAddForm() {
    setSelectedLotId("");
    setEffectiveDate("");
    setDescription("");
    setSelectedDocId("");
    setCreateAmendment(true);
  }

  function resetRemoveForm() {
    setRemoveDate("");
    setRemoveDesc("");
    setRemoveDocId("");
    setRemoveAmendment(true);
  }

  function resetPrimaryForm() {
    setPrimaryDate("");
    setPrimaryDesc("");
    setPrimaryDocId("");
    setPrimaryAmendment(true);
  }

  async function handleAddLot(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLotId) { toast.error("Selectionnez un lot"); return; }
    if (createAmendment && !effectiveDate) { toast.error("Date d'effet obligatoire"); return; }
    setLoading(true);

    const lot = availableLots.find((l) => l.id === selectedLotId);
    const desc = description || `Ajout du lot ${lot?.number ?? selectedLotId} au bail`;

    const result = await createLeaseAmendment(societyId, {
      leaseId,
      effectiveDate: effectiveDate || new Date().toISOString().split("T")[0]!,
      description: desc,
      amendmentType: "AVENANT_LOT",
      lotsToAdd: [selectedLotId],
      documentId: selectedDocId || undefined,
      otherChanges: { lotAdded: selectedLotId },
    });

    setLoading(false);
    if (result.success) {
      toast.success("Lot ajoute au bail");
      setAddOpen(false);
      resetAddForm();
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  async function handleRemoveLot(e: React.FormEvent) {
    e.preventDefault();
    if (!removeTarget) return;
    if (removeAmendment && !removeDate) { toast.error("Date d'effet obligatoire"); return; }
    setLoading(true);

    const desc = removeDesc || `Retrait du lot ${removeTarget.number} du bail`;
    const result = await createLeaseAmendment(societyId, {
      leaseId,
      effectiveDate: removeDate || new Date().toISOString().split("T")[0]!,
      description: desc,
      amendmentType: "AVENANT_LOT",
      lotsToRemove: [removeTarget.id],
      documentId: removeDocId || undefined,
      otherChanges: { lotRemoved: removeTarget.id },
    });

    setLoading(false);
    if (result.success) {
      toast.success("Lot retire du bail");
      setRemoveTarget(null);
      resetRemoveForm();
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  async function handleSetPrimary(e: React.FormEvent) {
    e.preventDefault();
    if (!primaryTarget) return;
    if (primaryAmendment && !primaryDate) { toast.error("Date d'effet obligatoire"); return; }
    setLoading(true);

    const prevPrimary = leaseLots.find((l) => l.isPrimary);
    const desc =
      primaryDesc ||
      `Changement de lot principal : lot ${prevPrimary?.number ?? "?"} → lot ${primaryTarget.number}`;

    const result = await createLeaseAmendment(societyId, {
      leaseId,
      effectiveDate: primaryDate || new Date().toISOString().split("T")[0]!,
      description: desc,
      amendmentType: "AVENANT_LOT",
      newPrimaryLotId: primaryTarget.id,
      documentId: primaryDocId || undefined,
      otherChanges: { newPrimaryLot: primaryTarget.id, previousPrimaryLot: prevPrimary?.id },
    });

    setLoading(false);
    if (result.success) {
      toast.success("Lot principal mis a jour");
      setPrimaryTarget(null);
      resetPrimaryForm();
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  const docOptions = [
    { value: "", label: "— Aucun document —" },
    ...leaseDocuments.map((d) => ({
      value: d.id,
      label: `${d.fileName}${d.category ? ` [${d.category}]` : ""}`,
    })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {leaseLots.length} lot{leaseLots.length > 1 ? "s" : ""} rattache{leaseLots.length > 1 ? "s" : ""}
        </p>
        {isActive && (
          <Dialog
            open={addOpen}
            onOpenChange={(o) => {
              if (o) { void openAddDialog(); } else { setAddOpen(false); resetAddForm(); }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Plus className="h-3.5 w-3.5" />
                Ajouter un lot
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Ajouter un lot au bail</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddLot} className="space-y-4">
                <div>
                  <Label>Lot a rattacher</Label>
                  {loadingLots ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
                    </div>
                  ) : availableLots.length === 0 ? (
                    <p className="py-2 text-sm text-muted-foreground">
                      Aucun lot vacant disponible dans cette societe.
                    </p>
                  ) : (
                    <NativeSelect
                      value={selectedLotId}
                      onChange={(e) => setSelectedLotId(e.target.value)}
                      options={[
                        { value: "", label: "— Choisir un lot —" },
                        ...availableLots.map((l) => ({
                          value: l.id,
                          label: `Lot ${l.number} — ${l.building.name} (${l.area} m²)`,
                        })),
                      ]}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="create-amendment-add"
                    checked={createAmendment}
                    onChange={(e) => setCreateAmendment(e.target.checked)}
                    className="h-4 w-4 rounded border"
                  />
                  <Label htmlFor="create-amendment-add" className="cursor-pointer font-normal">
                    Creer un avenant pour tracer cette modification
                  </Label>
                </div>
                {createAmendment && (
                  <>
                    <div>
                      <Label>Date d&apos;effet</Label>
                      <Input
                        type="date"
                        value={effectiveDate}
                        onChange={(e) => setEffectiveDate(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Ajout du lot X au bail suite a..."
                      />
                    </div>
                    <div>
                      <Label>Document GED associe (optionnel)</Label>
                      <NativeSelect
                        value={selectedDocId}
                        onChange={(e) => setSelectedDocId(e.target.value)}
                        options={docOptions}
                      />
                    </div>
                  </>
                )}
                <Button type="submit" disabled={loading || loadingLots || !selectedLotId} className="w-full">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Rattacher le lot
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="divide-y rounded-md border">
        {leaseLots.map((ll) => (
          <div key={ll.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">Lot {ll.number}</span>
                  {ll.isPrimary && (
                    <Badge variant="outline" className="text-[10px] gap-1 py-0">
                      <Crown className="h-2.5 w-2.5" /> Principal
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {ll.building.name} — {ll.area} m²
                </p>
              </div>
            </div>
            {isActive && (
              <div className="flex items-center gap-1 shrink-0">
                {!ll.isPrimary && leaseLots.length > 1 && (
                  <>
                    <Dialog
                      open={primaryTarget?.id === ll.id}
                      onOpenChange={(o) => {
                        if (o) setPrimaryTarget(ll);
                        else { setPrimaryTarget(null); resetPrimaryForm(); }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Definir comme lot principal">
                          <Crown className="h-3.5 w-3.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[440px]">
                        <DialogHeader>
                          <DialogTitle>Changer le lot principal</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSetPrimary} className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Le lot <strong>{ll.number}</strong> deviendra le lot principal du bail.
                          </p>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="create-amendment-primary"
                              checked={primaryAmendment}
                              onChange={(e) => setPrimaryAmendment(e.target.checked)}
                              className="h-4 w-4 rounded border"
                            />
                            <Label htmlFor="create-amendment-primary" className="cursor-pointer font-normal">
                              Creer un avenant pour tracer cette modification
                            </Label>
                          </div>
                          {primaryAmendment && (
                            <>
                              <div>
                                <Label>Date d&apos;effet</Label>
                                <Input
                                  type="date"
                                  value={primaryDate}
                                  onChange={(e) => setPrimaryDate(e.target.value)}
                                  required
                                />
                              </div>
                              <div>
                                <Label>Description</Label>
                                <Textarea
                                  value={primaryDesc}
                                  onChange={(e) => setPrimaryDesc(e.target.value)}
                                  placeholder="Changement de lot principal suite a..."
                                />
                              </div>
                              <div>
                                <Label>Document GED associe (optionnel)</Label>
                                <NativeSelect
                                  value={primaryDocId}
                                  onChange={(e) => setPrimaryDocId(e.target.value)}
                                  options={docOptions}
                                />
                              </div>
                            </>
                          )}
                          <Button type="submit" disabled={loading} className="w-full">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Definir comme lot principal
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>

                    <Dialog
                      open={removeTarget?.id === ll.id}
                      onOpenChange={(o) => {
                        if (o) setRemoveTarget(ll);
                        else { setRemoveTarget(null); resetRemoveForm(); }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Retirer ce lot du bail">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[440px]">
                        <DialogHeader>
                          <DialogTitle>Retirer le lot du bail</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleRemoveLot} className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Le lot <strong>{ll.number}</strong> sera retire du bail. Il repassera en statut Vacant.
                          </p>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="create-amendment-remove"
                              checked={removeAmendment}
                              onChange={(e) => setRemoveAmendment(e.target.checked)}
                              className="h-4 w-4 rounded border"
                            />
                            <Label htmlFor="create-amendment-remove" className="cursor-pointer font-normal">
                              Creer un avenant pour tracer cette modification
                            </Label>
                          </div>
                          {removeAmendment && (
                            <>
                              <div>
                                <Label>Date d&apos;effet</Label>
                                <Input
                                  type="date"
                                  value={removeDate}
                                  onChange={(e) => setRemoveDate(e.target.value)}
                                  required
                                />
                              </div>
                              <div>
                                <Label>Description</Label>
                                <Textarea
                                  value={removeDesc}
                                  onChange={(e) => setRemoveDesc(e.target.value)}
                                  placeholder="Retrait du lot suite a..."
                                />
                              </div>
                              <div>
                                <Label>Document GED associe (optionnel)</Label>
                                <NativeSelect
                                  value={removeDocId}
                                  onChange={(e) => setRemoveDocId(e.target.value)}
                                  options={docOptions}
                                />
                              </div>
                            </>
                          )}
                          <Button type="submit" disabled={loading} variant="destructive" className="w-full">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Retirer le lot
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
                {ll.isPrimary && leaseLots.length === 1 && (
                  <span className="text-xs text-muted-foreground pr-1">Lot unique</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}