import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getContactById } from "@/actions/contact";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Building2,
  FileText,
  Pencil,
} from "lucide-react";
import Link from "next/link";

const TYPE_LABELS: Record<string, string> = {
  LOCATAIRE: "Locataire",
  PRESTATAIRE: "Prestataire",
  NOTAIRE: "Notaire",
  EXPERT: "Expert",
  SYNDIC: "Syndic",
  AGENCE: "Agence",
  AUTRE: "Autre",
};

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const h = await headers();
  const societyId = h.get("x-society-id");
  if (!societyId) return notFound();

  const contact = await getContactById(societyId, id);
  if (!contact) return notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/contacts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{contact.name}</h1>
          {contact.company && (
            <p className="text-muted-foreground">{contact.company}</p>
          )}
        </div>
        <Badge variant="secondary">
          {TYPE_LABELS[contact.contactType] ?? contact.contactType}
        </Badge>
        <Link href={`/contacts/${id}/modifier`}>
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4" />
            Modifier
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Coordonnées */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contact.specialty && (
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Spécialité</p>
                  <p className="text-sm">{contact.specialty}</p>
                </div>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Téléphone</p>
                  <a href={`tel:${contact.phone}`} className="text-sm hover:underline">
                    {contact.phone}
                  </a>
                </div>
              </div>
            )}
            {contact.mobile && (
              <div className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Mobile</p>
                  <a href={`tel:${contact.mobile}`} className="text-sm hover:underline">
                    {contact.mobile}
                  </a>
                </div>
              </div>
            )}
            {contact.email && (
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <a href={`mailto:${contact.email}`} className="text-sm hover:underline break-all">
                    {contact.email}
                  </a>
                </div>
              </div>
            )}
            {(contact.addressLine1 || contact.city) && (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Adresse</p>
                  {contact.addressLine1 && (
                    <p className="text-sm">{contact.addressLine1}</p>
                  )}
                  {(contact.postalCode || contact.city) && (
                    <p className="text-sm">
                      {contact.postalCode} {contact.city}
                    </p>
                  )}
                </div>
              </div>
            )}
            {!contact.phone && !contact.mobile && !contact.email && !contact.city && (
              <p className="text-sm text-muted-foreground">Aucune coordonnée renseignée</p>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contact.notes ? (
              <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune note</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes internes (ContactNote) */}
      {contact.contactNotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historique des notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contact.contactNotes.map((note) => (
              <div key={note.id} className="border-l-2 border-muted pl-3">
                <p className="text-xs text-muted-foreground mb-1">
                  {new Date(note.createdAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
