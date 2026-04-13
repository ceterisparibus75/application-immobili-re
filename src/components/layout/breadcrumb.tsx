"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEffect, useState, useRef } from "react";

const LABELS: Record<string, string> = {
  dashboard: "Tableau de bord", patrimoine: "Patrimoine", immeubles: "Immeubles",
  lots: "Lots", baux: "Baux", locataires: "Locataires", facturation: "Facturation",
  charges: "Charges", comptabilite: "Comptabilité", cashflow: "Cash-flow",
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
  evaluations: "Évaluations", planification: "Planification", compte: "Compte",
  abonnement: "Abonnement", setup: "Configuration",
  "releves-tiers": "Relevés tiers", "releves-gestion": "Décomptes de gestion",
  copropriete: "Copropriété", saisonnier: "Saisonnier", candidatures: "Candidatures",
  workflows: "Workflows", assistant: "Assistant IA", courriers: "Courriers",
  previsionnel: "Prévisionnel", valorisation: "Valorisation",
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

/** Cache mémoire pour éviter de re-fetch les noms déjà résolus */
const nameCache = new Map<string, string>();

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});
  const lastPathRef = useRef("");

  // Fetch les noms d'entités pour les segments ID
  useEffect(() => {
    if (pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;

    const hasIds = segments.some((s) => isIdSegment(s));
    if (!hasIds) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResolvedNames({});
      return;
    }

    // Vérifier le cache d'abord
    const cached: Record<string, string> = {};
    let allCached = true;
    for (let i = 0; i < segments.length; i++) {
      if (isIdSegment(segments[i])) {
        const key = `${segments[i - 1]}:${segments[i]}`;
        const cachedName = nameCache.get(key);
        if (cachedName) {
          cached[String(i)] = cachedName;
        } else {
          allCached = false;
        }
      }
    }

    if (allCached) {
      setResolvedNames(cached);
      return;
    }

    const controller = new AbortController();
    fetch(`/api/breadcrumb?path=${encodeURIComponent(pathname)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: Record<string, string>) => {
        // Mettre en cache
        for (const [idx, name] of Object.entries(data)) {
          const i = Number(idx);
          const key = `${segments[i - 1]}:${segments[i]}`;
          nameCache.set(key, name);
        }
        setResolvedNames({ ...cached, ...data });
      })
      .catch(() => {
        setResolvedNames(cached);
      });

    return () => controller.abort();
  }, [pathname, segments]);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((segment, index) => {
    let href = "/" + segments.slice(0, index + 1).join("/");
    const isId = isIdSegment(segment);
    const label = isId
      ? resolvedNames[String(index)] ?? "…"
      : getLabel(segment);
    const isLast = index === segments.length - 1;

    // Si ce segment est un sous-segment d'un ID (ex: /immeubles/[id]/lots),
    // pointer vers la page de l'ID parent plutôt que vers une route inexistante.
    if (index > 0 && CHILD_SEGMENTS_OF_ID.has(segment) && isIdSegment(segments[index - 1])) {
      href = "/" + segments.slice(0, index).join("/");
    }

    return { href, label, isLast, isId };
  });

  return (
    <nav className="flex items-center gap-1 px-6 lg:px-8 py-2.5 text-xs text-muted-foreground">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href + i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-border" />}
          {crumb.isLast ? (
            <span className={`font-medium ${crumb.isId ? "text-primary" : "text-foreground"}`}>
              {crumb.label}
            </span>
          ) : (
            <Link href={crumb.href} className="hover:text-foreground transition-colors max-w-[200px] truncate">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
