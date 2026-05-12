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
import { generateLetter, getAutoFillData, getTenantsWithLease, getBuildingsWithTenants, getOwnerTenantsWithLease } from "@/actions/letter-template";
import { sendLetterByEmail, sendLetterToBuilding, sendLetterToOwnerTenants } from "@/actions/letter-template-email";
import type { BuildingForLetter } from "@/actions/letter-template";

type SendMode = "individual" | "building" | "owner";
type OwnerTenantForLetter = { id: string; name: string; leaseId?: string; societyId?: string; societyName?: string };

export default function GenerateLetterPage() {
  const params = useParams();
  const templateId = params.templateId as string;
  const { activeSociety } = useSociety();
  const societyId = activeSociety?.id;

  const template = BUILTIN_TEMPLATES.find((t) => t.id === templateId);

  const [values, setValues] = useState<Record<string, string>>(() => {
    if (!template) return {};
    return Object.fromEntries(
      template.variables.filter((v) => v.defaultValue).map((v) => [v.key, v.defaultValue!])
    );
  });
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tenants, setTenants] = useState<{ id: string; name: string; leaseId?: string }[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [autoFilling, setAutoFilling] = useState(false);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientsError, setRecipientsError] = useState<string | null>(null);

  // Mode d'envoi
  const [sendMode, setSendMode] = useState<SendMode>("individual");
  const [buildings, setBuildings] = useState<BuildingForLetter[]>([]);
  const [ownerTenants, setOwnerTenants] = useState<OwnerTenantForLetter[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState("");

  // Charger la liste des locataires et des immeubles
  useEffect(() => {
    if (!societyId) {
      setTenants([]);
      setBuildings([]);
      setOwnerTenants([]);
      setRecipientsLoading(false);
      setRecipientsError(null);
      return;
    }

    let cancelled = false;
    setRecipientsLoading(true);
    setRecipientsError(null);

    Promise.all([getTenantsWithLease(societyId), getBuildingsWithTenants(societyId), getOwnerTenantsWithLease(societyId)])
      .then(([tenantsResult, buildingsResult, ownerTenantsResult]) => {
        if (cancelled) return;

        const errors: string[] = [];

        if (tenantsResult.success && tenantsResult.data) {
          setTenants(
            tenantsResult.data.map((t) => ({
              id: t.id,
              name: t.name,
              leaseId: t.leaseId,
            }))
          );
        } else {
          setTenants([]);
          errors.push(tenantsResult.error ?? "Erreur lors du chargement des locataires");
        }

        if (buildingsResult.success && buildingsResult.data) {
          setBuildings(buildingsResult.data);
        } else {
          setBuildings([]);
          errors.push(buildingsResult.error ?? "Erreur lors du chargement des immeubles");
        }

        if (ownerTenantsResult.success && ownerTenantsResult.data) {
          setOwnerTenants(ownerTenantsResult.data);
        } else {
          setOwnerTenants([]);
          errors.push(ownerTenantsResult.error ?? "Erreur lors du chargement des locataires du propriétaire");
        }

        setRecipientsError(errors.length > 0 ? errors.join("\n") : null);
      })
      .catch(() => {
        if (cancelled) return;
        setTenants([]);
        setBuildings([]);
        setOwnerTenants([]);
        setRecipientsError("Erreur lors du chargement des destinataires");
      })
      .finally(() => {
        if (!cancelled) setRecipientsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [societyId]);

  // Auto-remplir les variables
  const handleAutoFill = useCallback(async (tenantId: string) => {
    if (!societyId || !tenantId) return;
    setAutoFilling(true);
    setError(null);

    try {
      const tenant = tenants.find((t) => t.id === tenantId);
      const result = await getAutoFillData(societyId, tenantId, tenant?.leaseId);
      if (result.success && result.data) {
        const d = result.data;
        const today = new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
        const newValues: Record<string, string> = { ...values };

        if (!template) return;

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
            case "destination_bien": newValues[v.key] = d.destinationBien ?? "logement"; break;
          }
        }
        setValues(newValues);
      } else {
        setError(result.error ?? "Erreur lors du pré-remplissage");
      }
    } catch {
      setError("Erreur lors du pré-remplissage");
    } finally {
      setAutoFilling(false);
    }
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
    setError(null);
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
    } else if (!result.success) {
      setError(result.error ?? "Erreur lors du pré-remplissage");
    }
  }, [societyId, values, template]);

  const handleOwnerMode = useCallback(async () => {
    setSendMode("owner");
    setSelectedTenantId("");
    setSelectedBuildingId("");
    if (!societyId) return;

    setError(null);
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
    } else if (!result.success) {
      setError(result.error ?? "Erreur lors du pré-remplissage");
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

  // Envoyer à tous les locataires du propriétaire
  const handleSendToOwner = async () => {
    if (!societyId || !template) return;
    setError(null);
    setSuccess(null);

    setSending(true);
    const result = await sendLetterToOwnerTenants(societyId, {
      templateId,
      commonValues: values,
    });

    if (result.success && result.data) {
      const { sent, errors: sendErrors } = result.data;
      if (sendErrors.length > 0) {
        setSuccess(`${sent} courrier(s) envoyé(s). ${sendErrors.length} erreur(s).`);
        setError(sendErrors.join("\n"));
      } else {
        setSuccess(`${sent} courrier(s) envoyé(s) avec succès aux locataires du propriétaire`);
      }
    } else {
      setError(result.error ?? "Erreur lors de l'envoi aux locataires du propriétaire");
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
  const isGroupedMode = sendMode === "building" || sendMode === "owner";
  const previewRecipientName =
    sendMode === "owner"
      ? ownerTenants[0]?.name ?? "Chaque locataire"
      : sendMode === "building"
        ? selectedBuilding?.tenants[0]?.name ?? "Chaque locataire"
        : values.LOCATAIRE_NOM || "Destinataire";
  const groupedRecipientCount =
    sendMode === "owner"
      ? ownerTenants.length
      : selectedBuilding?.tenants.length ?? 0;
  const previewSubject = values.OBJET || template.subject;

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
                <Button
                  variant={sendMode === "owner" ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                  onClick={handleOwnerMode}
                >
                  <Users className="h-4 w-4" />
                  Tout le propriétaire
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
                  disabled={autoFilling || recipientsLoading}
                />
                {recipientsLoading && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Chargement des destinataires...
                  </p>
                )}
                {recipientsError && (
                  <p className="text-xs text-destructive mt-2 flex items-start gap-1">
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span className="whitespace-pre-line">{recipientsError}</span>
                  </p>
                )}
                {!recipientsLoading && !recipientsError && tenants.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Aucun locataire actif pour cette société.
                  </p>
                )}
                {autoFilling && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Chargement des données...
                  </p>
                )}
              </CardContent>
            </Card>
          ) : sendMode === "building" ? (
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
                  disabled={recipientsLoading}
                />
                {recipientsLoading && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Chargement des destinataires...
                  </p>
                )}
                {recipientsError && (
                  <p className="text-xs text-destructive flex items-start gap-1">
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span className="whitespace-pre-line">{recipientsError}</span>
                  </p>
                )}
                {!recipientsLoading && !recipientsError && buildings.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Aucun immeuble avec locataire actif pour cette société.
                  </p>
                )}
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
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Envoi à tous les locataires du propriétaire
                </CardTitle>
                <CardDescription className="text-xs">
                  Un email séparé sera envoyé à chaque locataire éligible. Les locataires gérés par un tiers sont exclus.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recipientsLoading && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Chargement des destinataires...
                  </p>
                )}
                {recipientsError && (
                  <p className="text-xs text-destructive flex items-start gap-1">
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span className="whitespace-pre-line">{recipientsError}</span>
                  </p>
                )}
                {!recipientsLoading && !recipientsError && ownerTenants.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Aucun locataire éligible avec email pour ce propriétaire.
                  </p>
                )}
                {ownerTenants.length > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {ownerTenants.length} locataire{ownerTenants.length > 1 ? "s" : ""} recevront un email individuel :
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {ownerTenants.map((tenant) => (
                        <li key={`${tenant.societyId ?? ""}-${tenant.id}`}>
                          • {tenant.name}{tenant.societyName ? ` — ${tenant.societyName}` : ""}
                        </li>
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
              {isGroupedMode && (
                <CardDescription className="text-xs">
                  Les champs locataire seront remplis automatiquement pour chaque destinataire
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {template.variables.map((v) => {
                const isTenantField = ["tenant_name", "tenant_address", "lot_address", "lease_start", "lease_end", "rent_amount", "charges_amount", "destination_bien"].includes(v.autoFill ?? "");
                const disabledInGroupedMode = isGroupedMode && isTenantField;

                return (
                  <div key={v.key} className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      {v.label}
                      {v.required && !disabledInGroupedMode && <span className="text-destructive">*</span>}
                      {v.autoFill && values[v.key] && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          auto
                        </Badge>
                      )}
                      {disabledInGroupedMode && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          par locataire
                        </Badge>
                      )}
                    </Label>
                    {v.type === "textarea" ? (
                      <Textarea
                        value={disabledInGroupedMode ? "" : (values[v.key] ?? "")}
                        onChange={(e) => setValues({ ...values, [v.key]: e.target.value })}
                        placeholder={disabledInGroupedMode ? "Rempli automatiquement pour chaque locataire" : v.placeholder}
                        rows={4}
                        disabled={disabledInGroupedMode}
                        className={disabledInGroupedMode ? "opacity-50" : ""}
                      />
                    ) : (
                      <Input
                        type={v.type === "date" ? "date" : v.type === "number" ? "number" : "text"}
                        value={disabledInGroupedMode ? "" : (values[v.key] ?? "")}
                        onChange={(e) => setValues({ ...values, [v.key]: e.target.value })}
                        placeholder={disabledInGroupedMode ? "Rempli automatiquement" : v.placeholder}
                        disabled={disabledInGroupedMode}
                        className={disabledInGroupedMode ? "opacity-50" : ""}
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
          <div className="flex flex-wrap items-center gap-3">
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
            {sendMode === "owner" && ownerTenants.length > 0 && (
              <Button
                onClick={handleSendToOwner}
                disabled={generating || sending}
                className="gap-2 bg-brand-gradient-soft hover:opacity-90 text-white"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
                {sending ? "Envoi en cours..." : `Envoyer à tous les locataires (${ownerTenants.length})`}
              </Button>
            )}
            {sending && isGroupedMode && (
              <p className="text-xs text-muted-foreground">
                Envoi en cours, chaque locataire reçoit un email séparé.
              </p>
            )}
          </div>
        </div>

        {/* Panneau latéral : aperçu */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                {isGroupedMode ? "Aperçu d'un envoi" : "Aperçu"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-white p-4 text-xs space-y-2 max-h-[600px] overflow-y-auto">
                {isGroupedMode && (
                  <div className="mb-3 rounded-md border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <Mail className="h-3.5 w-3.5 text-primary" />
                      {groupedRecipientCount} email{groupedRecipientCount > 1 ? "s" : ""} individuel{groupedRecipientCount > 1 ? "s" : ""}
                    </div>
                    <div className="grid gap-1 text-[10px] text-muted-foreground">
                      <div className="flex justify-between gap-3">
                        <span>Exemple affiché</span>
                        <span className="text-right font-medium text-foreground">{previewRecipientName}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span>Destinataires visibles</span>
                        <span className="text-right font-medium text-foreground">Uniquement le locataire</span>
                      </div>
                    </div>
                  </div>
                )}
                <p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
                  {values.BAILLEUR_NOM || "Expéditeur"}
                </p>
                <p className="text-[10px] text-muted-foreground whitespace-pre-line">
                  {values.BAILLEUR_ADRESSE || "Adresse expéditeur"}
                </p>
                <div className="text-right mt-2">
                  <p className="font-medium">
                    {previewRecipientName}
                  </p>
                  <p className="text-[10px] text-muted-foreground whitespace-pre-line">
                    {isGroupedMode ? "Adresse personnalisée du locataire" : (values.LOCATAIRE_ADRESSE || "Adresse destinataire")}
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3">
                  {values.LIEU || "Lieu"}, le {values.DATE || "..."}
                </p>
                <div className="border-t pt-2 mt-2">
                  <p className="font-semibold text-primary text-[11px]">
                    Objet : {previewSubject}
                  </p>
                </div>
                <div
                  className="mt-2 prose prose-xs text-[10px] leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: previewHtml(template.bodyHtml, values, isGroupedMode),
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
              {isGroupedMode ? (
                <p>
                  En mode groupé, un courrier personnalisé est généré pour
                  chaque locataire éligible, envoyé dans un email séparé et
                  sauvegardé dans son espace personnel (portail locataire).
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
  const tenantKeys = ["LOCATAIRE_NOM", "LOCATAIRE_ADRESSE", "ADRESSE_LOT", "DATE_DEBUT_BAIL", "DATE_FIN_BAIL", "MONTANT_LOYER", "MONTANT_CHARGES", "DESTINATION_BIEN"];
  return bodyHtml.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (isBuildingMode && tenantKeys.includes(key)) {
      return `<span class="text-muted-foreground italic">[par locataire]</span>`;
    }
    const val = values[key];
    if (val) return `<strong class="text-primary">${val}</strong>`;
    return `<span class="text-muted-foreground italic">[${key}]</span>`;
  });
}
