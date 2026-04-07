"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building2, FileText, Loader2, Bot } from "lucide-react";
import { toast } from "sonner";
import { batchCreatePropertyValuations } from "@/actions/valuation";
import { batchCreateRentValuations } from "@/actions/rent-valuation";
import { formatCurrency } from "@/lib/utils";

interface BuildingItem {
  id: string;
  name: string;
  city: string;
  buildingType: string;
  lotCount: number;
}

interface LeaseItem {
  id: string;
  tenantName: string;
  buildingName: string;
  lotNumber: number;
  leaseType: string;
  currentRentHT: number;
  paymentFrequency: string;
}

const FREQ_LABELS: Record<string, string> = {
  MENSUEL: "/mois",
  TRIMESTRIEL: "/trim.",
  SEMESTRIEL: "/sem.",
  ANNUEL: "/an",
};

const BUILDING_TYPE_LABELS: Record<string, string> = {
  BUREAU: "Bureau",
  COMMERCE: "Commerce",
  MIXTE: "Mixte",
  ENTREPOT: "Entrepot",
};

const LEASE_TYPE_SHORT: Record<string, string> = {
  HABITATION: "Habitation",
  MEUBLE: "Meublé",
  COMMERCIAL_369: "Commercial 3/6/9",
  PROFESSIONNEL: "Professionnel",
  CIVIL: "Civil",
  DEROGATOIRE: "Dérogatoire",
  SAISONNIER: "Saisonnier",
  MIXTE: "Mixte",
};

export function BatchEvaluationClient({
  societyId,
  buildings,
  leases,
}: {
  societyId: string;
  buildings: BuildingItem[];
  leases: LeaseItem[];
}) {
  const [selectedBuildings, setSelectedBuildings] = useState<Set<string>>(new Set());
  const [selectedLeases, setSelectedLeases] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggleBuilding(id: string) {
    setSelectedBuildings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllBuildings() {
    if (selectedBuildings.size === buildings.length) {
      setSelectedBuildings(new Set());
    } else {
      setSelectedBuildings(new Set(buildings.map((b) => b.id)));
    }
  }

  function toggleLease(id: string) {
    setSelectedLeases((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllLeases() {
    if (selectedLeases.size === leases.length) {
      setSelectedLeases(new Set());
    } else {
      setSelectedLeases(new Set(leases.map((l) => l.id)));
    }
  }

  function handleBatchPropertyValuation() {
    if (selectedBuildings.size === 0) return;
    startTransition(async () => {
      const result = await batchCreatePropertyValuations(societyId, Array.from(selectedBuildings));
      if (result.success && result.data) {
        const { created, skipped, errors } = result.data;
        const parts: string[] = [];
        if (created > 0) parts.push(`${created} évaluation(s) lancée(s)`);
        if (skipped > 0) parts.push(`${skipped} ignorée(s) (limite annuelle)`);
        if (errors.length > 0) parts.push(`${errors.length} erreur(s)`);
        toast.success(parts.join(", "));
        setSelectedBuildings(new Set());
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  function handleBatchRentValuation() {
    if (selectedLeases.size === 0) return;
    startTransition(async () => {
      const result = await batchCreateRentValuations(societyId, Array.from(selectedLeases));
      if (result.success && result.data) {
        const { created, errors } = result.data;
        const parts: string[] = [];
        if (created > 0) parts.push(`${created} évaluation(s) lancée(s)`);
        if (errors.length > 0) parts.push(`${errors.length} erreur(s)`);
        toast.success(parts.join(", "));
        setSelectedLeases(new Set());
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  return (
    <Tabs defaultValue="buildings" className="space-y-4">
      <TabsList>
        <TabsTrigger value="buildings" className="gap-2">
          <Building2 className="h-4 w-4" />
          Valeur vénale ({buildings.length})
        </TabsTrigger>
        <TabsTrigger value="leases" className="gap-2">
          <FileText className="h-4 w-4" />
          Loyers ({leases.length})
        </TabsTrigger>
      </TabsList>

      {/* === Immeubles === */}
      <TabsContent value="buildings">
        <Card className="border-0 shadow-brand bg-white rounded-xl">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">
              Sélectionnez les immeubles à évaluer
            </CardTitle>
            <Button
              onClick={handleBatchPropertyValuation}
              disabled={isPending || selectedBuildings.size === 0}
              size="sm"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bot className="h-4 w-4 mr-2" />
              )}
              {isPending
                ? "Analyse en cours..."
                : `Évaluer ${selectedBuildings.size > 0 ? `(${selectedBuildings.size})` : ""}`}
            </Button>
          </CardHeader>
          <CardContent>
            {buildings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun immeuble</p>
            ) : (
              <div className="space-y-1">
                {/* Tout sélectionner */}
                <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/50 cursor-pointer border-b">
                  <Checkbox
                    checked={selectedBuildings.size === buildings.length}
                    onCheckedChange={toggleAllBuildings}
                    disabled={isPending}
                  />
                  <span className="text-sm font-medium text-muted-foreground">Tout sélectionner</span>
                </label>
                {buildings.map((b) => (
                  <label
                    key={b.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedBuildings.has(b.id)}
                      onCheckedChange={() => toggleBuilding(b.id)}
                      disabled={isPending}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{b.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {BUILDING_TYPE_LABELS[b.buildingType] ?? b.buildingType}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{b.city} — {b.lotCount} lot(s)</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {isPending && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--color-brand-blue)]" />
                <p className="mt-2 text-sm text-[var(--color-brand-deep)]">
                  Analyse IA en cours pour {selectedBuildings.size} immeuble(s)... Cela peut prendre quelques minutes.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* === Baux === */}
      <TabsContent value="leases">
        <Card className="border-0 shadow-brand bg-white rounded-xl">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">
              Sélectionnez les baux à évaluer
            </CardTitle>
            <Button
              onClick={handleBatchRentValuation}
              disabled={isPending || selectedLeases.size === 0}
              size="sm"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bot className="h-4 w-4 mr-2" />
              )}
              {isPending
                ? "Analyse en cours..."
                : `Évaluer ${selectedLeases.size > 0 ? `(${selectedLeases.size})` : ""}`}
            </Button>
          </CardHeader>
          <CardContent>
            {leases.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun bail actif</p>
            ) : (
              <div className="space-y-1">
                {/* Tout sélectionner */}
                <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/50 cursor-pointer border-b">
                  <Checkbox
                    checked={selectedLeases.size === leases.length}
                    onCheckedChange={toggleAllLeases}
                    disabled={isPending}
                  />
                  <span className="text-sm font-medium text-muted-foreground">Tout sélectionner</span>
                </label>
                {leases.map((l) => (
                  <label
                    key={l.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedLeases.has(l.id)}
                      onCheckedChange={() => toggleLease(l.id)}
                      disabled={isPending}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{l.tenantName}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {LEASE_TYPE_SHORT[l.leaseType] ?? l.leaseType}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {l.buildingName} — Lot {l.lotNumber}
                      </span>
                    </div>
                    <span className="text-sm font-medium tabular-nums shrink-0">
                      {formatCurrency(l.currentRentHT)}{FREQ_LABELS[l.paymentFrequency] ?? ""}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {isPending && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--color-brand-blue)]" />
                <p className="mt-2 text-sm text-[var(--color-brand-deep)]">
                  Analyse IA en cours pour {selectedLeases.size} bail(baux)... Cela peut prendre quelques minutes.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
