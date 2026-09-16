"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Plus, Trash2, UserCog } from "lucide-react";
import {
  addTenantMandataire,
  listTenantMandataires,
  removeTenantMandataire,
  updateTenantMandataire,
  type MandataireInput,
} from "@/actions/tenant-mandataire";

type Mandataire = {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  canAccessPortal: boolean;
  receivesInvoices: boolean;
  receivesQuittances: boolean;
  receivesReminders: boolean;
  receivesDocuments: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

interface Props {
  societyId: string;
  tenantId: string;
}

const emptyDraft: MandataireInput = {
  email: "",
  name: "",
  role: "",
  canAccessPortal: true,
  receivesInvoices: true,
  receivesQuittances: true,
  receivesReminders: true,
  receivesDocuments: true,
};

export function MandatairesSection({ societyId, tenantId }: Props) {
  const [items, setItems] = useState<Mandataire[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<MandataireInput>(emptyDraft);
  const [isAdding, startAdding] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function refresh() {
    setIsLoading(true);
    const res = await listTenantMandataires(societyId, tenantId);
    if (res.success && res.data) setItems(res.data);
    else setError(res.error ?? "Erreur de chargement");
    setIsLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [societyId, tenantId]);

  function handleAdd() {
    setError(null);
    if (!draft.email) {
      setError("Email requis");
      return;
    }
    startAdding(async () => {
      const res = await addTenantMandataire(societyId, tenantId, draft);
      if (!res.success) {
        setError(res.error ?? "Erreur");
        return;
      }
      setDraft(emptyDraft);
      await refresh();
    });
  }

  async function handleToggle(m: Mandataire, field: keyof MandataireInput, value: boolean) {
    setPendingId(m.id);
    const res = await updateTenantMandataire(societyId, m.id, { [field]: value });
    if (!res.success) setError(res.error ?? "Erreur");
    else await refresh();
    setPendingId(null);
  }

  async function handleRemove(id: string) {
    if (!confirm("Supprimer ce mandataire ? Il perdra l'accès au portail et ne recevra plus les emails.")) return;
    setPendingId(id);
    const res = await removeTenantMandataire(societyId, id);
    if (!res.success) setError(res.error ?? "Erreur");
    else await refresh();
    setPendingId(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-5 w-5" />
          Mandataires et destinataires additionnels
        </CardTitle>
        <CardDescription>
          Comptables, gérants, assistants pouvant se connecter au portail au nom du locataire
          et/ou recevoir sélectivement les documents (factures, quittances, relances).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Aucun mandataire enregistré.</p>
        ) : (
          <div className="space-y-3">
            {items.map((m) => (
              <div key={m.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">
                      {m.name || m.email}
                      {m.role && <span className="text-muted-foreground font-normal"> — {m.role}</span>}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{m.email}</div>
                    {m.lastLoginAt && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Dernière connexion : {new Date(m.lastLoginAt).toLocaleString("fr-FR")}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleRemove(m.id)}
                    disabled={pendingId === m.id}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 pt-2 border-t">
                  <ToggleRow
                    label="Accès portail"
                    hint="Peut se connecter avec cet email"
                    checked={m.canAccessPortal}
                    disabled={pendingId === m.id}
                    onChange={(v) => void handleToggle(m, "canAccessPortal", v)}
                  />
                  <ToggleRow
                    label="Reçoit les factures"
                    checked={m.receivesInvoices}
                    disabled={pendingId === m.id}
                    onChange={(v) => void handleToggle(m, "receivesInvoices", v)}
                  />
                  <ToggleRow
                    label="Reçoit les quittances"
                    checked={m.receivesQuittances}
                    disabled={pendingId === m.id}
                    onChange={(v) => void handleToggle(m, "receivesQuittances", v)}
                  />
                  <ToggleRow
                    label="Reçoit les relances"
                    checked={m.receivesReminders}
                    disabled={pendingId === m.id}
                    onChange={(v) => void handleToggle(m, "receivesReminders", v)}
                  />
                  <ToggleRow
                    label="Reçoit les documents"
                    checked={m.receivesDocuments}
                    disabled={pendingId === m.id}
                    onChange={(v) => void handleToggle(m, "receivesDocuments", v)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-4 border-t space-y-3">
          <p className="text-sm font-medium">Ajouter un mandataire</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="mand-email">Email *</Label>
              <Input
                id="mand-email"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                placeholder="comptable@societe.fr"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mand-name">Nom</Label>
              <Input
                id="mand-name"
                value={draft.name ?? ""}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Muriel Dubant"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mand-role">Fonction</Label>
              <Input
                id="mand-role"
                value={draft.role ?? ""}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                placeholder="Comptable"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={handleAdd} disabled={isAdding}>
              {isAdding ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Ajout…</>
              ) : (
                <><Plus className="h-4 w-4" /> Ajouter</>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Après ajout, ajustez les préférences d&apos;envoi (factures, quittances, relances) dans la ligne créée.
            Par défaut, un nouveau mandataire reçoit tout et peut se connecter au portail.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-muted-foreground truncate">{hint}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
