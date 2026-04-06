"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarClock,
  Plus,
  Trash2,
  Mail,
  X,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Clock,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";
import {
  getReportSchedules,
  createReportSchedule,
  deleteReportSchedule,
  toggleReportSchedule,
} from "@/actions/report-schedule";
import { CONSOLIDABLE_REPORT_TYPES, REPORT_FREQUENCIES } from "@/validations/report";

// ── Labels ───────────────────────────────────────────────────────

const REPORT_LABELS: Record<string, string> = {
  SITUATION_LOCATIVE: "Situation locative",
  COMPTE_RENDU_GESTION: "Compte-rendu de gestion",
  BALANCE_AGEE: "Balance âgée & impayés",
  SUIVI_MENSUEL: "Suivi mensuel",
  VACANCE_LOCATIVE: "Vacance locative",
};

const FREQUENCY_LABELS: Record<string, string> = {
  MENSUEL: "Mensuel",
  TRIMESTRIEL: "Trimestriel",
  SEMESTRIEL: "Semestriel",
  ANNUEL: "Annuel",
};

const FREQUENCY_OPTIONS = REPORT_FREQUENCIES.map((f) => ({
  value: f,
  label: FREQUENCY_LABELS[f],
}));

// ── Types ────────────────────────────────────────────────────────

interface Schedule {
  id: string;
  name: string;
  frequency: string;
  reportTypes: string[];
  recipients: string[];
  isActive: boolean;
  lastSentAt: Date | null;
  nextRunAt: Date;
  createdBy: { name: string | null; email: string };
  createdAt: Date;
}

// ── Composant principal ──────────────────────────────────────────

