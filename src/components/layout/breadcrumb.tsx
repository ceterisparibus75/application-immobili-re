"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  dashboard: "Tableau de bord", patrimoine: "Patrimoine", immeubles: "Immeubles",
  lots: "Lots", baux: "Baux", locataires: "Locataires", facturation: "Facturation",
  charges: "Charges", comptabilite: "Comptabilite", previsionnel: "Previsionnel",
  banque: "Banque", emprunts: "Emprunts", relances: "Relances", contacts: "Contacts",
  documents: "Documents", indices: "Indices", rgpd: "RGPD", parametres: "Parametres",
  administration: "Administration", utilisateurs: "Utilisateurs", fusions: "Fusions",
  audit: "Audit", societes: "Societes", notifications: "Notifications",
  rapports: "Rapports", import: "Import", nouveau: "Nouveau", nouvelle: "Nouveau",
  modifier: "Modifier", apercu: "Apercu", avoir: "Avoir", generer: "Generer",
  diagnostics: "Diagnostics", maintenances: "Maintenances", inspections: "Inspections",
  demandes: "Demandes", settings: "Parametres", security: "Securite", portal: "Portail",
  proprietaire: "Proprietaire", dataroom: "Datarooms",
};

function getLabel(segment: string): string {
  if (/^[a-z0-9]{20,}$/.test(segment)) return "Detail";
  return LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const label = getLabel(segment);
    const isLast = index === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav className="flex items-center gap-1 px-6 lg:px-8 py-2.5 text-xs text-muted-foreground">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
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
