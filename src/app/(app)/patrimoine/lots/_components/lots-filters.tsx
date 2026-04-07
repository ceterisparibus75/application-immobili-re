"use client";

import { FilterPanel, type FilterDefinition } from "@/components/ui/filter-panel";
import { EXPLOITATION_STATUSES } from "@/lib/constants";

interface LotsFiltersProps {
  buildings: { id: string; name: string }[];
}

const STATUS_OPTIONS = [
  { value: "VACANT", label: "Vacant" },
  { value: "OCCUPE", label: "Occupé" },
  { value: "EN_TRAVAUX", label: "En travaux" },
  { value: "RESERVE", label: "Réservé" },
];

const LOT_TYPE_OPTIONS = [
  { value: "LOCAL_COMMERCIAL", label: "Local commercial" },
  { value: "BUREAUX", label: "Bureaux" },
  { value: "LOCAL_ACTIVITE", label: "Local d'activité" },
  { value: "RESERVE", label: "Réserve" },
  { value: "PARKING", label: "Parking" },
  { value: "CAVE", label: "Cave" },
  { value: "TERRASSE", label: "Terrasse" },
  { value: "ENTREPOT", label: "Entrepôt" },
  { value: "APPARTEMENT", label: "Appartement" },
];

export function LotsFilters({ buildings }: LotsFiltersProps) {
  const filters: FilterDefinition[] = [
    {
      key: "status",
      label: "Disponibilité",
      type: "select",
      options: STATUS_OPTIONS,
    },
    {
      key: "lotType",
      label: "Type de lot",
      type: "select",
      options: LOT_TYPE_OPTIONS,
    },
    {
      key: "buildingId",
      label: "Immeuble",
      type: "select",
      options: buildings.map((b) => ({ value: b.id, label: b.name })),
    },
    {
      key: "exploitationStatus",
      label: "Statut d'exploitation",
      type: "select",
      options: EXPLOITATION_STATUSES.map((s) => ({ value: s.value, label: s.label })),
    },
  ];

  return <FilterPanel filters={filters} />;
}
