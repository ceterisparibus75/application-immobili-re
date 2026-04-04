"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  dashboard: "Tableau de bord", patrimoine: "Patrimoine", immeubles: "Immeubles",
  lots: "Lots", baux: "Baux", locataires: "Locataires", facturation: "Facturation",
  charges: "Charges", comptabilite: "Comptabilité", previsionnel: "Prévisionnel",
  banque: "Banque", emprunts: "Emprunts", relances: "Relances", contacts: "Contacts",
  documents: "Documents", indices: "Indices", rgpd: "RGPD", parametres: "Paramètres",
  administration: "Administration", utilisateurs: "Utilisateurs", fusions: "Fusions",
  audit: "Audit", societes: "Sociétés", notifications: "Notifications",
  rapports: "Rapports", import: "Import", nouveau: "Nouveau", nouvelle: "Nouveau",
  modifier: "Modifier", apercu: "Aperçu", avoir: "Avoir", generer: "Générer",
  diagnostics: "Diagnostics", maintenances: "Maintenances", inspections: "Inspections",
  demandes: "Demandes", settings: "Paramètres", security: "Sécurité", portal: "Portail",
  proprietaire: "Propriétaire", dataroom: "Datarooms", rapprochement: "Rapprochement",
  cloture: "Clôture", exports: "Exports", revisions: "Révisions",
};

function isIdSegment(segment: string): boolean {
  return /^[a-z0-9]{20,}$/.test(segment);
}

function getLabel(segment: string): string {
  if (isIdSegment(segment)) return "Détail";
  return LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

// Segments qui, lorsqu'ils apparaissent directement après un ID,
// n'ont pas de page propre et doivent pointer vers la page de l'ID parent.
const CHILD_SEGMENTS_OF_ID = new Set([
  "lots", "diagnostics", "maintenances", "inspections",
]);

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((segment, index) => {
    let href = "/" + segments.slice(0, index + 1).join("/");
    const label = getLabel(segment);
    const isLast = index === segments.length - 1;

    // Si ce segment est un sous-segment d'un ID (ex: /immeubles/[id]/lots),
    // pointer vers la page de l'ID parent plutôt que vers une route inexistante.
    if (index > 0 && CHILD_SEGMENTS_OF_ID.has(segment) && isIdSegment(segments[index - 1])) {
      href = "/" + segments.slice(0, index).join("/");
    }

    return { href, label, isLast };
  });

  return (
    <nav className="flex items-center gap-1 px-6 lg:px-8 py-2.5 text-xs text-muted-foreground">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href + i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-border" />}
          {crumb.isLast ? (
            <span className="text-foreground font-medium">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-foreground transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