export default function PlanificationPage() {
  const { activeSociety } = useSociety();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);

  const societyId = activeSociety?.id;

  useEffect(() => {
    if (!societyId) return;
    let cancelled = false;
    getReportSchedules(societyId).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) setSchedules(result.data.schedules);
      else setError(result.error ?? "Erreur de chargement");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [societyId]);

  const reload = () => {
    if (!societyId) return;
    setLoading(true);
    getReportSchedules(societyId).then((result) => {
      if (result.success && result.data) setSchedules(result.data.schedules);
      setLoading(false);
    });
  };

  const handleToggle = async (schedule: Schedule) => {
    if (!societyId) return;
    const result = await toggleReportSchedule(societyId, schedule.id, !schedule.isActive);
    if (result.success) {
      setSchedules((prev) =>
        prev.map((s) => (s.id === schedule.id ? { ...s, isActive: !s.isActive } : s))
      );
    }
  };

  const handleDelete = async () => {
    if (!societyId || !deleteTarget) return;
    const result = await deleteReportSchedule(societyId, deleteTarget.id);
    if (result.success) {
      setSchedules((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  const formatDate = (d: Date | null) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/rapports">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Planification des rapports</h1>
            <p className="text-muted-foreground">
              Configurez l&apos;envoi automatique de rapports consolidés par email
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle planification
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : schedules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarClock className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Aucune planification configurée</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Créez une planification pour recevoir automatiquement vos rapports consolidés
              par email selon la fréquence de votre choix.
            </p>
            <Button onClick={() => setShowCreate(true)} className="mt-4 gap-2" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Créer une planification
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <Send className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">{schedule.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Créé par {schedule.createdBy.name ?? schedule.createdBy.email}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={schedule.isActive}
                      onCheckedChange={() => handleToggle(schedule)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(schedule)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {FREQUENCY_LABELS[schedule.frequency] ?? schedule.frequency}
                  </Badge>
                  {schedule.reportTypes.map((type) => (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {REPORT_LABELS[type] ?? type}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {schedule.recipients.join(", ")}
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground border-t pt-2">
                  <span>
                    Prochain envoi : <strong className="text-foreground">{formatDate(schedule.nextRunAt)}</strong>
                  </span>
                  {schedule.lastSentAt && (
                    <span>Dernier envoi : {formatDate(schedule.lastSentAt)}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogue de création */}
      {showCreate && societyId && (
        <CreateScheduleDialog
          societyId={societyId}
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            reload();
          }}
        />
      )}

      {/* Dialogue de confirmation suppression */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la planification ?</DialogTitle>
            <DialogDescription>
              La planification &quot;{deleteTarget?.name}&quot; sera définitivement supprimée.
              Les rapports déjà envoyés ne sont pas affectés.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Dialogue de création ─────────────────────────────────────────

function CreateScheduleDialog({
  societyId,
  open,
  onClose,
  onCreated,
}: {
  societyId: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<string>("MENSUEL");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const addRecipient = () => {
    const raw = emailInput.trim();
    if (!raw) return;

    // Découper sur ; , ou espace pour accepter plusieurs emails d'un coup
    const emails = raw
      .split(/[;,\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const invalids: string[] = [];
    const added: string[] = [];

    for (const email of emails) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        invalids.push(email);
        continue;
      }
      if (recipients.includes(email) || added.includes(email)) continue;
      added.push(email);
    }

    if (invalids.length > 0) {
      setError(`Adresse${invalids.length > 1 ? "s" : ""} invalide${invalids.length > 1 ? "s" : ""} : ${invalids.join(", ")}`);
    } else {
      setError(null);
    }

    if (added.length > 0) {
      setRecipients((prev) => [...prev, ...added]);
      setEmailInput("");
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((r) => r !== email));
  };

  const handleSubmit = async () => {
    setError(null);

    if (!name.trim()) {
      setError("Le nom est requis");
      return;
    }
    if (selectedTypes.length === 0) {
      setError("Sélectionnez au moins un type de rapport");
      return;
    }
    if (recipients.length === 0) {
      setError("Ajoutez au moins un destinataire");
      return;
    }

    setSaving(true);
    const result = await createReportSchedule(societyId, {
      name: name.trim(),
      frequency: frequency as "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL",
      reportTypes: selectedTypes as Array<(typeof CONSOLIDABLE_REPORT_TYPES)[number]>,
      recipients,
    });

    if (result.success) {
      onCreated();
    } else {
      setError(result.error ?? "Erreur lors de la création");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle planification</DialogTitle>
          <DialogDescription>
            Configurez un envoi automatique de rapports consolidés par email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nom */}
          <div className="space-y-1.5">
            <Label className="text-xs">Nom de la planification</Label>
            <Input
              placeholder="Ex: Rapport trimestriel investisseurs"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Fréquence */}
          <div className="space-y-1.5">
            <Label className="text-xs">Fréquence d&apos;envoi</Label>
            <NativeSelect
              options={FREQUENCY_OPTIONS}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            />
          </div>

          {/* Types de rapports */}
          <div className="space-y-1.5">
            <Label className="text-xs">Rapports à inclure</Label>
            <div className="grid grid-cols-2 gap-2">
              {CONSOLIDABLE_REPORT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={`text-left text-xs px-3 py-2 rounded-md border transition-colors ${
                    selectedTypes.includes(type)
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {REPORT_LABELS[type] ?? type}
                </button>
              ))}
            </div>
          </div>

          {/* Destinataires */}
          <div className="space-y-1.5">
            <Label className="text-xs">Destinataires</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="email@exemple.com (séparez par ; ou ,)"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ";") {
                    e.preventDefault();
                    addRecipient();
                  }
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (pasted.includes(";") || pasted.includes(",") || pasted.includes(" ")) {
                    e.preventDefault();
                    setEmailInput(pasted);
                    setTimeout(() => {
                      const emails = pasted
                        .split(/[;,\s]+/)
                        .map((em) => em.trim().toLowerCase())
                        .filter((em) => em && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em));
                      const newEmails = emails.filter((em) => !recipients.includes(em));
                      if (newEmails.length > 0) {
                        setRecipients((prev) => [...prev, ...newEmails]);
                        setEmailInput("");
                        setError(null);
                      }
                    }, 0);
                  }
                }}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={addRecipient}>
                Ajouter
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Entrez une ou plusieurs adresses séparées par ; ou , puis appuyez sur Entrée
            </p>
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {recipients.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1 pr-1">
                    <Mail className="h-3 w-3" />
                    {email}
                    <button
                      type="button"
                      onClick={() => removeRecipient(email)}
                      className="ml-0.5 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 rounded px-2.5 py-2">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Créer la planification
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
