"use client";

import { useEffect, useState, useTransition } from "react";
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
  AtSign,
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
  configureUnifiedSender,
  getUnifiedSenderOverview,
  refreshUnifiedSenderStatus,
  removeUnifiedSender,
  verifyUnifiedSender,
  type UnifiedSenderOverview,
} from "@/actions/user-sender";

const STATUS_META: Record<
  UnifiedSenderOverview["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; description: string }
> = {
  not_configured: {
    label: "Non configuré",
    variant: "outline",
    description:
      "Vous n'avez pas d'adresse expéditrice unifiée. Vos sociétés utilisent noreply@mygestia.immo, sauf celles avec leur propre sender vérifié.",
  },
  not_started: {
    label: "En attente DNS",
    variant: "secondary",
    description: "Ajoutez les enregistrements DNS chez votre registrar puis lancez la vérification.",
  },
  pending: {
    label: "Vérification en cours",
    variant: "secondary",
    description: "Resend propage la vérification (jusqu'à 72 h selon votre DNS).",
  },
  verified: {
    label: "Actif",
    variant: "default",
    description:
      "Toutes vos sociétés dont vous êtes ADMIN_SOCIETE envoient depuis cette adresse, sauf si elles ont configuré leur propre sender vérifié.",
  },
  failed: {
    label: "Échec",
    variant: "destructive",
    description: "Les enregistrements DNS ne sont pas valides. Recopiez-les exactement.",
  },
  temporary_failure: {
    label: "Erreur temporaire",
    variant: "destructive",
    description: "Réessayez dans quelques minutes.",
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

export function UnifiedSenderCard() {
  const [overview, setOverview] = useState<UnifiedSenderOverview | null>(null);
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getUnifiedSenderOverview().then((res) => {
      if (res.success && res.data) {
        setOverview(res.data);
        setSenderEmail(res.data.senderEmail ?? "");
        setSenderName(res.data.senderName ?? "");
      } else {
        setLoadError(res.error ?? "Erreur inconnue");
      }
      setLoaded(true);
    });
  }, []);

  if (!loaded) return null;

  // État d'erreur : affiche un diagnostic au lieu de se cacher silencieusement
  if (loadError || !overview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AtSign className="h-4 w-4" />
            Adresse expéditrice unifiée
          </CardTitle>
          <CardDescription className="mt-1">
            Impossible de charger la configuration : {loadError ?? "réponse vide"}.
            {" "}
            Si le déploiement est récent, patientez quelques minutes puis rechargez la page.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!overview.resendConfigured) return null;

  const meta = STATUS_META[overview.status];
  const isVerified = overview.status === "verified";
  const isConfigured = overview.status !== "not_configured";

  function apply(
    result: { success: boolean; data?: UnifiedSenderOverview; error?: string },
    successMsg: string
  ) {
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
      const res = await configureUnifiedSender({
        senderEmail: senderEmail.trim(),
        senderName: senderName.trim() || undefined,
      });
      apply(res, "Domaine enregistré — ajoutez les DNS puis vérifiez.");
    });
  }

  function handleVerify() {
    startTransition(async () => {
      const res = await verifyUnifiedSender();
      apply(res, res.data?.status === "verified" ? "Domaine vérifié !" : "Vérification lancée.");
    });
  }

  function handleRefresh() {
    startTransition(async () => {
      const res = await refreshUnifiedSenderStatus();
      apply(res, "Statut actualisé.");
    });
  }

  function handleRemove() {
    if (
      !confirm(
        "Supprimer l'expéditeur unifié ? Vos sociétés sans sender propre repasseront sur noreply@mygestia.immo."
      )
    )
      return;
    startTransition(async () => {
      const res = await removeUnifiedSender();
      apply(res, "Expéditeur unifié retiré.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AtSign className="h-4 w-4" />
              Adresse expéditrice unifiée
            </CardTitle>
            <CardDescription className="mt-1">
              Une seule adresse pour toutes les sociétés dont vous êtes administrateur. Chaque société
              conserve la possibilité de configurer sa propre adresse, qui prend le pas si elle est vérifiée.
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

        {/* Stepper visuel — 3 étapes du flow d'activation */}
        {!isVerified && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="mb-3 text-xs font-medium text-foreground">
              Activation en 3 étapes
            </p>
            <ol className="space-y-2 text-xs">
              <li className="flex items-start gap-2">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    isConfigured
                      ? "bg-emerald-500 text-white"
                      : "bg-[var(--color-brand-blue)] text-white ring-2 ring-[var(--color-brand-blue)]/30"
                  }`}
                >
                  {isConfigured ? <Check className="h-3 w-3" /> : "1"}
                </span>
                <div>
                  <p className={isConfigured ? "text-muted-foreground line-through" : "font-medium text-foreground"}>
                    Renseignez votre adresse ci-dessous puis <strong>Enregistrer</strong>
                  </p>
                  <p className="text-muted-foreground">
                    MyGestia génère les enregistrements DNS pour votre domaine
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    !isConfigured
                      ? "bg-muted text-muted-foreground"
                      : overview.status === "verified"
                        ? "bg-emerald-500 text-white"
                        : "bg-[var(--color-brand-blue)] text-white ring-2 ring-[var(--color-brand-blue)]/30"
                  }`}
                >
                  {overview.status === "verified" ? <Check className="h-3 w-3" /> : "2"}
                </span>
                <div>
                  <p className={!isConfigured ? "text-muted-foreground" : "font-medium text-foreground"}>
                    Ajoutez les enregistrements DNS chez votre registrar
                  </p>
                  <p className="text-muted-foreground">
                    OVH, Gandi, Cloudflare… copiez les lignes SPF / DKIM affichées après l&apos;enregistrement
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    isConfigured && overview.status !== "verified"
                      ? "bg-[var(--color-brand-blue)] text-white ring-2 ring-[var(--color-brand-blue)]/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  3
                </span>
                <div>
                  <p className={isConfigured && overview.status !== "verified" ? "font-medium text-foreground" : "text-muted-foreground"}>
                    Cliquez <strong>Vérifier maintenant</strong>
                  </p>
                  <p className="text-muted-foreground">
                    Une fois les DNS propagés (quelques minutes à quelques heures)
                  </p>
                </div>
              </li>
            </ol>
          </div>
        )}

        {/* Sociétés couvertes */}
        {overview.coveredSocieties.length > 0 && (
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">
              Sociétés couvertes ({overview.coveredSocieties.length})
            </p>
            <ul className="space-y-1">
              {overview.coveredSocieties.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-foreground">{s.name}</span>
                  {s.hasOwnSender ? (
                    <span className="text-muted-foreground italic">Sender société propre — non couvert</span>
                  ) : (
                    <span className="text-[var(--color-status-positive)]">
                      {isVerified ? "Utilise votre adresse unifiée" : "Sera couvert dès activation"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {overview.coveredSocieties.length === 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
            Vous n&apos;êtes administrateur d&apos;aucune société. Cette configuration n&apos;aura aucun effet
            tant que vous n&apos;êtes pas nommé ADMIN_SOCIETE sur au moins une société.
          </div>
        )}

        {/* Formulaire de saisie */}
        {!isVerified && (
          <p className="text-xs font-medium text-foreground -mb-2">
            {isConfigured ? "Modifier l'adresse" : "Étape 1 — Renseignez votre adresse"}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-[2fr,1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="unified-sender-email">
              Adresse expéditrice <span className="text-destructive">*</span>
            </Label>
            <Input
              id="unified-sender-email"
              type="email"
              placeholder="contact@mygroupe.fr"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              disabled={isPending}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unified-sender-name">Libellé (optionnel)</Label>
            <Input
              id="unified-sender-name"
              placeholder="MTG Groupe"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              disabled={isPending}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleConfigure} disabled={isPending || !senderEmail.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AtSign className="h-4 w-4" />}
            {isConfigured ? "Mettre à jour l'adresse" : "Enregistrer et générer les DNS"}
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
            <Button
              variant="ghost"
              onClick={handleRemove}
              disabled={isPending}
              size="sm"
              className="ml-auto text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Retirer
            </Button>
          )}
        </div>

        {/* DNS records */}
        {overview.records.length > 0 && !isVerified && (
          <div className="space-y-2">
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 dark:bg-amber-950/20 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-300">
                  <p className="font-medium">Ajoutez ces enregistrements DNS chez votre registrar</p>
                  <p className="mt-1">
                    Une fois propagés, cliquez sur <strong>Vérifier maintenant</strong>.
                  </p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">Nom</th>
                    <th className="px-3 py-2 text-left font-medium">Valeur</th>
                    <th className="px-3 py-2 text-left font-medium">TTL</th>
                    <th className="px-3 py-2 text-left font-medium">Prio</th>
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

        {isVerified && overview.senderEmail && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 dark:bg-emerald-950/20 dark:border-emerald-800">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-800 dark:text-emerald-300">
                <p className="font-medium">Adresse unifiée active</p>
                <p className="mt-1">
                  Envois centralisés depuis <strong>{overview.senderEmail}</strong>
                  {overview.verifiedAt && (
                    <> — vérifiée le {new Date(overview.verifiedAt).toLocaleDateString("fr-FR")}</>
                  )}
                  .
                </p>
              </div>
            </div>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground leading-relaxed border-t pt-3">
          <strong>Règle de priorité :</strong> pour chaque société, la configuration de son propre expéditeur
          (dans <em>Paramètres → Facturation</em>) prend le pas sur cette adresse unifiée. Si aucune n&apos;est
          configurée, on retombe sur <code>noreply@mygestia.immo</code>.
        </p>
      </CardContent>
    </Card>
  );
}
