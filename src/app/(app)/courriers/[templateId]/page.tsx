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
  Building2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";
import { BUILTIN_TEMPLATES } from "@/lib/letter-templates";
import { generateLetter, getAutoFillData, getTenantsWithLease, getBuildingsWithTenants } from "@/actions/letter-template";
import { sendLetterByEmail, sendLetterToBuilding } from "@/actions/letter-template-email";
import type { BuildingForLetter } from "@/actions/letter-template";

type SendMode = "individual" | "building";

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

  // Mode d'envoi
  const [sendMode, setSendMode] = useState<SendMode>("individual");
  const [buildings, setBuildings] = useState<BuildingForLetter[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState("");

  // Charger la liste des locataires et des immeubles
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
    getBuildingsWithTenants(societyId).then((result) => {
      if (result.success && result.data) {
        setBuildings(result.data);
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

  // Auto-remplir les champs société quand on passe en mode immeuble
  const handleBuildingSelect = useCallback(async (buildingId: string) => {
    setSelectedBuildingId(buildingId);
    if (!societyId || !buildingId) return;

    // Auto-remplir les champs société (pas les champs locataire)
    const result = await getAutoFillData(societyId);
    if (result.success && result.data && template) {
      const d = result.data;
      const today = new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
      const newValues: Record<string, string> = { ...values };
      for (const v of template.variables) {
        switch (v.autoFill) {
          case "society_name": newValues[v.key] = d.societyName; break;
          case "society_address": newValues[v.key] = d.societyAddress; break;
          case "society_siret": newValues[v.key] = d.societySiret; break;
          case "today": newValues[v.key] = today; break;
        }
      }
      setValues(newValues);
    }
  }, [societyId, values, template]);

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

  // Envoyer par email (individuel)
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
      setSuccess("Courrier envoyé par email et sauvegardé dans l'espace du locataire");
    } else {
      setError(result.error ?? "Erreur lors de l'envoi");
    }
    setSending(false);
  };

  // Envoyer à tout l'immeuble
  const handleSendToBuilding = async () => {
    if (!societyId || !template || !selectedBuildingId) return;
    setError(null);
    setSuccess(null);

    setSending(true);
    const result = await sendLetterToBuilding(societyId, {
      templateId,
      buildingId: selectedBuildingId,
      commonValues: values,
    });

    if (result.success && result.data) {
      const { sent, errors: sendErrors } = result.data;
      if (sendErrors.length > 0) {
        setSuccess(`${sent} courrier(s) envoyé(s). ${sendErrors.length} erreur(s).`);
        setError(sendErrors.join("\n"));
      } else {
        setSuccess(`${sent} courrier(s) envoyé(s) avec succès à tout l'immeuble`);
      }
    } else {
      setError(result.error ?? "Erreur lors de l'envoi groupé");
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

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);

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
          {/* Mode d'envoi */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Mode d&apos;envoi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant={sendMode === "individual" ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                  onClick={() => { setSendMode("individual"); setSelectedBuildingId(""); }}
                >
                  <Mail className="h-4 w-4" />
                  Locataire individuel
                </Button>
                <Button
                  variant={sendMode === "building" ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                  onClick={() => { setSendMode("building"); setSelectedTenantId(""); }}
                >
                  <Building2 className="h-4 w-4" />
                  Par immeuble
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sélection locataire OU immeuble */}
          {sendMode === "individual" ? (
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
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Envoi groupé par immeuble
                </CardTitle>
                <CardDescription className="text-xs">
                  Le courrier sera personnalisé et envoyé à chaque locataire de l&apos;immeuble
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <NativeSelect
                  options={[
                    { value: "", label: "-- Sélectionner un immeuble --" },
                    ...buildings.map((b) => ({
                      value: b.id,
                      label: `${b.name} — ${b.city} (${b.tenants.length} locataire${b.tenants.length > 1 ? "s" : ""})`,
                    })),
                  ]}
                  value={selectedBuildingId}
                  onChange={(e) => handleBuildingSelect(e.target.value)}
                />
                {selectedBuilding && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {selectedBuilding.tenants.length} locataire{selectedBuilding.tenants.length > 1 ? "s" : ""} recevront le courrier :
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {selectedBuilding.tenants.map((t) => (
                        <li key={t.id}>• {t.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Champs du courrier */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Informations du courrier</CardTitle>
              {sendMode === "building" && (
                <CardDescription className="text-xs">
                  Les champs locataire seront remplis automatiquement pour chaque destinataire
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {template.variables.map((v) => {
                const isTenantField = ["tenant_name", "tenant_address", "lot_address", "lease_start", "lease_end", "rent_amount", "charges_amount"].includes(v.autoFill ?? "");
                const disabledInBuilding = sendMode === "building" && isTenantField;

                return (
                  <div key={v.key} className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      {v.label}
                      {v.required && !disabledInBuilding && <span className="text-destructive">*</span>}
                      {v.autoFill && values[v.key] && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          auto
                        </Badge>
                      )}
                      {disabledInBuilding && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          par locataire
                        </Badge>
                      )}
                    </Label>
                    {v.type === "textarea" ? (
                      <Textarea
                        value={disabledInBuilding ? "" : (values[v.key] ?? "")}
                        onChange={(e) => setValues({ ...values, [v.key]: e.target.value })}
                        placeholder={disabledInBuilding ? "Rempli automatiquement pour chaque locataire" : v.placeholder}
                        rows={4}
                        disabled={disabledInBuilding}
                        className={disabledInBuilding ? "opacity-50" : ""}
                      />
                    ) : (
                      <Input
                        type={v.type === "date" ? "date" : v.type === "number" ? "number" : "text"}
                        value={disabledInBuilding ? "" : (values[v.key] ?? "")}
                        onChange={(e) => setValues({ ...values, [v.key]: e.target.value })}
                        placeholder={disabledInBuilding ? "Rempli automatiquement" : v.placeholder}
                        disabled={disabledInBuilding}
                        className={disabledInBuilding ? "opacity-50" : ""}
                      />
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Messages */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="whitespace-pre-line">{error}</span>
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
            {sendMode === "individual" && (
              <>
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
              </>
            )}
            {sendMode === "building" && selectedBuildingId && (
              <Button
                onClick={handleSendToBuilding}
                disabled={generating || sending}
                className="gap-2 bg-brand-gradient-soft hover:opacity-90 text-white"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
                Envoyer à tout l&apos;immeuble ({selectedBuilding?.tenants.length ?? 0} locataire{(selectedBuilding?.tenants.length ?? 0) > 1 ? "s" : ""})
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
                  <p className="font-medium">
                    {sendMode === "building" ? "[Chaque locataire]" : (values.LOCATAIRE_NOM || "Destinataire")}
                  </p>
                  <p className="text-[10px] text-muted-foreground whitespace-pre-line">
                    {sendMode === "building" ? "[Adresse du locataire]" : (values.LOCATAIRE_ADRESSE || "Adresse destinataire")}
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
                    __html: previewHtml(template.bodyHtml, values, sendMode === "building"),
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
              {sendMode === "building" ? (
                <p>
                  En mode immeuble, un courrier personnalisé est généré pour
                  chaque locataire, envoyé par email et sauvegardé dans
                  son espace personnel (portail locataire).
                </p>
              ) : (
                <p>
                  Le PDF généré peut être imprimé ou envoyé directement par email
                  au locataire sélectionné. Le courrier sera aussi disponible
                  dans l&apos;espace personnel du locataire.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Prévisualise le HTML en remplaçant les variables par les valeurs saisies ou des placeholders */
function previewHtml(bodyHtml: string, values: Record<string, string>, isBuildingMode: boolean): string {
  const tenantKeys = ["LOCATAIRE_NOM", "LOCATAIRE_ADRESSE", "ADRESSE_LOT", "DATE_DEBUT_BAIL", "DATE_FIN_BAIL", "MONTANT_LOYER", "MONTANT_CHARGES"];
  return bodyHtml.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (isBuildingMode && tenantKeys.includes(key)) {
      return `<span class="text-muted-foreground italic">[par locataire]</span>`;
    }
    const val = values[key];
    if (val) return `<strong class="text-primary">${val}</strong>`;
    return `<span class="text-muted-foreground italic">[${key}]</span>`;
  });
}
