"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Mail,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import {
  configureSenderDomain,
  verifySenderDomain,
  refreshSenderStatus,
  removeSenderDomain,
  type SenderOverview,
} from "@/actions/society-sender";

interface Props {
  societyId: string;
  initial: SenderOverview;
}

const STATUS_META: Record<
  SenderOverview["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; description: string }
> = {
  not_configured: {
    label: "Non configuré",
    variant: "outline",
    description: "Les emails partent depuis noreply@mygestia.immo.",
  },
  not_started: {
    label: "En attente DNS",
    variant: "secondary",
    description: "Ajoutez les enregistrements DNS ci-dessous chez votre registrar.",
  },
  pending: {
    label: "Vérification en cours",
    variant: "secondary",
    description: "Resend propage la vérification. Cela peut prendre jusqu'à 72 h.",
  },
  verified: {
    label: "Vérifié",
    variant: "default",
    description: "Vos emails partent depuis votre propre adresse.",
  },
  failed: {
    label: "Échec",
    variant: "destructive",
    description:
      "Les enregistrements DNS ne sont pas valides. Vérifiez la copie exacte des valeurs chez votre registrar.",
  },
  temporary_failure: {
    label: "Erreur temporaire",
    variant: "destructive",
    description: "Resend n'a pas pu joindre votre DNS. Réessayez dans quelques minutes.",
  },
};

function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Impossible de copier");
        }
      }}
      className="group inline-flex max-w-full items-center gap-1.5 rounded border border-transparent px-1 py-0.5 text-left hover:border-border hover:bg-muted/50"
      title="Copier"
    >
      <code className="truncate font-mono text-[11px] text-foreground">{value}</code>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-[var(--color-status-positive)]" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" />
      )}
    </button>
  );
}

export function SenderDomainCard({ societyId, initial }: Props) {
  const [overview, setOverview] = useState<SenderOverview>(initial);
  const [senderEmail, setSenderEmail] = useState(initial.senderEmail ?? "");
  const [senderName, setSenderName] = useState(initial.senderName ?? "");
  const [isPending, startTransition] = useTransition();

  const meta = STATUS_META[overview.status];
  const isVerified = overview.status === "verified";
  const isConfigured = overview.status !== "not_configured";

  function apply(result: { success: boolean; data?: SenderOverview; error?: string }, successMsg: string) {
    if (result.success && result.data) {
      setOverview(result.data);
      setSenderEmail(result.data.senderEmail ?? "");
      setSenderName(result.data.senderName ?? "");
      toast.success(successMsg);
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  function handleConfigure() {
    if (!senderEmail.trim()) {
      toast.error("Renseignez une adresse expéditrice");
      return;
    }
    startTransition(async () => {
      const res = await configureSenderDomain(societyId, {
        senderEmail: senderEmail.trim(),
        senderName: senderName.trim() || undefined,
      });
      apply(res, "Domaine enregistré — ajoutez les DNS puis vérifiez.");
    });
  }

  function handleVerify() {
    startTransition(async () => {
      const res = await verifySenderDomain(societyId);
      apply(res, res.data?.status === "verified" ? "Domaine vérifié !" : "Vérification lancée.");
    });
  }

  function handleRefresh() {
    startTransition(async () => {
      const res = await refreshSenderStatus(societyId);
      apply(res, "Statut actualisé.");
    });
  }

  function handleRemove() {
    if (!confirm("Supprimer la configuration expéditrice ? Les emails repasseront par noreply@mygestia.immo.")) return;
    startTransition(async () => {
      const res = await removeSenderDomain(societyId);
      apply(res, "Expéditeur retiré.");
    });
  }

  if (!overview.resendConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Adresse expéditrice personnalisée
          </CardTitle>
          <CardDescription>
            Le fournisseur d&apos;emails (Resend) n&apos;est pas configuré côté serveur. Contactez le support.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              Adresse expéditrice personnalisée
            </CardTitle>
            <CardDescription className="mt-1">
              Envoyez vos factures, quittances et courriers depuis votre propre adresse au lieu de{" "}
              <code className="text-xs">noreply@mygestia.immo</code>.
            </CardDescription>
          </div>
          <Badge variant={meta.variant} className="shrink-0 gap-1">
            {isVerified ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : overview.status === "failed" || overview.status === "temporary_failure" ? (
              <AlertTriangle className="h-3 w-3" />
            ) : null}
            {meta.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-xs text-muted-foreground">{meta.description}</p>

        {/* Formulaire de saisie */}
        <div className="grid gap-3 sm:grid-cols-[2fr,1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="sender-email">Adresse expéditrice</Label>
            <Input
              id="sender-email"
              type="email"
              placeholder="contact@masociete.fr"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sender-name">Libellé (optionnel)</Label>
            <Input
              id="sender-name"
              placeholder="SCI Foncière"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              disabled={isPending}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleConfigure} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {isConfigured ? "Mettre à jour" : "Enregistrer"}
          </Button>
          {isConfigured && !isVerified && (
            <Button variant="outline" onClick={handleVerify} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Vérifier maintenant
            </Button>
          )}
          {isConfigured && (
            <Button variant="ghost" onClick={handleRefresh} disabled={isPending} size="sm">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Actualiser
            </Button>
          )}
          {isConfigured && (
            <Button variant="ghost" onClick={handleRemove} disabled={isPending} size="sm" className="ml-auto text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
              Retirer
            </Button>
          )}
        </div>

        {/* DNS records à ajouter */}
        {overview.records.length > 0 && !isVerified && (
          <div className="space-y-2">
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 dark:bg-amber-950/20 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-300">
                  <p className="font-medium">Ajoutez les enregistrements DNS suivants chez votre registrar</p>
                  <p className="mt-1">
                    Une fois propagés (généralement quelques minutes à quelques heures), cliquez sur{" "}
                    <strong>Vérifier maintenant</strong>.
                  </p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">Nom (host)</th>
                    <th className="px-3 py-2 text-left font-medium">Valeur</th>
                    <th className="px-3 py-2 text-left font-medium">TTL</th>
                    <th className="px-3 py-2 text-left font-medium">Prio.</th>
                    <th className="px-3 py-2 text-left font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {overview.records.map((rec, i) => (
                    <tr key={`${rec.record}-${rec.name}-${i}`}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {rec.type}
                        </Badge>
                        <span className="ml-1 text-muted-foreground text-[10px]">{rec.record}</span>
                      </td>
                      <td className="px-3 py-2">
                        <CopyableValue value={rec.name} />
                      </td>
                      <td className="px-3 py-2 max-w-[280px]">
                        <CopyableValue value={rec.value} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {rec.ttl ?? "Auto"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {rec.priority ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {rec.status === "verified" ? (
                          <Badge variant="default" className="text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            OK
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            {rec.status ?? "En attente"}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isVerified && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 dark:bg-emerald-950/20 dark:border-emerald-800">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-800 dark:text-emerald-300">
                <p className="font-medium">Domaine vérifié</p>
                <p className="mt-1">
                  Vos factures, quittances, relances et courriers partent désormais depuis{" "}
                  <strong>{overview.senderEmail}</strong>
                  {overview.verifiedAt && (
                    <> — vérifié le {new Date(overview.verifiedAt).toLocaleDateString("fr-FR")}</>
                  )}
                  .
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
