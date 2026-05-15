"use client";

import { useState, useTransition } from "react";
import { Calendar, Crown, Plus, Scissors, Users, X } from "lucide-react";
import { toast } from "sonner";

import {
  deleteOwnership,
  endOwnership,
  splitLotToUsufruct,
} from "@/actions/lot-ownership";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type OwnershipType = "PLEINE_PROPRIETE" | "USUFRUIT" | "NUE_PROPRIETE";

export interface LotOwnershipRow {
  id: string;
  type: OwnershipType;
  share: number;
  startDate: string | Date;
  endDate: string | Date | null;
  isViager: boolean;
  usufruitierBirthDate: string | Date | null;
  notes: string | null;
  proprietaire: { id: string; label: string };
}

export interface ProprietaireOption {
  id: string;
  label: string;
}

const TYPE_LABEL: Record<OwnershipType, string> = {
  PLEINE_PROPRIETE: "Pleine propriété",
  USUFRUIT: "Usufruit",
  NUE_PROPRIETE: "Nue-propriété",
};

const TYPE_VARIANT: Record<OwnershipType, "default" | "secondary" | "outline"> = {
  PLEINE_PROPRIETE: "default",
  USUFRUIT: "secondary",
  NUE_PROPRIETE: "outline",
};

function fmtDate(d: string | Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

function isActive(row: LotOwnershipRow, at = new Date()): boolean {
  const start = new Date(row.startDate).getTime();
  if (start > at.getTime()) return false;
  if (row.endDate && new Date(row.endDate).getTime() <= at.getTime()) return false;
  return true;
}

function fmtPct(share: number): string {
  return `${(share * 100).toFixed(share === Math.round(share) ? 0 : 2)} %`;
}

export function LotOwnershipSection({
  societyId,
  lotId,
  ownerships,
  proprietaires,
}: {
  societyId: string;
  lotId: string;
  ownerships: LotOwnershipRow[];
  proprietaires: ProprietaireOption[];
}) {
  const [showSplitForm, setShowSplitForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const today = new Date();
  const active = ownerships.filter((o) => isActive(o, today));
  const history = ownerships.filter((o) => !isActive(o, today));

  const hasPP = active.some((o) => o.type === "PLEINE_PROPRIETE");
  const isDismembered = active.some(
    (o) => o.type === "USUFRUIT" || o.type === "NUE_PROPRIETE",
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Crown className="h-4 w-4" />
            Régime de propriété
          </span>
          {hasPP && !isDismembered && proprietaires.length >= 2 && (
            <Button size="sm" variant="outline" onClick={() => setShowSplitForm(true)}>
              <Scissors className="h-4 w-4" />
              Démembrer
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun régime de propriété défini pour ce lot.
          </p>
        ) : (
          <div className="space-y-2">
            {active.map((row) => (
              <ActiveOwnershipRow
                key={row.id}
                row={row}
                societyId={societyId}
                isPending={isPending}
                startTransition={startTransition}
              />
            ))}
          </div>
        )}

        {showSplitForm && (
          <>
            <Separator />
            <SplitForm
              societyId={societyId}
              lotId={lotId}
              proprietaires={proprietaires}
              onClose={() => setShowSplitForm(false)}
              isPending={isPending}
              startTransition={startTransition}
            />
          </>
        )}

        {history.length > 0 && (
          <>
            <Separator />
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Historique ({history.length})
              </summary>
              <div className="mt-3 space-y-1.5">
                {history.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="font-normal">
                        {TYPE_LABEL[row.type]}
                      </Badge>
                      {row.proprietaire.label}
                      <span className="font-medium">{fmtPct(row.share)}</span>
                    </span>
                    <span className="flex items-center gap-1 text-xs">
                      <Calendar className="h-3 w-3" />
                      {fmtDate(row.startDate)} → {fmtDate(row.endDate)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ActiveOwnershipRow({
  row,
  societyId,
  isPending,
  startTransition,
}: {
  row: LotOwnershipRow;
  societyId: string;
  isPending: boolean;
  startTransition: (cb: () => void) => void;
}) {
  const [showEnd, setShowEnd] = useState(false);
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  function handleEnd() {
    startTransition(async () => {
      const result = await endOwnership(societyId, { id: row.id, endDate });
      if (result.success) {
        toast.success("Quote-part clôturée");
        setShowEnd(false);
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Supprimer définitivement cette quote-part ?")) return;
    startTransition(async () => {
      const result = await deleteOwnership(societyId, row.id);
      if (result.success) toast.success("Quote-part supprimée");
      else toast.error(result.error ?? "Erreur");
    });
  }

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={TYPE_VARIANT[row.type]}>{TYPE_LABEL[row.type]}</Badge>
          <span className="text-sm font-medium">{row.proprietaire.label}</span>
          <span className="text-sm text-muted-foreground">{fmtPct(row.share)}</span>
          {row.isViager && (
            <Badge variant="outline" className="text-xs">
              Viager
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          Depuis {fmtDate(row.startDate)}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-2">
        {row.type !== "PLEINE_PROPRIETE" && !showEnd && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowEnd(true)}
            disabled={isPending}
          >
            Mettre fin
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={isPending}
          className="text-destructive hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {showEnd && (
        <div className="mt-2 flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor={`end-${row.id}`} className="text-xs">
              Date de fin
            </Label>
            <Input
              id={`end-${row.id}`}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={isPending}
            />
          </div>
          <Button size="sm" onClick={handleEnd} disabled={isPending}>
            Confirmer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowEnd(false)} disabled={isPending}>
            Annuler
          </Button>
        </div>
      )}
    </div>
  );
}

function SplitForm({
  societyId,
  lotId,
  proprietaires,
  onClose,
  isPending,
  startTransition,
}: {
  societyId: string;
  lotId: string;
  proprietaires: ProprietaireOption[];
  onClose: () => void;
  isPending: boolean;
  startTransition: (cb: () => void) => void;
}) {
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [usufruitierId, setUsufruitierId] = useState(proprietaires[0]?.id ?? "");
  const [nuProprietaireId, setNuProprietaireId] = useState(proprietaires[1]?.id ?? "");
  const [isViager, setIsViager] = useState(true);
  const [birthDate, setBirthDate] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!usufruitierId || !nuProprietaireId) {
      toast.error("Sélectionner l'usufruitier et le nu-propriétaire");
      return;
    }
    if (usufruitierId === nuProprietaireId) {
      toast.error("Usufruitier et nu-propriétaire doivent être différents");
      return;
    }
    startTransition(async () => {
      const result = await splitLotToUsufruct(societyId, {
        lotId,
        startDate,
        usufruit: [
          {
            proprietaireId: usufruitierId,
            share: 1,
            isViager,
            usufruitierBirthDate: isViager && birthDate ? birthDate : null,
          },
        ],
        nuePropriete: [{ proprietaireId: nuProprietaireId, share: 1 }],
        notes: notes.trim() || null,
      });
      if (result.success) {
        toast.success("Démembrement enregistré");
        onClose();
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border bg-muted/30 p-4">
      <h4 className="flex items-center gap-2 text-sm font-medium">
        <Users className="h-4 w-4" />
        Nouveau démembrement
      </h4>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="start-date">Date d&apos;effet</Label>
          <Input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={isPending}
            required
          />
        </div>
        <div className="flex items-end gap-2">
          <input
            id="is-viager"
            type="checkbox"
            checked={isViager}
            onChange={(e) => setIsViager(e.target.checked)}
            disabled={isPending}
            className="h-4 w-4"
          />
          <Label htmlFor="is-viager" className="text-sm font-normal">
            Usufruit viager (sinon temporaire)
          </Label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="usufruitier">Usufruitier</Label>
          <select
            id="usufruitier"
            value={usufruitierId}
            onChange={(e) => setUsufruitierId(e.target.value)}
            disabled={isPending}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            required
          >
            <option value="">— Sélectionner —</option>
            {proprietaires.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="nu-proprietaire">Nu-propriétaire</Label>
          <select
            id="nu-proprietaire"
            value={nuProprietaireId}
            onChange={(e) => setNuProprietaireId(e.target.value)}
            disabled={isPending}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            required
          >
            <option value="">— Sélectionner —</option>
            {proprietaires.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isViager && (
        <div>
          <Label htmlFor="birth-date">Date de naissance de l&apos;usufruitier (barème art. 669 CGI)</Label>
          <Input
            id="birth-date"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            disabled={isPending}
          />
        </div>
      )}

      <div>
        <Label htmlFor="split-notes">Notes</Label>
        <Input
          id="split-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isPending}
          placeholder="Référence acte notarié, convention…"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
          Annuler
        </Button>
        <Button type="submit" disabled={isPending}>
          <Plus className="h-4 w-4" />
          Enregistrer le démembrement
        </Button>
      </div>
    </form>
  );
}
