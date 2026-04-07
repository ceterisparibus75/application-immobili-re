"use client";

import { FilterPanel, type FilterDefinition } from "@/components/ui/filter-panel";

const STATUS_OPTIONS = [
  { value: "EN_ATTENTE", label: "En attente" },
  { value: "BROUILLON", label: "Brouillon" },
  { value: "VALIDEE", label: "Validée" },
  { value: "ENVOYEE", label: "Envoyée" },
  { value: "RELANCEE", label: "Relancée" },
  { value: "PAYE", label: "Payé" },
  { value: "PARTIELLEMENT_PAYE", label: "Partiellement payé" },
  { value: "EN_RETARD", label: "En retard" },
  { value: "IRRECOUVRABLE", label: "Irrécouvrable" },
  { value: "ANNULEE", label: "Annulée" },
  { value: "LITIGIEUX", label: "Litigieux" },
];

const TYPE_OPTIONS = [
  { value: "APPEL_LOYER", label: "Appel de loyer" },
  { value: "QUITTANCE", label: "Quittance" },
  { value: "REGULARISATION_CHARGES", label: "Régularisation de charges" },
  { value: "REFACTURATION", label: "Refacturation" },
  { value: "AVOIR", label: "Avoir" },
];

export function FacturationFilters() {
  const filters: FilterDefinition[] = [
    {
      key: "status",
      label: "Statut",
      type: "select",
      options: STATUS_OPTIONS,
    },
    {
      key: "invoiceType",
      label: "Type de document",
      type: "select",
      options: TYPE_OPTIONS,
    },
    {
      key: "period",
      label: "Période",
      type: "date-range",
    },
    {
      key: "amount",
      label: "Montant TTC",
      type: "amount-range",
    },
  ];

  return <FilterPanel filters={filters} />;
}
