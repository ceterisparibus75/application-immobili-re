"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSociety } from "@/providers/society-provider";
import { createSeasonalProperty } from "@/actions/seasonal";
import type { CreateSeasonalPropertyInput } from "@/validations/seasonal";
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
import { ArrowLeft, Home, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const PROPERTY_TYPES = [
  { value: "APARTMENT", label: "Appartement" },
  { value: "HOUSE", label: "Maison" },
  { value: "VILLA", label: "Villa" },
  { value: "STUDIO", label: "Studio" },
  { value: "ROOM", label: "Chambre" },
  { value: "GITE", label: "Gîte" },
  { value: "CHALET", label: "Chalet" },
] as const;

export default function NouveauSaisonnierPage() {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const societyId = activeSociety?.id;
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<CreateSeasonalPropertyInput>({
    name: "",
    description: "",
    address: "",
    city: "",
    postalCode: "",
    country: "France",
    propertyType: "APARTMENT",
    capacity: 2,
    bedrooms: 1,
    bathrooms: 1,
    area: undefined,
    checkInTime: "15:00",
    checkOutTime: "11:00",
    minStay: 1,
  });

  function update<K extends keyof CreateSeasonalPropertyInput>(key: K, value: CreateSeasonalPropertyInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!societyId) return;

    startTransition(async () => {
      const result = await createSeasonalProperty(societyId, form);
      if (result.success && result.data) {
        toast.success("Bien saisonnier créé avec succès");
        router.push(`/saisonnier/${result.data.id}`);
      } else {
        toast.error(result.error ?? "Erreur lors de la création");
      }
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/saisonnier"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Home className="h-5 w-5 text-[var(--color-brand-blue)]" />
            Nouveau bien saisonnier
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ajoutez un bien en location saisonnière
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du bien *</Label>
              <Input
                id="name"
                placeholder="Ex : Studio Montmartre"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type de bien</Label>
                <Select value={form.propertyType} onValueChange={(v) => update("propertyType", v as CreateSeasonalPropertyInput["propertyType"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="area">Surface (m²)</Label>
                <Input
                  id="area"
                  type="number"
                  min={1}
                  placeholder="35"
                  value={form.area ?? ""}
                  onChange={(e) => update("area", e.target.value ? parseFloat(e.target.value) : undefined)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Adresse *</Label>
              <Input
                id="address"
                placeholder="12 rue des Abbesses"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Code postal *</Label>
                <Input
                  id="postalCode"
                  placeholder="75018"
                  value={form.postalCode}
                  onChange={(e) => update("postalCode", e.target.value)}
                  required
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
              <div className="space-y-2">
                <Label htmlFor="country">Pays</Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) => update("country", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Description du bien pour les voyageurs..."
                value={form.description ?? ""}
                onChange={(e) => update("description", e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Capacité & horaires</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacité (pers.) *</Label>
                <Input
                  id="capacity"
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => update("capacity", parseInt(e.target.value) || 1)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bedrooms">Chambres</Label>
                <Input
                  id="bedrooms"
                  type="number"
                  min={0}
                  value={form.bedrooms}
                  onChange={(e) => update("bedrooms", parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bathrooms">Salles de bain</Label>
                <Input
                  id="bathrooms"
                  type="number"
                  min={0}
                  value={form.bathrooms}
                  onChange={(e) => update("bathrooms", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkInTime">Heure d&apos;arrivée</Label>
                <Input
                  id="checkInTime"
                  type="time"
                  value={form.checkInTime}
                  onChange={(e) => update("checkInTime", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkOutTime">Heure de départ</Label>
                <Input
                  id="checkOutTime"
                  type="time"
                  value={form.checkOutTime}
                  onChange={(e) => update("checkOutTime", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStay">Séjour minimum (nuits)</Label>
                <Input
                  id="minStay"
                  type="number"
                  min={1}
                  value={form.minStay}
                  onChange={(e) => update("minStay", parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" asChild>
            <Link href="/saisonnier">Annuler</Link>
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
            Créer le bien
          </Button>
        </div>
      </form>
    </div>
  );
}
