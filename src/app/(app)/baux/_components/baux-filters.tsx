"use client";

import { FilterPanel, type FilterDefinition } from "@/components/ui/filter-panel";

interface BauxFiltersProps {
  buildings: { id: string; name: string }[];
  proprietaires: { id: string; label: string }[];
}

const STATUS_OPTIONS = [
  { value: "EN_COURS", label: "En cours" },
  { value: "RESILIE", label: "Résilié" },
  { value: "RENOUVELE", label: "Renouvelé" },
  { value: "EN_NEGOCIATION", label: "En négociation" },
  { value: "CONTENTIEUX", label: "Contentieux" },
];

const LEASE_TYPE_OPTIONS = [
  { value: "HABITATION", label: "Habitation", group: "Habitation" },
  { value: "MEUBLE", label: "Meublé", group: "Habitation" },
  { value: "ETUDIANT", label: "Étudiant", group: "Habitation" },
  { value: "MOBILITE", label: "Mobilité", group: "Habitation" },
  { value: "COLOCATION", label: "Colocation", group: "Habitation" },
  { value: "SAISONNIER", label: "Saisonnier", group: "Habitation" },
  { value: "LOGEMENT_FONCTION", label: "Logement fonction", group: "Habitation" },
  { value: "ANAH", label: "ANAH", group: "Habitation" },
  { value: "CIVIL", label: "Civil", group: "Habitation" },
  { value: "GLISSANT", label: "Glissant", group: "Habitation" },
  { value: "SOUS_LOCATION", label: "Sous-location", group: "Habitation" },
  { value: "COMMERCIAL_369", label: "3-6-9", group: "Commercial" },
  { value: "DEROGATOIRE", label: "Dérogatoire", group: "Commercial" },
  { value: "PRECAIRE", label: "Précaire", group: "Commercial" },
  { value: "BAIL_PROFESSIONNEL", label: "Professionnel", group: "Commercial" },
  { value: "MIXTE", label: "Mixte", group: "Commercial" },
  { value: "EMPHYTEOTIQUE", label: "Emphytéotique", group: "Foncier" },
  { value: "CONSTRUCTION", label: "Construction", group: "Foncier" },
  { value: "REHABILITATION", label: "Réhabilitation", group: "Foncier" },
  { value: "BRS", label: "BRS", group: "Foncier" },
  { value: "RURAL", label: "Rural", group: "Rural" },
  { value: "AUTORISATION_OCCUPATION_TEMPORAIRE", label: "AOT", group: "Conventions" },
  { value: "CONVENTION_OCCUPATION_PRECAIRE", label: "COP", group: "Conventions" },
  { value: "CONVENTION_OCCUPATION_TEMPORAIRE", label: "COT", group: "Conventions" },
  { value: "BAIL_METAYAGE", label: "Métayage", group: "Rural" },
  { value: "CONVENTION_COLIVING", label: "Coliving", group: "Conventions" },
  { value: "CONVENTION_MISE_A_DISPOSITION", label: "CMD", group: "Conventions" },
  { value: "BAIL_GLISSANT", label: "Bail glissant", group: "Conventions" },
  { value: "BAIL_LOI_48", label: "Loi 48", group: "Conventions" },
  { value: "LOCATION_PARKING", label: "Parking", group: "Divers" },
  { value: "LOCATION_STOCKAGE", label: "Stockage", group: "Divers" },
  { value: "DROIT_DE_PASSAGE", label: "Passage", group: "Divers" },
  { value: "AUTRE", label: "Autre", group: "Divers" },
];

export function BauxFilters({ buildings, proprietaires }: BauxFiltersProps) {
  const filters: FilterDefinition[] = [
    {
      key: "status",
      label: "Statut du bail",
      type: "select",
      options: STATUS_OPTIONS,
    },
    {
      key: "leaseType",
      label: "Type de bail",
      type: "select",
      options: LEASE_TYPE_OPTIONS,
    },
    {
      key: "buildingId",
      label: "Immeuble",
      type: "select",
      options: buildings.map((b) => ({ value: b.id, label: b.name })),
    },
  ];

  if (proprietaires.length > 1) {
    filters.push({
      key: "proprietaireId",
      label: "Propriétaire",
      type: "select",
      options: proprietaires.map((p) => ({ value: p.id, label: p.label })),
    });
  }

  return <FilterPanel filters={filters} />;
}
