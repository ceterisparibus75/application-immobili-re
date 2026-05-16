import { AlertTriangle } from "lucide-react";

/**
 * Bandeau affiché sur toutes les surfaces e-invoicing (Chorus Pro / PA B2B).
 *
 * Tant que le flow OAuth, les statuts de soumission et la conformité PDP /
 * Annuaire PPF ne sont pas validés en conditions réelles avec un client
 * pilote, ces fonctionnalités sont marquées "intégration en cours".
 *
 * L'obligation légale de réception entre en vigueur au 1er septembre 2026 :
 * https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises
 */
export function EInvoicingBetaBanner({ variant = "default" }: { variant?: "default" | "compact" }) {
  if (variant === "compact") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs dark:border-amber-700 dark:bg-amber-950/40">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
        <span className="text-amber-900 dark:text-amber-200">
          <strong>Intégration en cours.</strong> Validation conformité PA/PDP en
          conditions réelles avant l&apos;échéance du 1<sup>er</sup> sept. 2026.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Facturation électronique — intégration en cours
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Les flux Chorus Pro (B2G) et Plateforme Agréée B2B sont implémentés
            et testables en sandbox. Le passage en production réelle dépend de
            la validation du contrat partenaire avec la PA choisie et de la
            certification DGFiP. À utiliser pour préparer la conformité à
            l&apos;obligation du 1<sup>er</sup> septembre 2026, pas comme
            système de production exclusif tant que la validation pilote n&apos;est
            pas faite.
          </p>
          <p className="text-xs">
            <a
              href="https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-900 dark:text-amber-200 underline hover:no-underline"
            >
              Détails de l&apos;obligation légale →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
