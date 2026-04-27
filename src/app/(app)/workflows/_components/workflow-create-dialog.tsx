"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createWorkflow } from "@/actions/workflow";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { WorkflowStep, WorkflowTrigger } from "@/validations/workflow";

type TriggerType = WorkflowTrigger["type"];
type StepType = WorkflowStep["type"];

const TRIGGER_OPTIONS = [
  { value: "manual", label: "Manuel" },
  { value: "schedule", label: "Planifié" },
  { value: "event", label: "Événement" },
] satisfies Array<{ value: TriggerType; label: string }>;

const STEP_OPTIONS = [
  { value: "send_notification", label: "Notification in-app" },
  { value: "send_email", label: "Email" },
  { value: "webhook", label: "Webhook HTTPS" },
] satisfies Array<{ value: StepType; label: string }>;

const HTTP_METHOD_OPTIONS = [
  { value: "POST", label: "POST" },
  { value: "GET", label: "GET" },
];

function nextStepId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `step-${Date.now()}`;
}

export function WorkflowCreateDialog({ societyId }: { societyId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [triggerType, setTriggerType] = useState<TriggerType>("manual");
  const [eventName, setEventName] = useState("invoice.overdue");
  const [cron, setCron] = useState("0 8 * * 1");
  const [stepType, setStepType] = useState<StepType>("send_notification");
  const [notificationTitle, setNotificationTitle] = useState("Workflow {{event}}");
  const [notificationMessage, setNotificationMessage] = useState("Action à vérifier pour {{entityType}} {{entityId}}.");
  const [link, setLink] = useState("/dashboard");
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("Notification MyGestia");
  const [emailBody, setEmailBody] = useState("Bonjour,\n\nUne action workflow vient d'être déclenchée.");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookMethod, setWebhookMethod] = useState("POST");

  function resetForm() {
    setName("");
    setDescription("");
    setIsActive(false);
    setTriggerType("manual");
    setEventName("invoice.overdue");
    setCron("0 8 * * 1");
    setStepType("send_notification");
    setNotificationTitle("Workflow {{event}}");
    setNotificationMessage("Action à vérifier pour {{entityType}} {{entityId}}.");
    setLink("/dashboard");
    setEmailTo("");
    setEmailSubject("Notification MyGestia");
    setEmailBody("Bonjour,\n\nUne action workflow vient d'être déclenchée.");
    setWebhookUrl("");
    setWebhookMethod("POST");
  }

  function buildTrigger(): WorkflowTrigger {
    if (triggerType === "event") {
      return { type: "event", config: { event: eventName.trim() } };
    }
    if (triggerType === "schedule") {
      return { type: "schedule", config: { cron: cron.trim() } };
    }
    return { type: "manual", config: {} };
  }

  function buildStep(): WorkflowStep {
    const id = nextStepId();
    if (stepType === "send_email") {
      return {
        id,
        type: "send_email",
        config: {
          to: emailTo.trim(),
          subject: emailSubject.trim(),
          body: emailBody.trim(),
        },
      };
    }
    if (stepType === "webhook") {
      return {
        id,
        type: "webhook",
        config: {
          url: webhookUrl.trim(),
          method: webhookMethod,
        },
      };
    }
    const notificationConfig: Record<string, unknown> = {
      title: notificationTitle.trim(),
      message: notificationMessage.trim(),
    };
    const resolvedLink = link.trim();
    if (resolvedLink) notificationConfig.link = resolvedLink;
    return {
      id,
      type: "send_notification",
      config: notificationConfig,
    };
  }

  function validateForm() {
    if (!name.trim()) return "Le nom du workflow est requis.";
    if (triggerType === "event" && !eventName.trim()) return "Renseignez le nom de l'événement.";
    if (triggerType === "schedule" && !cron.trim()) return "Renseignez une expression cron.";
    if (stepType === "send_email" && (!emailTo.trim() || !emailTo.includes("@"))) {
      return "Renseignez un email destinataire valide.";
    }
    if (stepType === "webhook" && !webhookUrl.trim().startsWith("https://")) {
      return "L'URL du webhook doit commencer par https://.";
    }
    return null;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }

    startTransition(async () => {
      const result = await createWorkflow(societyId, {
        name: name.trim(),
        description: description.trim() || undefined,
        isActive,
        trigger: buildTrigger(),
        steps: [buildStep()],
      });

      if (result.success) {
        toast.success("Workflow créé");
        setOpen(false);
        resetForm();
      } else {
        toast.error(result.error ?? "Erreur lors de la création");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Nouveau workflow
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Nouveau workflow</DialogTitle>
            <DialogDescription>
              Créez un premier scénario exploitable : déclencheur, première étape, activation.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="workflow-name">Nom *</Label>
              <Input
                id="workflow-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Relance interne facture en retard"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="workflow-description">Description</Label>
              <Textarea
                id="workflow-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="But du workflow, périmètre, équipe concernée..."
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="workflow-trigger">Déclencheur</Label>
              <NativeSelect
                id="workflow-trigger"
                value={triggerType}
                onChange={(event) => setTriggerType(event.target.value as TriggerType)}
                options={TRIGGER_OPTIONS}
              />
            </div>

            <div className="flex items-end gap-3 rounded-lg border border-border/70 px-3 py-2">
              <Switch id="workflow-active" checked={isActive} onCheckedChange={setIsActive} />
              <div>
                <Label htmlFor="workflow-active">Activer après création</Label>
                <p className="text-xs text-muted-foreground">Vous pourrez changer cet état depuis la liste.</p>
              </div>
            </div>

            {triggerType === "event" && (
              <div className="md:col-span-2">
                <Label htmlFor="workflow-event">Événement</Label>
                <Input
                  id="workflow-event"
                  value={eventName}
                  onChange={(event) => setEventName(event.target.value)}
                  placeholder="invoice.overdue"
                />
              </div>
            )}

            {triggerType === "schedule" && (
              <div className="md:col-span-2">
                <Label htmlFor="workflow-cron">Expression cron</Label>
                <Input
                  id="workflow-cron"
                  value={cron}
                  onChange={(event) => setCron(event.target.value)}
                  placeholder="0 8 * * 1"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Exemple : 0 8 * * 1 pour chaque lundi à 08:00.
                </p>
              </div>
            )}

            <div className="md:col-span-2">
              <Label htmlFor="workflow-step">Première étape</Label>
              <NativeSelect
                id="workflow-step"
                value={stepType}
                onChange={(event) => setStepType(event.target.value as StepType)}
                options={STEP_OPTIONS}
              />
            </div>

            {stepType === "send_notification" && (
              <>
                <div>
                  <Label htmlFor="workflow-notification-title">Titre</Label>
                  <Input
                    id="workflow-notification-title"
                    value={notificationTitle}
                    onChange={(event) => setNotificationTitle(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="workflow-link">Lien</Label>
                  <Input
                    id="workflow-link"
                    value={link}
                    onChange={(event) => setLink(event.target.value)}
                    placeholder="/facturation"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="workflow-notification-message">Message</Label>
                  <Textarea
                    id="workflow-notification-message"
                    value={notificationMessage}
                    onChange={(event) => setNotificationMessage(event.target.value)}
                    rows={3}
                  />
                </div>
              </>
            )}

            {stepType === "send_email" && (
              <>
                <div>
                  <Label htmlFor="workflow-email-to">Destinataire *</Label>
                  <Input
                    id="workflow-email-to"
                    type="email"
                    value={emailTo}
                    onChange={(event) => setEmailTo(event.target.value)}
                    placeholder="gestion@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="workflow-email-subject">Objet</Label>
                  <Input
                    id="workflow-email-subject"
                    value={emailSubject}
                    onChange={(event) => setEmailSubject(event.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="workflow-email-body">Corps</Label>
                  <Textarea
                    id="workflow-email-body"
                    value={emailBody}
                    onChange={(event) => setEmailBody(event.target.value)}
                    rows={4}
                  />
                </div>
              </>
            )}

            {stepType === "webhook" && (
              <>
                <div>
                  <Label htmlFor="workflow-webhook-method">Méthode</Label>
                  <NativeSelect
                    id="workflow-webhook-method"
                    value={webhookMethod}
                    onChange={(event) => setWebhookMethod(event.target.value)}
                    options={HTTP_METHOD_OPTIONS}
                  />
                </div>
                <div>
                  <Label htmlFor="workflow-webhook-url">URL HTTPS *</Label>
                  <Input
                    id="workflow-webhook-url"
                    value={webhookUrl}
                    onChange={(event) => setWebhookUrl(event.target.value)}
                    placeholder="https://example.com/webhook"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer le workflow"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
