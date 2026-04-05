"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Check, User } from "lucide-react";
import { createProprietaire } from "@/actions/proprietaire";
import { toast } from "sonner";
import Link from "next/link";

export default function NouveauProprietairePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    label: "",
    firstName: "",
    lastName: "",
    phone: "",
    birthDate: "",
    birthPlace: "",
    address: "",
    postalCode: "",
    city: "",
    profession: "",
    nationality: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim()) {
      toast.error("Le libellé est obligatoire");
      return;
    }
    setLoading(true);
    const result = await createProprietaire({
      label: form.label,
      firstName: form.firstName || undefined,
      lastName: form.lastName || undefined,
      phone: form.phone || undefined,
      birthDate: form.birthDate || undefined,
      birthPlace: form.birthPlace || undefined,
      address: form.address || undefined,
      postalCode: form.postalCode || undefined,
      city: form.city || undefined,
      profession: form.profession || undefined,
      nationality: form.nationality || undefined,
    });
    setLoading(false);

    if (result.success && result.data) {
      toast.success("Propriétaire créé avec succès");
      router.push(`/proprietaire?pid=${result.data.id}`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur lors de la création");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/proprietaire">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouveau propriétaire</h1>
          <p className="text-sm text-muted-foreground">
            Créez un nouveau profil propriétaire pour gérer un patrimoine distinct
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Identité du propriétaire
            </CardTitle>
            <CardDescription>
              Le libellé permet de distinguer vos différents patrimoines (ex: &quot;Patrimoine personnel&quot;, &quot;SCI familiale&quot;)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="label">Libellé *</Label>
              <Input
                id="label"
                name="label"
                value={form.label}
                onChange={handleChange}
                placeholder="Ex: Patrimoine personnel, SCI Dupont..."
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Prénom</Label>
                <Input id="firstName" name="firstName" value={form.firstName} onChange={handleChange} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Nom</Label>
                <Input id="lastName" name="lastName" value={form.lastName} onChange={handleChange} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="birthDate">Date de naissance</Label>
                <Input id="birthDate" name="birthDate" type="date" value={form.birthDate} onChange={handleChange} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="birthPlace">Lieu de naissance</Label>
                <Input id="birthPlace" name="birthPlace" value={form.birthPlace} onChange={handleChange} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nationality">Nationalité</Label>
                <Input id="nationality" name="nationality" value={form.nationality} onChange={handleChange} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profession">Profession</Label>
                <Input id="profession" name="profession" value={form.profession} onChange={handleChange} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adresse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="address">Adresse</Label>
              <Input id="address" name="address" value={form.address} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="postalCode">Code postal</Label>
                <Input id="postalCode" name="postalCode" value={form.postalCode} onChange={handleChange} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">Ville</Label>
                <Input id="city" name="city" value={form.city} onChange={handleChange} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/proprietaire">
            <Button type="button" variant="outline">Annuler</Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Création...</>
            ) : (
              <><Check className="h-4 w-4 mr-2" /> Créer le propriétaire</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
