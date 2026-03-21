"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, Users, Mail, Phone, X, Check, Loader2 } from "lucide-react";
import {
  createTenantContact,
  updateTenantContact,
  deleteTenantContact,
} from "@/actions/tenant";
import { useSociety } from "@/providers/society-provider";

type Contact = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
};

type FormState = {
  name: string;
  role: string;
  email: string;
  phone: string;
};

const emptyForm: FormState = { name: "", role: "", email: "", phone: "" };

function ContactForm({
  initial,
  onSave,
  onCancel,
  isPending,
  error,
}: {
  initial: FormState;
  onSave: (form: FormState) => void;
  onCancel: () => void;
  isPending: boolean;
  error: string;
}) {
  const [form, setForm] = useState<FormState>(initial);

  return (
    <div className="rounded-md border bg-muted/30 p-4 space-y-3">
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cf-name" className="text-xs">Nom *</Label>
          <Input
            id="cf-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Prénom Nom"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-role" className="text-xs">Fonction / Qualité</Label>
          <Input
            id="cf-role"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            placeholder="Directeur, Comptable…"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-email" className="text-xs">Email</Label>
          <Input
            id="cf-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="contact@exemple.fr"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-phone" className="text-xs">Téléphone</Label>
          <Input
            id="cf-phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="06 00 00 00 00"
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          <X className="h-3.5 w-3.5" />
          Annuler
        </Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={isPending || !form.name.trim()}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

export function TenantContactsSection({
  tenantId,
  contacts,
}: {
  tenantId: string;
  contacts: Contact[];
}) {
  const { activeSociety } = useSociety();
  const activeSocietyId = activeSociety?.id;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  // null = fermé, "new" = nouveau, id = édition
  const [openForm, setOpenForm] = useState<string | null>(null);

  function handleCreate(form: FormState) {
    if (!activeSocietyId) return;
    setError("");

    const input = {
      name: form.name.trim(),
      role: form.role.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    };

    startTransition(async () => {
      const result = await createTenantContact(activeSocietyId, tenantId, input);
      if (result.success) {
        setOpenForm(null);
      } else {
        setError(result.error ?? "Erreur");
      }
    });
  }

  function handleUpdate(contactId: string, form: FormState) {
    if (!activeSocietyId) return;
    setError("");

    const input = {
      name: form.name.trim(),
      role: form.role.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    };

    startTransition(async () => {
      const result = await updateTenantContact(activeSocietyId, contactId, input);
      if (result.success) {
        setOpenForm(null);
      } else {
        setError(result.error ?? "Erreur");
      }
    });
  }

  function handleDelete(contactId: string) {
    if (!activeSocietyId) return;
    if (!confirm("Supprimer ce contact ?")) return;
    setError("");

    startTransition(async () => {
      const result = await deleteTenantContact(activeSocietyId, contactId);
      if (!result.success) {
        setError(result.error ?? "Erreur");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Contacts secondaires ({contacts.length})
        </CardTitle>
        {openForm !== "new" && (
          <Button size="sm" variant="outline" onClick={() => setOpenForm("new")}>
            <Plus className="h-4 w-4" />
            Ajouter
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        {contacts.length === 0 && openForm !== "new" && (
          <p className="text-sm text-muted-foreground text-center py-3">
            Aucun contact secondaire enregistré
          </p>
        )}

        {contacts.length > 0 && (
          <div className="divide-y">
            {contacts.map((c, idx) => (
              <div key={c.id}>
                {openForm === c.id ? (
                  <div className="py-3">
                    <ContactForm
                      initial={{ name: c.name, role: c.role ?? "", email: c.email ?? "", phone: c.phone ?? "" }}
                      onSave={(form) => handleUpdate(c.id, form)}
                      onCancel={() => setOpenForm(null)}
                      isPending={isPending}
                      error={error}
                    />
                  </div>
                ) : (
                  <div className="flex items-start justify-between py-3">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-medium">{c.name}</p>
                      {c.role && (
                        <p className="text-xs text-muted-foreground">{c.role}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 mt-1">
                        {c.email && (
                          <a
                            href={`mailto:${c.email}`}
                            className="flex items-center gap-1 text-xs text-primary hover:underline truncate"
                          >
                            <Mail className="h-3 w-3 shrink-0" />
                            {c.email}
                          </a>
                        )}
                        {c.phone && (
                          <a
                            href={`tel:${c.phone}`}
                            className="flex items-center gap-1 text-xs text-muted-foreground"
                          >
                            <Phone className="h-3 w-3 shrink-0" />
                            {c.phone}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-4 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => { setOpenForm(c.id); setError(""); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(c.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
                {idx < contacts.length - 1 && openForm !== c.id && <div />}
              </div>
            ))}
          </div>
        )}

        {openForm === "new" && (
          <>
            {contacts.length > 0 && <Separator />}
            <ContactForm
              initial={emptyForm}
              onSave={handleCreate}
              onCancel={() => { setOpenForm(null); setError(""); }}
              isPending={isPending}
              error={error}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
