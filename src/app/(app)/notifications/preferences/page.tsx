"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Bell, Mail, Smartphone, Save } from "lucide-react";

interface NotifPref {
  id: string;
  label: string;
  description: string;
  category: "bail" | "facturation" | "banque" | "maintenance" | "document";
  inApp: boolean;
  email: boolean;
  digest: boolean;
}

const DEFAULT_PREFS: NotifPref[] = [
  { id: "bail_expiring", label: "Bail arrivant à échéance", description: "30, 15 et 7 jours avant la fin du bail", category: "bail", inApp: true, email: true, digest: true },
  { id: "rent_revision", label: "Révision de loyer", description: "Quand une révision est applicable", category: "bail", inApp: true, email: true, digest: true },
  { id: "invoice_overdue", label: "Facture impayée", description: "Quand une facture dépasse l'échéance", category: "facturation", inApp: true, email: true, digest: true },
  { id: "payment_received", label: "Paiement reçu", description: "Quand un paiement est encaissé", category: "facturation", inApp: true, email: false, digest: true },
  { id: "sepa_failed", label: "Prélèvement SEPA échoué", description: "Quand un prélèvement est rejeté", category: "banque", inApp: true, email: true, digest: false },
  { id: "sepa_confirmed", label: "Prélèvement SEPA confirmé", description: "Quand un prélèvement est confirmé", category: "banque", inApp: true, email: false, digest: true },
  { id: "maintenance_completed", label: "Maintenance terminée", description: "Quand une intervention est clôturée", category: "maintenance", inApp: true, email: false, digest: true },
  { id: "diagnostic_expiring", label: "Diagnostic périmé", description: "30 jours avant l'expiration", category: "document", inApp: true, email: true, digest: true },
  { id: "insurance_expiring", label: "Assurance expirée", description: "30 jours avant l'expiration", category: "document", inApp: true, email: true, digest: true },
  { id: "document_signed", label: "Document signé", description: "Quand une signature est complétée", category: "document", inApp: true, email: false, digest: false },
  { id: "ticket_created", label: "Nouveau ticket locataire", description: "Quand un locataire crée un ticket", category: "maintenance", inApp: true, email: true, digest: false },
  { id: "ticket_reply", label: "Réponse à un ticket", description: "Quand un locataire répond à un ticket", category: "maintenance", inApp: true, email: false, digest: false },
];

const CATEGORIES: Record<string, string> = {
  bail: "Baux",
  facturation: "Facturation",
  banque: "Banque",
  maintenance: "Maintenance",
  document: "Documents",
};

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<NotifPref[]>(DEFAULT_PREFS);
  const [digestFrequency, setDigestFrequency] = useState<"daily" | "weekly">("daily");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const togglePref = (id: string, field: "inApp" | "email" | "digest") => {
    setPrefs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: !p[field] } : p))
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    // Simuler la sauvegarde (à connecter à l'API plus tard)
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    setSaved(true);
  };

  const grouped = Object.entries(CATEGORIES).map(([key, label]) => ({
    key,
    label,
    items: prefs.filter((p) => p.category === key),
  }));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-brand-deep)]">
          Préférences de notification
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choisissez comment et quand vous souhaitez être notifié.
        </p>
      </div>

      {/* Digest settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Résumé par email (digest)
          </CardTitle>
          <CardDescription>
            Recevez un récapitulatif de vos notifications par email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="digest"
                checked={digestFrequency === "daily"}
                onChange={() => setDigestFrequency("daily")}
                className="accent-primary"
              />
              <span className="text-sm">Quotidien (8h)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="digest"
                checked={digestFrequency === "weekly"}
                onChange={() => setDigestFrequency("weekly")}
                className="accent-primary"
              />
              <span className="text-sm">Hebdomadaire (lundi 8h)</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Per-notification settings */}
      {grouped.map((group) => (
        <Card key={group.key}>
          <CardHeader>
            <CardTitle className="text-base">{group.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center pb-2 mb-2 border-b text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              <span>Notification</span>
              <span className="w-16 text-center flex items-center justify-center gap-1">
                <Bell className="h-3 w-3" /> App
              </span>
              <span className="w-16 text-center flex items-center justify-center gap-1">
                <Mail className="h-3 w-3" /> Email
              </span>
              <span className="w-16 text-center flex items-center justify-center gap-1">
                <Smartphone className="h-3 w-3" /> Digest
              </span>
            </div>
            {group.items.map((pref) => (
              <div
                key={pref.id}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center py-2.5 border-b last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium">{pref.label}</p>
                  <p className="text-xs text-muted-foreground">{pref.description}</p>
                </div>
                <div className="w-16 flex justify-center">
                  <Checkbox
                    checked={pref.inApp}
                    onCheckedChange={() => togglePref(pref.id, "inApp")}
                  />
                </div>
                <div className="w-16 flex justify-center">
                  <Checkbox
                    checked={pref.email}
                    onCheckedChange={() => togglePref(pref.id, "email")}
                  />
                </div>
                <div className="w-16 flex justify-center">
                  <Checkbox
                    checked={pref.digest}
                    onCheckedChange={() => togglePref(pref.id, "digest")}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Enregistrement…" : "Enregistrer les préférences"}
        </Button>
        {saved && (
          <span className="text-sm text-emerald-600 animate-fade-in">
            Préférences enregistrées
          </span>
        )}
      </div>
    </div>
  );
}
