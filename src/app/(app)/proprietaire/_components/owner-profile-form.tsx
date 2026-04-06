"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateOwnerProfile } from "@/actions/owner";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Pencil, X, Save, User, Mail } from "lucide-react";

type Props = {
  profile: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
    birthDate: Date | null;
    birthPlace: string | null;
    address: string | null;
    postalCode: string | null;
    ownerCity: string | null;
    profession: string | null;
    nationality: string | null;
    emailCopyEnabled: boolean;
    emailCopyAddress: string | null;
  };
};
function formatDateForInput(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function formatDateDisplay(date: Date | null): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function OwnerProfileForm({ profile }: Props) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [firstName, setFirstName] = useState(profile.firstName ?? "");
  const [lastName, setLastName] = useState(profile.lastName ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [birthDate, setBirthDate] = useState(formatDateForInput(profile.birthDate));
  const [birthPlace, setBirthPlace] = useState(profile.birthPlace ?? "");
  const [address, setAddress] = useState(profile.address ?? "");
  const [postalCode, setPostalCode] = useState(profile.postalCode ?? "");
  const [ownerCity, setOwnerCity] = useState(profile.ownerCity ?? "");
  const [profession, setProfession] = useState(profile.profession ?? "");
  const [nationality, setNationality] = useState(profile.nationality ?? "");
  const [emailCopyEnabled, setEmailCopyEnabled] = useState(profile.emailCopyEnabled);
  const [emailCopyAddress, setEmailCopyAddress] = useState(profile.emailCopyAddress ?? "");

  function handleCancel() {
    setFirstName(profile.firstName ?? "");
    setLastName(profile.lastName ?? "");
    setPhone(profile.phone ?? "");
    setBirthDate(formatDateForInput(profile.birthDate));
    setBirthPlace(profile.birthPlace ?? "");
    setAddress(profile.address ?? "");
    setPostalCode(profile.postalCode ?? "");
    setOwnerCity(profile.ownerCity ?? "");
    setProfession(profile.profession ?? "");
    setNationality(profile.nationality ?? "");
    setEmailCopyEnabled(profile.emailCopyEnabled);
    setEmailCopyAddress(profile.emailCopyAddress ?? "");
    setEditing(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateOwnerProfile({
        firstName,
        lastName,
        phone: phone || undefined,
        birthDate: birthDate || undefined,
        birthPlace: birthPlace || undefined,
        address: address || undefined,
        postalCode: postalCode || undefined,
        ownerCity: ownerCity || undefined,
        profession: profession || undefined,
        nationality: nationality || undefined,
        emailCopyEnabled,
        emailCopyAddress: emailCopyAddress || undefined,
      });
      if (result.success) {
        toast.success("Profil mis a jour avec succes");
        setEditing(false);
      } else {
        toast.error(result.error ?? "Erreur lors de la mise a jour");
      }
    });
  }

  if (!editing) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Mon profil</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Modifier
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Prenom</p>
              <p className="text-sm font-medium">{profile.firstName || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nom</p>
              <p className="text-sm font-medium">{profile.lastName || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{profile.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Telephone</p>
              <p className="text-sm font-medium">{profile.phone || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date de naissance</p>
              <p className="text-sm font-medium">{formatDateDisplay(profile.birthDate)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lieu de naissance</p>
              <p className="text-sm font-medium">{profile.birthPlace || "-"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-sm text-muted-foreground">Adresse</p>
              <p className="text-sm font-medium">{profile.address || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Code postal</p>
              <p className="text-sm font-medium">{profile.postalCode || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ville</p>
              <p className="text-sm font-medium">{profile.ownerCity || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Profession</p>
              <p className="text-sm font-medium">{profile.profession || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nationalite</p>
              <p className="text-sm font-medium">{profile.nationality || "-"}</p>
            </div>
          </div>

          {/* Section copie emails */}
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Copie des emails locataires</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Recevoir une copie</p>
                <p className="text-sm font-medium">{profile.emailCopyEnabled ? "Activé" : "Désactivé"}</p>
              </div>
              {profile.emailCopyEnabled && (
                <div>
                  <p className="text-sm text-muted-foreground">Adresse de copie</p>
                  <p className="text-sm font-medium">{profile.emailCopyAddress || profile.email}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Mon profil</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prenom *</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                placeholder="Prenom"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom *</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                placeholder="Nom"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile.email}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telephone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="06 12 34 56 78"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthDate">Date de naissance</Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthPlace">Lieu de naissance</Label>
              <Input
                id="birthPlace"
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                placeholder="Ville de naissance"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Adresse complete"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Code postal</Label>
              <Input
                id="postalCode"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="75001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerCity">Ville</Label>
              <Input
                id="ownerCity"
                value={ownerCity}
                onChange={(e) => setOwnerCity(e.target.value)}
                placeholder="Paris"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profession">Profession</Label>
              <Input
                id="profession"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                placeholder="Profession"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationality">Nationalite</Label>
              <Input
                id="nationality"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                placeholder="Francaise"
              />
            </div>
          </div>

          {/* Section copie emails */}
          <div className="pt-6 border-t">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Copie des emails locataires</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Recevez automatiquement en copie (BCC) tous les emails envoyés a vos locataires : factures, quittances, relances, etc.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center space-x-3">
                <Switch
                  id="emailCopyEnabled"
                  checked={emailCopyEnabled}
                  onCheckedChange={setEmailCopyEnabled}
                />
                <Label htmlFor="emailCopyEnabled" className="cursor-pointer">
                  Recevoir une copie des emails
                </Label>
              </div>
              {emailCopyEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="emailCopyAddress">Adresse de copie (optionnel)</Label>
                  <Input
                    id="emailCopyAddress"
                    type="email"
                    value={emailCopyAddress}
                    onChange={(e) => setEmailCopyAddress(e.target.value)}
                    placeholder={profile.email}
                  />
                  <p className="text-xs text-muted-foreground">
                    Laissez vide pour utiliser votre email principal
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isPending}
            >
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              <Save className="h-4 w-4 mr-2" />
              {isPending ? "Enregistrement..." : "Sauvegarder"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
