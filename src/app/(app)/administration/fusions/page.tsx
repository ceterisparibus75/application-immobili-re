"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Layers, Users, Loader2, ArrowRight, Search, Merge, AlertTriangle } from "lucide-react";
import { useSociety } from "@/providers/society-provider";
import { searchDuplicates, mergeBuildings, mergeLots, mergeTenants } from "@/actions/merge";

type EntityType = "building" | "lot" | "tenant";

type SearchResult = {
  id: string;
  name?: string;
  addressLine1?: string;
  city?: string;
  number?: string;
  lotType?: string;
  building?: { name: string };
  entityType?: string;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
};

function entityLabel(type: EntityType): string {
  return type === "building" ? "Immeuble" : type === "lot" ? "Lot" : "Locataire";
}

function entityIcon(type: EntityType) {
  return type === "building" ? Building2 : type === "lot" ? Layers : Users;
}

function displayName(type: EntityType, item: SearchResult): string {
  if (type === "building") return `${item.name} — ${item.addressLine1}, ${item.city}`;
  if (type === "lot") return `Lot ${item.number} — ${item.building?.name ?? ""}`;
  if (type === "tenant") {
    if (item.entityType === "PERSONNE_MORALE") return `${item.companyName ?? ""} (${item.email ?? ""})`;
    return `${item.firstName ?? ""} ${item.lastName ?? ""} (${item.email ?? ""})`;
  }
  return item.id;
}

function MergeSection({ type }: { type: EntityType }) {
  const { activeSociety } = useSociety();
  const [isPending, startTransition] = useTransition();

  const [sourceQuery, setSourceQuery] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const [sourceResults, setSourceResults] = useState<SearchResult[]>([]);
  const [targetResults, setTargetResults] = useState<SearchResult[]>([]);
  const [selectedSource, setSelectedSource] = useState<SearchResult | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<SearchResult | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSearch(query: string, side: "source" | "target") {
    if (!activeSociety || query.length < 2) {
      if (side === "source") setSourceResults([]);
      else setTargetResults([]);
      return;
    }

    const results = await searchDuplicates(activeSociety.id, type, query);
    if (side === "source") setSourceResults(results as SearchResult[]);
    else setTargetResults(results as SearchResult[]);
  }

  function handleMerge() {
    if (!activeSociety || !selectedSource || !selectedTarget) return;
    if (!confirm(
      `Fusionner "${displayName(type, selectedSource)}" dans "${displayName(type, selectedTarget)}" ?\n\nToutes les données liées seront transférées. L'entité source sera supprimée. Cette action est irréversible.`
    )) return;

    setMessage(null);
    startTransition(async () => {
      let result;
      if (type === "building") result = await mergeBuildings(activeSociety.id, selectedSource.id, selectedTarget.id);
      else if (type === "lot") result = await mergeLots(activeSociety.id, selectedSource.id, selectedTarget.id);
      else result = await mergeTenants(activeSociety.id, selectedSource.id, selectedTarget.id);

      if (result.success) {
        setMessage({ type: "success", text: "Fusion effectuée avec succès" });
        setSelectedSource(null);
        setSelectedTarget(null);
        setSourceQuery("");
        setTargetQuery("");
        setSourceResults([]);
        setTargetResults([]);
      } else {
        setMessage({ type: "error", text: result.error ?? "Erreur" });
      }
    });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {type === "building" ? <Building2 className="h-4 w-4" /> : type === "lot" ? <Layers className="h-4 w-4" /> : <Users className="h-4 w-4" />}
          Fusionner des {entityLabel(type).toLowerCase()}s
        </CardTitle>
        <CardDescription>
          Sélectionnez l'entité source (à supprimer) et l'entité cible (qui conservera toutes les données)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <div className={`rounded-md p-3 text-sm ${
            message.type === "success"
              ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
              : "bg-destructive/10 text-destructive"
          }`}>
            {message.text}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* Source */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Badge variant="destructive" className="text-xs">Source</Badge>
              à supprimer
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Rechercher ${entityLabel(type).toLowerCase()}...`}
                value={sourceQuery}
                onChange={(e) => {
                  setSourceQuery(e.target.value);
                  handleSearch(e.target.value, "source");
                  setSelectedSource(null);
                }}
                className="pl-9"
              />
            </div>
            {selectedSource ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium">{displayName(type, selectedSource)}</p>
                <button onClick={() => setSelectedSource(null)} className="text-xs text-muted-foreground hover:underline mt-1">
                  Changer
                </button>
              </div>
            ) : sourceResults.length > 0 && (
              <div className="rounded-md border max-h-40 overflow-y-auto divide-y">
                {sourceResults.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setSelectedSource(item); setSourceResults([]); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                  >
                    {displayName(type, item)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Target */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Badge variant="success" className="text-xs">Cible</Badge>
              conservée
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Rechercher ${entityLabel(type).toLowerCase()}...`}
                value={targetQuery}
                onChange={(e) => {
                  setTargetQuery(e.target.value);
                  handleSearch(e.target.value, "target");
                  setSelectedTarget(null);
                }}
                className="pl-9"
              />
            </div>
            {selectedTarget ? (
              <div className="rounded-md border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3">
                <p className="text-sm font-medium">{displayName(type, selectedTarget)}</p>
                <button onClick={() => setSelectedTarget(null)} className="text-xs text-muted-foreground hover:underline mt-1">
                  Changer
                </button>
              </div>
            ) : targetResults.length > 0 && (
              <div className="rounded-md border max-h-40 overflow-y-auto divide-y">
                {targetResults.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setSelectedTarget(item); setTargetResults([]); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                  >
                    {displayName(type, item)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedSource && selectedTarget && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-destructive">{displayName(type, selectedSource)}</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
              <span className="font-medium text-green-600 dark:text-green-400">{displayName(type, selectedTarget)}</span>
            </div>

            <div className="rounded-md border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-900/20 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-800 dark:text-orange-300">
                Toutes les données liées (baux, lots, factures, documents...) seront transférées vers la cible. L'entité source sera définitivement supprimée.
              </p>
            </div>

            <Button
              onClick={handleMerge}
              disabled={isPending}
              variant="destructive"
              className="w-full"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Merge className="h-4 w-4" />
              )}
              Fusionner
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function FusionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fusion de doublons</h1>
        <p className="text-muted-foreground">
          Fusionnez les immeubles, lots ou locataires en doublon en conservant toutes les données liées
        </p>
      </div>

      <MergeSection type="building" />
      <MergeSection type="lot" />
      <MergeSection type="tenant" />
    </div>
  );
}
