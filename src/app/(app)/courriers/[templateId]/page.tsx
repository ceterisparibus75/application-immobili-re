"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Download,
  Loader2,
  AlertCircle,
  FileText,
  Sparkles,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";
import { BUILTIN_TEMPLATES } from "@/lib/letter-templates";
import { generateLetter, getAutoFillData, getTenantsWithLease } from "@/actions/letter-template";
import { sendLetterByEmail } from "@/actions/letter-template-email";

export default function GenerateLetterPage() {
  const params = useParams();
  const templateId = params.templateId as string;
  const { activeSociety } = useSociety();
  const societyId = activeSociety?.id;

  const template = BUILTIN_TEMPLATES.find((t) => t.id === templateId);

  const [values, setValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tenants, setTenants] = useState<{ id: string; name: string; leaseId?: string }[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [autoFilling, setAutoFilling] = useState(false);

  // Charger la liste des locataires
  useEffect(() => {
    if (!societyId) return;
    getTenantsWithLease(societyId).then((result) => {
      if (result.success && result.data) {
        setTenants(
          result.data.map((t) => ({
            id: t.id,
            name: `${t.firstName} ${t.lastName}`.trim() || "—",
            leaseId: t.leaseId,
          }))
        );
      }
    });
  }, [societyId]);

  // Auto-remplir les variables
  const handleAutoFill = useCallback(async (tenantId: string) => {
    if (!societyId || !tenantId) return;
    setAutoFilling(true);
    const tenant = tenants.find((t) => t.id === tenantId);
    const result = await getAutoFillData(societyId, tenantId, tenant?.leaseId);
    if (result.success && result.data) {
      const d = result.data;
      const today = new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
      const newValues: Record<string, string> = { ...values };

      if (!template) { setAutoFilling(false); return; }

      for (const v of template.variables) {
        switch (v.autoFill) {
          case "society_name": newValues[v.key] = d.societyName; break;
          case "society_address": newValues[v.key] = d.societyAddress; break;
          case "society_siret": newValues[v.key] = d.societySiret; break;
          case "today": newValues[v.key] = today; break;
          case "tenant_name": if (d.tenantName) newValues[v.key] = d.tenantName; break;
          case "tenant_address": if (d.tenantAddress) newValues[v.key] = d.tenantAddress; break;
          case "lot_address": if (d.lotAddress) newValues[v.key] = d.lotAddress; break;
          case "lease_start": if (d.leaseStart) newValues[v.key] = d.leaseStart; break;
          case "lease_end": if (d.leaseEnd) newValues[v.key] = d.leaseEnd; break;
          case "rent_amount": if (d.rentAmount) newValues[v.key] = d.rentAmount; break;
          case "charges_amount": if (d.chargesAmount) newValues[v.key] = d.chargesAmount; break;
        }
      }
      setValues(newValues);
    }
    setAutoFilling(false);
  }, [societyId, tenants, values, template]);

  // Quand un locataire est sélectionné
  const handleTenantChange = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    if (tenantId) {
      handleAutoFill(tenantId);
    }
  };

  // Générer le PDF
  const handleGenerate = async () => {
    if (!societyId || !template) return;
    setError(null);
    setSuccess(null);

    // Vérifier les champs requis
    for (const v of template.variables) {
      if (v.required && !values[v.key]?.trim()) {
        setError(`Le champ "${v.label}" est requis`);
        return;
      }
    }

    setGenerating(true);
    const result = await generateLetter(societyId, {
      templateId,
      values,
      tenantId: selectedTenantId || undefined,
    });

    if (result.success && result.data) {
      // Télécharger le PDF
      const bytes = Uint8Array.from(atob(result.data.buffer), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess("Courrier généré avec succès");
    } else {
      setError(result.error ?? "Erreur lors de la génération");
    }
    setGenerating(false);
  };

  // Envoyer par email
  const handleSendEmail = async () => {
    if (!societyId || !template || !selectedTenantId) return;
    setError(null);
    setSuccess(null);

    for (const v of template.variables) {
      if (v.required && !values[v.key]?.trim()) {
        setError(`Le champ "${v.label}" est requis`);
        return;
      }
    }

    setSending(true);
    const result = await sendLetterByEmail(societyId, {
      templateId,
      values,
      tenantId: selectedTenantId,
    });

    if (result.success) {
      setSuccess("Courrier envoyé par email avec succès");
    } else {
      setError(result.error ?? "Erreur lors de l'envoi");
    }
    setSending(false);
  };

  if (!template) {
    return (
      <div className="space-y-6">
        <Link href="/courriers">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Button>
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Modèle introuvable</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Link href="/courriers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{template.name}</h1>
          <p className="text-muted-foreground text-sm">{template.description}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Formulaire */}
        <div className="lg:col-span-2 space-y-4">
          {/* Sélection du locataire pour auto-remplissage */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Pré-remplissage automatique
              </CardTitle>
              <CardDescription className="text-xs">
                Sélectionnez un locataire pour remplir automatiquement les champs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NativeSelect
                options={[
                  { value: "", label: "-- Sélectionner un locataire --" },
                  ...tenants.map((t) => ({ value: t.id, label: t.name })),
                ]}
                value={selectedTenantId}
                onChange={(e) => handleTenantChange(e.target.value)}
                disabled={autoFilling}
              />
              {autoFilling && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Chargement des données...
                </p>
              )}
            </CardContent>
          </Card>

          {/* Champs du courrier */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Informations du courrier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {template.variables.map((v) => (
                <div key={v.key} className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    {v.label}
                    {v.required && <span className="text-destructive">*</span>}
                    {v.autoFill && values[v.key] && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        auto
                      </Badge>
                    )}
                  </Label>
                  {v.type === "textarea" ? (
                    <Textarea
                      value={values[v.key] ?? ""}
                      onChange={(e) => setValues({ ...values, [v.key]: e.target.value })}
                      placeholder={v.placeholder}
                      rows={4}
                    />
                  ) : (
                    <Input
                      type={v.type === "date" ? "date" : v.type === "number" ? "number" : "text"}
                      value={values[v.key] ?? ""}
                      onChange={(e) => setValues({ ...values, [v.key]: e.target.value })}
                      placeholder={v.placeholder}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Messages */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-3">
              <FileText className="h-4 w-4 flex-shrink-0" />
              {success}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleGenerate} disabled={generating || sending} className="gap-2">
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Générer le PDF
            </Button>
            {selectedTenantId && (
              <Button
                variant="outline"
                onClick={handleSendEmail}
                disabled={generating || sending}
                className="gap-2"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Envoyer par email
              </Button>
            )}
          </div>
        </div>

        {/* Panneau latéral : aperçu */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Aperçu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-white p-4 text-xs space-y-2 max-h-[600px] overflow-y-auto">
                <p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
                  {values.BAILLEUR_NOM || "Expéditeur"}
                </p>
                <p className="text-[10px] text-muted-foreground whitespace-pre-line">
                  {values.BAILLEUR_ADRESSE || "Adresse expéditeur"}
                </p>
                <div className="text-right mt-2">
                  <p className="font-medium">{values.LOCATAIRE_NOM || "Destinataire"}</p>
                  <p className="text-[10px] text-muted-foreground whitespace-pre-line">
                    {values.LOCATAIRE_ADRESSE || "Adresse destinataire"}
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3">
                  {values.LIEU || "Lieu"}, le {values.DATE || "..."}
                </p>
                <div className="border-t pt-2 mt-2">
                  <p className="font-semibold text-primary text-[11px]">
                    Objet : {template.subject}
                  </p>
                </div>
                <div
                  className="mt-2 prose prose-xs text-[10px] leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: previewHtml(template.bodyHtml, values),
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Informations</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>
                Ce modèle de courrier est conforme à la législation en vigueur
                (loi n°89-462 du 6 juillet 1989).
              </p>
              <p>
                Le PDF généré peut être imprimé ou envoyé directement par email
                au locataire sélectionné.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Prévisualise le HTML en remplaçant les variables par les valeurs saisies ou des placeholders */
function previewHtml(bodyHtml: string, values: Record<string, string>): string {
  return bodyHtml.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = values[key];
    if (val) return `<strong class="text-primary">${val}</strong>`;
    return `<span class="text-muted-foreground italic">[${key}]</span>`;
  });
}
