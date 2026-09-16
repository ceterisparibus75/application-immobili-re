"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useSociety } from "@/providers/society-provider";
import { Loader2, LinkIcon } from "lucide-react";
import { listTenantMandataires } from "@/actions/tenant-mandataire";
import { sendPortalMagicLink } from "@/actions/portal-magic-link";

interface Option {
  value: string;
  label: string;
}

interface Props {
  tenantId: string;
  tenantEmail: string;
  tenantName: string;
}

export function SendMagicLinkButton({ tenantId, tenantEmail, tenantName }: Props) {
  const { activeSociety } = useSociety();
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [target, setTarget] = useState<string>("primary");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, startSending] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !activeSociety) return;
    setIsLoading(true);
    void (async () => {
      const base: Option[] = [
        { value: "primary", label: `Locataire : ${tenantName} (${tenantEmail})` },
      ];
      const res = await listTenantMandataires(activeSociety.id, tenantId);
      if (res.success && res.data) {
        const mandataires = res.data
          .filter((m) => m.canAccessPortal)
          .map((m) => ({
            value: `mandataire:${m.id}`,
            label: `Mandataire : ${m.name || m.email}${m.role ? ` (${m.role})` : ""} — ${m.email}`,
          }));
        setOptions([...base, ...mandataires]);
      } else {
        setOptions(base);
      }
      setIsLoading(false);
    })();
  }, [isOpen, activeSociety, tenantId, tenantEmail, tenantName]);

  function handleSend() {
    if (!activeSociety) return;
    setMessage(null);
    startSending(async () => {
      const res = await sendPortalMagicLink(activeSociety.id, {
        tenantId,
        target,
      });
      if (res.success) {
        setMessage({ type: "success", text: `Lien envoyé à ${res.data?.email}` });
      } else {
        setMessage({ type: "error", text: res.error ?? "Erreur" });
      }
    });
  }

  if (!isOpen) {
    return (
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        <LinkIcon className="h-4 w-4" />
        Envoyer un lien de connexion
      </Button>
    );
  }

  return (
    <div className="rounded-lg border p-3 space-y-3 max-w-md">
      <div className="text-sm font-medium">Envoyer un lien de connexion direct</div>
      <p className="text-xs text-muted-foreground">
        Le destinataire recevra un email avec un lien qui l&apos;identifie automatiquement au portail
        (valable 7 jours, usage unique).
      </p>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement des destinataires…
        </div>
      ) : (
        <NativeSelect
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          options={options}
        />
      )}
      {message && (
        <p
          className={`text-xs ${
            message.type === "success"
              ? "text-[var(--color-status-positive)]"
              : "text-destructive"
          }`}
        >
          {message.text}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsOpen(false);
            setMessage(null);
          }}
        >
          Fermer
        </Button>
        <Button type="button" size="sm" onClick={handleSend} disabled={isSending || isLoading}>
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
          Envoyer
        </Button>
      </div>
    </div>
  );
}
