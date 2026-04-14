"use client";

import { useState, useTransition, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Copy,
  Check,
  Plus,
  X,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  upsertSupplierInboxConfig,
  regenerateInboxSecret,
} from "@/actions/supplier-inbox";
import { toast } from "sonner";

interface InboxConfig {
  id: string;
  inboxEmail: string;
  inboxSlug: string;
  isActive: boolean;
  notifyEmails: string[];
}

interface Props {
  societyId: string;
  initialConfig: InboxConfig | null;
}

export function InboxConfigForm({ societyId, initialConfig }: Props) {
  const [config, setConfig] = useState<InboxConfig | null>(initialConfig);
  const [saving, startSave] = useTransition();
  const [regenerating, startRegenerate] = useTransition();

  const [isActive, setIsActive] = useState(initialConfig?.isActive ?? true);
  const [notifyEmails, setNotifyEmails] = useState<string[]>(initialConfig?.notifyEmails ?? []);
  const [emailInput, setEmailInput] = useState("");

  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [rawSecret, setRawSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  function handleCopyEmail() {
    if (!config?.inboxEmail) return;
    navigator.clipboard.writeText(config.inboxEmail).then(() => {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    });
  }

  function handleCopySecret() {
    if (!rawSecret) return;
    navigator.clipboard.writeText(rawSecret).then(() => {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    });
  }

  function addEmail() {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Adresse email invalide");
      return;
    }
    if (notifyEmails.includes(email)) {
      toast.error("Cet email est déjà dans la liste");
      return;
    }
    if (notifyEmails.length >= 5) {
      toast.error("Maximum 5 adresses email");
      return;
    }
    setNotifyEmails((prev) => [...prev, email]);
    setEmailInput("");
  }

  function removeEmail(email: string) {
    setNotifyEmails((prev) => prev.filter((e) => e !== email));
  }

  function handleEmailKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addEmail();
    }
  }

  function handleSave() {
    startSave(async () => {
      const result = await upsertSupplierInboxConfig(societyId, {
        isActive,
        notifyEmails,
      });
      if (result.success && result.data) {
        toast.success("Configuration sauvegardée");
        if (!config) {
          setConfig({
            id: result.data.id,
            inboxEmail: result.data.inboxEmail,
            inboxSlug: result.data.inboxEmail.split("@")[0].replace("factures-", ""),
            isActive,
            notifyEmails,
          });
        } else {
          setConfig((prev) => prev ? { ...prev, isActive, notifyEmails } : null);
        }
      } else {
        toast.error(result.error ?? "Erreur lors de la sauvegarde");
      }
    });
  }

  function handleRegenerateSecret() {
    startRegenerate(async () => {
      const result = await regenerateInboxSecret(societyId);
      if (result.success && result.data) {
        setRawSecret(result.data.rawSecret);
        setRegenerateOpen(false);
        toast.success("Secret régénéré — copiez-le maintenant, il ne sera plus affiché");
      } else {
        toast.error(result.error ?? "Erreur lors de la régénération");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Email de réception */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email de réception des factures fournisseurs</CardTitle>
          <CardDescription>
            Transmettez vos factures à cette adresse pour les traiter automatiquement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config ? (
            <>
              {/* Adresse email dédiée */}
              <div>
                <Label className="text-xs text-muted-foreground">Adresse email dédiée</Label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-9 rounded-md border border-border/60 bg-muted/30 px-3 flex items-center text-sm font-mono text-[var(--color-brand-deep)]">
                    {config.inboxEmail}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 gap-1.5 shrink-0"
                    onClick={handleCopyEmail}
                  >
                    {copiedEmail ? (
                      <Check className="h-4 w-4 text-[var(--color-status-positive)]" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copiedEmail ? "Copié !" : "Copier"}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Toggle actif/inactif */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Réception active</p>
                  <p className="text-xs text-muted-foreground">
                    {isActive
                      ? "Les emails envoyés à cette adresse seront traités"
                      : "Les emails reçus seront ignorés"}
                  </p>
                </div>
                <button
                  onClick={() => setIsActive((v) => !v)}
                  className="focus:outline-none"
                  aria-label={isActive ? "Désactiver la réception" : "Activer la réception"}
                >
                  {isActive ? (
                    <ToggleRight className="h-8 w-8 text-[var(--color-status-positive)]" />
                  ) : (
                    <ToggleLeft className="h-8 w-8 text-muted-foreground" />
                  )}
                </button>
              </div>

              <Separator />

              {/* Emails de notification */}
              <div>
                <Label className="text-xs">Emails de notification</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Ces adresses seront notifiées à chaque nouvelle facture reçue (max. 5).
                </p>

                {/* Tags emails */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {notifyEmails.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1.5 bg-muted rounded-full px-3 py-1 text-xs font-medium"
                    >
                      {email}
                      <button
                        onClick={() => removeEmail(email)}
                        className="text-muted-foreground hover:text-destructive focus:outline-none"
                        aria-label={`Supprimer ${email}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Champ ajout email */}
                {notifyEmails.length < 5 && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={handleEmailKeyDown}
                      placeholder="email@exemple.com"
                      className="h-9 text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-3 shrink-0 gap-1"
                      onClick={addEmail}
                      disabled={!emailInput.trim()}
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter
                    </Button>
                  </div>
                )}
              </div>

              {/* Bouton sauvegarder */}
              <Button onClick={handleSave} disabled={saving} className="w-full gap-1.5">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Sauvegarder
              </Button>
            </>
          ) : (
            /* Pas encore configuré */
            <div className="flex flex-col items-center text-center py-6 space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50 mb-1">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground max-w-sm">
                Configurez une adresse email dédiée pour recevoir automatiquement vos factures
                fournisseurs. L&apos;IA extraira les données du PDF à votre place.
              </p>
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Configurer l&apos;email de réception
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section sécurité webhook — visible uniquement si config existe */}
      {config && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sécurité webhook</CardTitle>
            <CardDescription>
              Le secret webhook permet de vérifier que les emails entrants proviennent bien de notre service.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rawSecret && (
              <div className="rounded-lg bg-[var(--color-status-caution-bg)] border border-[var(--color-status-caution)]/30 p-3 space-y-2">
                <p className="text-sm font-medium text-[var(--color-status-caution)] flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Nouveau secret — à sauvegarder maintenant
                </p>
                <p className="text-xs text-muted-foreground">
                  Ce secret ne sera plus affiché après fermeture de cette page.
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-9 rounded-md border border-border/60 bg-background px-3 flex items-center font-mono text-sm overflow-hidden">
                    {showSecret ? rawSecret : "•".repeat(Math.min(rawSecret.length, 40))}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setShowSecret((v) => !v)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 gap-1 shrink-0"
                    onClick={handleCopySecret}
                  >
                    {copiedSecret ? (
                      <Check className="h-4 w-4 text-[var(--color-status-positive)]" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copiedSecret ? "Copié !" : "Copier"}
                  </Button>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setRegenerateOpen(true)}
              disabled={regenerating}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              Régénérer le secret
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modal confirmation régénération */}
      <Dialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[var(--color-status-caution)]" />
              Régénérer le secret webhook
            </DialogTitle>
            <DialogDescription>
              Cette action va invalider l&apos;ancien secret immédiatement. Tous les webhooks
              utilisant l&apos;ancien secret cesseront de fonctionner.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Le nouveau secret sera affiché une seule fois. Pensez à le copier et à mettre à
            jour votre configuration.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenerateOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleRegenerateSecret}
              disabled={regenerating}
              className="gap-1.5 bg-[var(--color-status-caution)] hover:bg-[var(--color-status-caution)]/90 text-white"
            >
              {regenerating && <Loader2 className="h-4 w-4 animate-spin" />}
              Oui, régénérer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
