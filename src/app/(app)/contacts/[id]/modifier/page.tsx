"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { updateContact } from "@/actions/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";

const TYPE_OPTIONS = [
  { value: "PRESTATAIRE", label: "Prestataire" },
  { value: "NOTAIRE", label: "Notaire" },
  { value: "EXPERT", label: "Expert" },
  { value: "SYNDIC", label: "Syndic" },
  { value: "AGENCE", label: "Agence" },
  { value: "LOCATAIRE", label: "Locataire" },
  { value: "AUTRE", label: "Autre" },
];

type ContactData = {
  id: string;
  contactType: string;
  name: string;
  company: string | null;
  specialty: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  addressLine1: string | null;
  city: string | null;
  postalCode: string | null;
  notes: string | null;
};

export default function ModifierContactPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { activeSociety } = useSociety();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState("");
  const [contact, setContact] = useState<ContactData | null>(null);

  useEffect(() => {
    fetch(`/api/contacts/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setContact(data);
        setIsFetching(false);
      })
      .catch(() => setIsFetching(false));
  }, [params.id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety || !contact) return;

    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const result = await updateContact(activeSociety.id, {
      id: contact.id,
      contactType: data.contactType as "PRESTATAIRE" | "NOTAIRE" | "EXPERT" | "SYNDIC" | "AGENCE" | "LOCATAIRE" | "AUTRE",
      name: data.name,
      company: data.company || null,
      specialty: data.specialty || null,
      email: data.email || null,
      phone: data.phone || null,
      mobile: data.mobile || null,
      addressLine1: data.addressLine1 || null,
      city: data.city || null,
      postalCode: data.postalCode || null,
      notes: data.notes || null,
    });

    setIsLoading(false);

    if (result.success) {
      router.push(`/contacts/${params.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  if (isFetching) {
    return <div className="text-sm text-muted-foreground p-6">Chargement...</div>;
  }

  if (!contact) {
    return <div className="text-sm text-destructive p-6">Contact introuvable</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href={`/contacts/${params.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Modifier le contact</h1>
          <p className="text-muted-foreground">{contact.name}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informations principales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactType">Type *</Label>
                <Select
                  id="contactType"
                  name="contactType"
                  options={TYPE_OPTIONS}
                  defaultValue={contact.contactType}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nom / Prénom *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={contact.name}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company">Société</Label>
                <Input
                  id="company"
                  name="company"
                  defaultValue={contact.company ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialty">Spécialité / Fonction</Label>
                <Input
                  id="specialty"
                  name="specialty"
                  defaultValue={contact.specialty ?? ""}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone fixe</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={contact.phone ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile</Label>
                <Input
                  id="mobile"
                  name="mobile"
                  type="tel"
                  defaultValue={contact.mobile ?? ""}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={contact.email ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine1">Adresse</Label>
              <Input
                id="addressLine1"
                name="addressLine1"
                defaultValue={contact.addressLine1 ?? ""}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Code postal</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  defaultValue={contact.postalCode ?? ""}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="city">Ville</Label>
                <Input
                  id="city"
                  name="city"
                  defaultValue={contact.city ?? ""}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={contact.notes ?? ""}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href={`/contacts/${params.id}`}>
            <Button variant="outline" type="button">
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
