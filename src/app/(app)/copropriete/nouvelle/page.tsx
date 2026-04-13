"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSociety } from "@/providers/society-provider";
import { createCopropriete } from "@/actions/copropriete";
import type { CreateCoproprieteInput } from "@/validations/copropriete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Landmark, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const MONTHS = [
  { value: "1", label: "Janvier" },
  { value: "2", label: "Février" },
  { value: "3", label: "Mars" },
  { value: "4", label: "Avril" },
  { value: "5", label: "Mai" },
  { value: "6", label: "Juin" },
  { value: "7", label: "Juillet" },
  { value: "8", label: "Août" },
  { value: "9", label: "Septembre" },
  { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Décembre" },
];

export default function NouvelleCoproprietePage() {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const societyId = activeSociety?.id;
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<CreateCoproprieteInput>({
    name: "",
    address: "",
    city: "",
    postalCode: "",
    totalTantiemes: 10000,
    fiscalYearStart: 1,
    siret: "",
    notes: "",
  });

  function update<K extends keyof CreateCoproprieteInput>(key: K, value: CreateCoproprieteInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!societyId) return;

    startTransition(async () => {
      const result = await createCopropriete(societyId, form);
      if (result.success && result.data) {
        toast.success("Copropriété créée avec succès");
        router.push(`/copropriete/${result.data.id}`);
      } else {
        toast.error(result.error ?? "Erreur lors de la création");
      }
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/copropriete"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Landmark className="h-5 w-5 text-[var(--color-brand-blue)]" />
            Nouvelle copropriété
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Renseignez les informations de la copropriété
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations générales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de la copropriété *</Label>
              <Input
                id="name"
                placeholder="Ex : Résidence Les Lilas"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Adresse *</Label>
              <Input
                id="address"
                placeholder="12 rue des Lilas"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Code postal *</Label>
                <Input
                  id="postalCode"
                  placeholder="75001"
                  value={form.postalCode}
                  onChange={(e) => update("postalCode", e.target.value)}
                  required
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ville *</Label>
                <Input
                  id="city"
                  placeholder="Paris"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="siret">SIRET (optionnel)</Label>
              <Input
                id="siret"
                placeholder="123 456 789 00012"
                value={form.siret ?? ""}
                onChange={(e) => update("siret", e.target.value)}
                maxLength={14}
              />
            </div>
          </CardContent>
        </Card>

        {/* Paramètres */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paramètres</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalTantiemes">Nombre total de tantièmes *</Label>
                <Input
                  id="totalTantiemes"
                  type="number"
                  min={1}
                  value={form.totalTantiemes}
                  onChange={(e) => update("totalTantiemes", parseInt(e.target.value) || 0)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Généralement 1 000 ou 10 000
                </p>
              </div>
              <div className="space-y-2">
                <Label>Début de l&apos;exercice fiscal</Label>
                <Select
                  value={String(form.fiscalYearStart)}
                  onValueChange={(v) => update("fiscalYearStart", parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes (optionnel)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Informations complémentaires sur la copropriété..."
              value={form.notes ?? ""}
              onChange={(e) => update("notes", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" asChild>
            <Link href="/copropriete">Annuler</Link>
          </Button>
          <Button
            type="submit"
            disabled={isPending || !form.name || !form.address || !form.city || !form.postalCode}
            className="gap-1.5 bg-brand-gradient-soft hover:opacity-90 text-white"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Créer la copropriété
          </Button>
        </div>
      </form>
    </div>
  );
}
