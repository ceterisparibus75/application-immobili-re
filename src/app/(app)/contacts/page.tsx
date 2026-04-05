import { headers } from "next/headers";
import { getContacts } from "@/actions/contact";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Plus, Phone, Mail, Building2, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SyncTenantsButton } from "./_components/sync-tenants-button";

export const metadata = { title: "Contacts" };

const TYPE_LABELS: Record<string, string> = {
  LOCATAIRE: "Locataire",
  PRESTATAIRE: "Prestataire",
  NOTAIRE: "Notaire",
  EXPERT: "Expert",
  SYNDIC: "Syndic",
  AGENCE: "Agence",
  AUTRE: "Autre",
};

const TYPE_COLORS: Record<string, string> = {
  LOCATAIRE: "bg-[var(--color-brand-light)] text-[var(--color-brand-blue)]",
  PRESTATAIRE: "bg-amber-50 text-amber-600",
  NOTAIRE: "bg-gray-100 text-gray-600",
  EXPERT: "bg-emerald-50 text-emerald-600",
  SYNDIC: "bg-purple-50 text-purple-600",
  AGENCE: "bg-blue-50 text-blue-600",
  AUTRE: "bg-gray-100 text-gray-500",
};

export default async function ContactsPage() {
  const h = await headers();
  const societyId = h.get("x-society-id");

  if (!societyId) redirect("/login");

  const contacts = await getContacts(societyId);

  const grouped = contacts.reduce<Record<string, typeof contacts>>(
    (acc, contact) => {
      const key = contact.contactType;
      if (!acc[key]) acc[key] = [];
      acc[key].push(contact);
      return acc;
    },
    {}
  );

  const typeOrder = [
    "LOCATAIRE",
    "PRESTATAIRE",
    "NOTAIRE",
    "EXPERT",
    "SYNDIC",
    "AGENCE",
    "AUTRE",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-brand-deep)]">Contacts</h1>
          <p className="text-muted-foreground text-sm">
            {contacts.length} contact{contacts.length > 1 ? "s" : ""} enregistré
            {contacts.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncTenantsButton societyId={societyId} />
          <Link href="/contacts/nouveau">
            <Button className="bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg gap-1.5">
              <Plus className="h-4 w-4" />
              Nouveau contact
            </Button>
          </Link>
        </div>
      </div>

      {contacts.length === 0 && (
        <Card className="border-0 shadow-brand bg-white rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-brand-light)] mb-4">
              <Users className="h-7 w-7 text-[var(--color-brand-blue)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-brand-deep)] mb-2">Aucun contact</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Ajoutez vos prestataires, notaires, experts ou synchronisez vos locataires.
            </p>
            <div className="flex items-center gap-2">
              <SyncTenantsButton societyId={societyId} />
              <Link href="/contacts/nouveau">
                <Button className="bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg gap-1.5">
                  <Plus className="h-4 w-4" />
                  Ajouter un contact
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {typeOrder.map((type) => {
        const list = grouped[type];
        if (!list?.length) return null;
        return (
          <div key={type}>
            <h2 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-3">
              {TYPE_LABELS[type] ?? type}
              <span className="ml-2 normal-case font-normal">({list.length})</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((contact) => (
                <Link key={contact.id} href={`/contacts/${contact.id}`}>
                  <Card className="h-full border-0 shadow-brand bg-white rounded-xl hover:shadow-brand-lg transition-shadow cursor-pointer">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm leading-tight text-[var(--color-brand-deep)]">{contact.name}</p>
                          {contact.company && (
                            <p className="text-xs text-[#94A3B8] mt-0.5">{contact.company}</p>
                          )}
                          {contact.specialty && (
                            <p className="text-xs text-[#94A3B8]">{contact.specialty}</p>
                          )}
                        </div>
                        <span className={`inline-flex shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[contact.contactType] ?? "bg-gray-100 text-gray-500"}`}>
                          {TYPE_LABELS[contact.contactType]}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {contact.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                            <Phone className="h-3 w-3 text-[#94A3B8]" />
                            {contact.phone}
                          </div>
                        )}
                        {contact.mobile && !contact.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                            <Phone className="h-3 w-3 text-[#94A3B8]" />
                            {contact.mobile}
                          </div>
                        )}
                        {contact.email && (
                          <div className="flex items-center gap-1.5 text-xs text-[#64748B] truncate">
                            <Mail className="h-3 w-3 shrink-0 text-[#94A3B8]" />
                            <span className="truncate">{contact.email}</span>
                          </div>
                        )}
                        {contact.city && (
                          <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                            <Building2 className="h-3 w-3 text-[#94A3B8]" />
                            {contact.postalCode} {contact.city}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
