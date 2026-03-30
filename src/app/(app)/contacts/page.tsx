import { headers } from "next/headers";
import { getContacts } from "@/actions/contact";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Phone, Mail, Building2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

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

const TYPE_COLORS: Record<string, "default" | "secondary" | "outline"> = {
  LOCATAIRE: "default",
  PRESTATAIRE: "secondary",
  NOTAIRE: "outline",
  EXPERT: "outline",
  SYNDIC: "secondary",
  AGENCE: "secondary",
  AUTRE: "outline",
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
    "PRESTATAIRE",
    "NOTAIRE",
    "EXPERT",
    "SYNDIC",
    "AGENCE",
    "LOCATAIRE",
    "AUTRE",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">
            {contacts.length} contact{contacts.length > 1 ? "s" : ""} enregistré
            {contacts.length > 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/contacts/nouveau">
          <Button>
            <Plus className="h-4 w-4" />
            Nouveau contact
          </Button>
        </Link>
      </div>

      {contacts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              Aucun contact enregistré.
            </p>
            <Link href="/contacts/nouveau" className="mt-3 inline-block">
              <Button variant="outline" size="sm">
                Ajouter un contact
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {typeOrder.map((type) => {
        const list = grouped[type];
        if (!list?.length) return null;
        return (
          <div key={type}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {TYPE_LABELS[type] ?? type}
              <span className="ml-2 normal-case font-normal">({list.length})</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((contact) => (
                <Link key={contact.id} href={`/contacts/${contact.id}`}>
                  <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm leading-tight">{contact.name}</p>
                          {contact.company && (
                            <p className="text-xs text-muted-foreground mt-0.5">{contact.company}</p>
                          )}
                          {contact.specialty && (
                            <p className="text-xs text-muted-foreground">{contact.specialty}</p>
                          )}
                        </div>
                        <Badge variant={TYPE_COLORS[contact.contactType] ?? "outline"} className="shrink-0 text-xs">
                          {TYPE_LABELS[contact.contactType]}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        {contact.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {contact.phone}
                          </div>
                        )}
                        {contact.mobile && !contact.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {contact.mobile}
                          </div>
                        )}
                        {contact.email && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{contact.email}</span>
                          </div>
                        )}
                        {contact.city && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />
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
