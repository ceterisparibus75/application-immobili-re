"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

const LABELS: Record<string, string> = {
  dashboard: "Tableau de bord",
  patrimoine: "Patrimoine",
  immeubles: "Immeubles",
  lots: "Lots",
  baux: "Baux",
  locataires: "Locataires",
  facturation: "Facturation",
  charges: "Charges",
  comptabilite: "Comptabilite",
  previsionnel: "Previsionnel",
  banque: "Banque",
  emprunts: "Emprunts",
  relances: "Relances",
  contacts: "Contacts",
  documents: "Documents",
  indices: "Indices",
  rgpd: "RGPD",
  parametres: "Parametres",
  administration: "Administration",
  utilisateurs: "Utilisateurs",
  fusions: "Fusions",
  audit: "Audit",
  societes: "Societes",
  notifications: "Notifications",
  rapports: "Rapports",
  import: "Import",
  nouveau: "Nouveau",
  nouvelle: "Nouveau",
  modifier: "Modifier",
  apercu: "Apercu",
  avoir: "Avoir",
  generer: "Generer",
  diagnostics: "Diagnostics",
  maintenances: "Maintenances",
  inspections: "Inspections",
  demandes: "Demandes",
  settings: "Parametres",
  security: "Securite",
  portal: "Portail",
};

function getLabel(segment: string): string {
  // Dynamic segment like [id] — show generic label
  if (/^[a-z0-9]{20,}$/.test(segment)) return "Detail";
  return LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Hide on dashboard or if only 1 segment
  if (segments.length <= 1) return null;

  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const label = getLabel(segment);
    const isLast = index === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav className="flex items-center gap-1 px-5 lg:px-6 py-2 text-xs text-muted-foreground border-b border-border/40 bg-background/50">
      <Link href="/dashboard" className="hover:text-foreground transition-colors">
        <Home className="h-3 w-3" />
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3" />
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
