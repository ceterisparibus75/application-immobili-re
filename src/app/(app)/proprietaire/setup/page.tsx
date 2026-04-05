"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, User, Briefcase, LogOut } from "lucide-react";
import { updateOwnerProfile } from "@/actions/owner";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

type OwnerType = null | "societe" | "physique";

export default function ProprietaireSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [ownerType, setOwnerType] = useState<OwnerType>(null);
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
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Le prénom et le nom sont obligatoires");
      return;
    }
    setLoading(true);
    const result = await updateOwnerProfile(form);
    setLoading(false);
    if (!result.success) {
      toast.error(result.error ?? "Erreur lors de la sauvegarde");
      return;
    }

    if (ownerType === "societe") {
      router.push("/societes/nouvelle");
    } else {
      // Pour une personne physique, créer une société "personnelle" automatiquement
      router.push("/societes/nouvelle?type=physique");
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-8">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
              <User className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Votre profil propriétaire</h1>
          <p className="text-muted-foreground text-sm">
            Renseignez vos informations personnelles pour commencer.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Se déconnecter
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Identité
              </CardTitle>
              <CardDescription>Vos informations personnelles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">Prénom *</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="Jean"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Nom *</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Dupont"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+33 6 12 34 56 78"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="birthDate">Date de naissance</Label>
                  <Input
                    id="birthDate"
                    name="birthDate"
                    type="date"
                    value={form.birthDate}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="birthPlace">Lieu de naissance</Label>
                  <Input
                    id="birthPlace"
                    name="birthPlace"
                    value={form.birthPlace}
                    onChange={handleChange}
                    placeholder="Paris"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nationality">Nationalité</Label>
                <Input
                  id="nationality"
                  name="nationality"
                  value={form.nationality}
                  onChange={handleChange}
                  placeholder="Française"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profession">Profession</Label>
                <Input
                  id="profession"
                  name="profession"
                  value={form.profession}
                  onChange={handleChange}
                  placeholder="Investisseur immobilier"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Adresse</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="12 rue de la Paix"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="postalCode">Code postal</Label>
                  <Input
                    id="postalCode"
                    name="postalCode"
                    value={form.postalCode}
                    onChange={handleChange}
                    placeholder="75001"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ownerCity">Ville</Label>
                  <Input
                    id="ownerCity"
                    name="ownerCity"
                    value={form.ownerCity}
                    onChange={handleChange}
                    placeholder="Paris"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Choix du type de gestion */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Comment gérez-vous vos biens ?</CardTitle>
              <CardDescription>
                Vous pourrez toujours ajouter une société plus tard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setOwnerType("physique")}
                  className={`flex flex-col items-center gap-3 rounded-xl border-2 p-5 text-center transition-all hover:border-primary/50 ${
                    ownerType === "physique"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border"
                  }`}
                >
                  <User className={`h-8 w-8 ${ownerType === "physique" ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <p className="font-semibold text-sm">En nom propre</p>
                    <p className="text-xs text-muted-foreground mt-1">Personne physique, sans société</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOwnerType("societe")}
                  className={`flex flex-col items-center gap-3 rounded-xl border-2 p-5 text-center transition-all hover:border-primary/50 ${
                    ownerType === "societe"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border"
                  }`}
                >
                  <Briefcase className={`h-8 w-8 ${ownerType === "societe" ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <p className="font-semibold text-sm">Via une société</p>
                    <p className="text-xs text-muted-foreground mt-1">SCI, SARL, SAS, etc.</p>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            size="lg"
            className="w-full gap-2"
            disabled={loading || !ownerType}
          >
            {loading ? (
              "Enregistrement..."
            ) : ownerType === "societe" ? (
              <>Continuer vers la création de société <ArrowRight className="h-4 w-4" /></>
            ) : ownerType === "physique" ? (
              <>Créer mon espace propriétaire <ArrowRight className="h-4 w-4" /></>
            ) : (
              "Sélectionnez un mode de gestion"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
