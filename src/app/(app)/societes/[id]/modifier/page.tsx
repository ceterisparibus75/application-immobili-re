"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getSocietyById, updateSociety } from "@/actions/society";
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
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, Save, Upload } from "lucide-react";
import Link from "next/link";

const LEGAL_FORMS = [
  { value: "SCI", label: "SCI" },
  { value: "SARL", label: "SARL" },
  { value: "SAS", label: "SAS" },
  { value: "SA", label: "SA" },
  { value: "EURL", label: "EURL" },
  { value: "SASU", label: "SASU" },
  { value: "SNC", label: "SNC" },
  { value: "AUTRE", label: "Autre" },
];

export default function ModifierSocietePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    getSocietyById(id).then((s) => {
      if (!s) return router.push("/societes");
      setForm({
        name: s.name ?? "",
        legalForm: s.legalForm ?? "",
        siret: s.siret ?? "",
        vatNumber: s.vatNumber ?? "",
        addressLine1: s.addressLine1 ?? "",
        addressLine2: s.addressLine2 ?? "",
        city: s.city ?? "",
        postalCode: s.postalCode ?? "",
        country: s.country ?? "France",
        taxRegime: s.taxRegime ?? "IS",
        vatRegime: s.vatRegime ?? "TVA",
        bankName: s.bankName ?? "",
        accountantName: s.accountantName ?? "",
        accountantFirm: s.accountantFirm ?? "",
        accountantEmail: s.accountantEmail ?? "",
        accountantPhone: s.accountantPhone ?? "",
        logoUrl: s.logoUrl ?? "",
        invoicePrefix: s.invoicePrefix ?? "",
        legalMentions: s.legalMentions ?? "",
      });
    });
  }, [id, router]);

  function set(field: string, value: string) {
    setForm((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  async function handleLogoUpload(file: File) {
    setLogoUploading(true);
    try {
      const res = await fetch("/api/storage/signed-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!res.ok) throw new Error("Erreur lors de la signature");
      const { signedUrl, storagePath } = (await res.json()) as { signedUrl: string; storagePath: string };
      await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${storagePath}`;
      set("logoUrl", publicUrl);
    } catch {
      setError("Erreur lors de l'upload du logo");
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError("");

    const result = await updateSociety({ id, ...form });
    if (result.success) {
      router.push(`/societes/${id}`);
    } else {
      setError(result.error ?? "Erreur lors de la mise à jour");
      setSaving(false);
    }
  }

  if (!form) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/societes/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Modifier la société</h1>
          <p className="text-muted-foreground">{form.name}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations légales */}
        <Card>
          <CardHeader>
            <CardTitle>Informations légales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Raison sociale *</Label>
                <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalForm">Forme juridique *</Label>
                <Select id="legalForm" name="legalForm" options={LEGAL_FORMS} value={form.legalForm} onChange={(e) => set("legalForm", e.target.value)} required />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="siret">SIRET *</Label>
                <Input id="siret" value={form.siret} onChange={(e) => set("siret", e.target.value)} maxLength={14} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vatNumber">N° TVA intracommunautaire</Label>
                <Input id="vatNumber" value={form.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} placeholder="FR12345678901" />
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="addressLine1">Adresse *</Label>
              <Input id="addressLine1" value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine2">Complément d'adresse</Label>
              <Input id="addressLine2" value={form.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Code postal *</Label>
                <Input id="postalCode" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} maxLength={5} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ville *</Label>
                <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Pays</Label>
                <Input id="country" value={form.country} onChange={(e) => set("country", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fiscalité */}
        <Card>
          <CardHeader>
            <CardTitle>Fiscalité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="taxRegime">Régime d'imposition *</Label>
                <Select id="taxRegime" name="taxRegime" options={[{ value: "IS", label: "Impôt sur les Sociétés (IS)" }, { value: "IR", label: "Impôt sur le Revenu (IR)" }]} value={form.taxRegime} onChange={(e) => set("taxRegime", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vatRegime">Régime TVA *</Label>
                <Select id="vatRegime" name="vatRegime" options={[{ value: "TVA", label: "Assujetti TVA" }, { value: "FRANCHISE", label: "Franchise de TVA" }]} value={form.vatRegime} onChange={(e) => set("vatRegime", e.target.value)} required />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coordonnées bancaires */}
        <Card>
          <CardHeader>
            <CardTitle>Coordonnées bancaires</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="iban">IBAN</Label>
                <Input id="iban" name="iban" placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX" />
                <p className="text-xs text-muted-foreground">Laissez vide pour ne pas modifier l'IBAN existant</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bic">BIC</Label>
                <Input id="bic" name="bic" placeholder="XXXXXXXX" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankName">Nom de la banque</Label>
              <Input id="bankName" value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Expert-comptable */}
        <Card>
          <CardHeader>
            <CardTitle>Expert-comptable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="accountantName">Nom</Label>
                <Input id="accountantName" value={form.accountantName} onChange={(e) => set("accountantName", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountantFirm">Cabinet</Label>
                <Input id="accountantFirm" value={form.accountantFirm} onChange={(e) => set("accountantFirm", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="accountantEmail">Email</Label>
                <Input id="accountantEmail" type="email" value={form.accountantEmail} onChange={(e) => set("accountantEmail", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountantPhone">Téléphone</Label>
                <Input id="accountantPhone" value={form.accountantPhone} onChange={(e) => set("accountantPhone", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Facturation */}
        <Card>
          <CardHeader>
            <CardTitle>Facturation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo */}
            <div className="space-y-2">
              <Label>Logo (affiché sur les factures)</Label>
              {form.logoUrl && (
                <img src={form.logoUrl} alt="Logo société" className="h-16 object-contain border rounded p-2 bg-white" />
              )}
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <span className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent transition-colors">
                  {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {logoUploading ? "Envoi en cours..." : "Choisir un fichier"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleLogoUpload(file);
                  }}
                />
              </label>
            </div>
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="invoicePrefix">Préfixe des factures</Label>
              <Input id="invoicePrefix" value={form.invoicePrefix} onChange={(e) => set("invoicePrefix", e.target.value)} maxLength={10} placeholder="FAC" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legalMentions">Mentions légales (pied de facture)</Label>
              <Textarea id="legalMentions" value={form.legalMentions} onChange={(e) => set("legalMentions", e.target.value)} rows={3} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </Button>
          <Link href={`/societes/${id}`}>
            <Button type="button" variant="outline">Annuler</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
