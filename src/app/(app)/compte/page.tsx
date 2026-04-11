"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check } from "lucide-react";
import { getOwnerProfile, updateOwnerProfile } from "@/actions/owner";
import { toast } from "sonner";

export default function ComptePage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    birthDate: "",
    birthPlace: "",
    address: "",
    postalCode: "",
    ownerCity: "",
    profession: "",
    nationality: "",
    company: "",
  });

  useEffect(() => {
    async function loadProfile() {
      const result = await getOwnerProfile();
      if (result.success && result.data) {
        const d = result.data;
        setForm({
          firstName: d.firstName ?? "",
          lastName: d.lastName ?? "",
          phone: d.phone ?? "",
          birthDate: d.birthDate ? new Date(d.birthDate).toISOString().split("T")[0] : "",
          birthPlace: d.birthPlace ?? "",
          address: d.address ?? "",
          postalCode: d.postalCode ?? "",
          ownerCity: d.ownerCity ?? "",
          profession: d.profession ?? "",
          nationality: d.nationality ?? "",
          company: d.company ?? "",
        });
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Le prénom et le nom sont obligatoires");
      return;
    }
    setSaving(true);
    const result = await updateOwnerProfile(form);
    setSaving(false);
    if (result.success) {
      toast.success("Profil mis à jour");
    } else {
      toast.error(result.error ?? "Erreur lors de la sauvegarde");
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  if (loading) {
    return <div className="animate-pulse space-y-4"><div className="h-32 bg-muted rounded-lg" /><div className="h-48 bg-muted rounded-lg" /></div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identité</CardTitle>
          <CardDescription>
            {session?.user?.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">Prénom *</Label>
              <Input id="firstName" name="firstName" value={form.firstName} onChange={handleChange} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Nom *</Label>
              <Input id="lastName" name="lastName" value={form.lastName} onChange={handleChange} required />
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
          <div className="space-y-1.5">
            <Label htmlFor="company">Société</Label>
            <Input id="company" name="company" value={form.company} onChange={handleChange} placeholder="Nom de votre entreprise (facultatif)" />
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
              <Label htmlFor="ownerCity">Ville</Label>
              <Input id="ownerCity" name="ownerCity" value={form.ownerCity} onChange={handleChange} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enregistrement...</>
          ) : (
            <><Check className="h-4 w-4 mr-2" /> Enregistrer</>
          )}
        </Button>
      </div>
    </form>
  );
}
