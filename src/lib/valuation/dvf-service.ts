import type { DvfTransaction, DvfSearchParams } from "./types";

/**
 * API DVF officielle Etalab — recherche par code commune.
 * Documentation : https://app.dvf.etalab.gouv.fr/api
 */
const DVF_API_URL = "https://app.dvf.etalab.gouv.fr/api/mutations";
const GEO_API_URL = "https://geo.api.gouv.fr";

/**
 * Recherche les transactions DVF pour une commune donnée.
 * 1. Résout le code INSEE à partir du code postal via geo.api.gouv.fr
 * 2. Interroge l'API DVF officielle Etalab par code commune
 * 3. Calcule les distances si les coordonnées du bien sont fournies
 */
export async function searchDvfTransactions(
  params: DvfSearchParams
): Promise<DvfTransaction[]> {
  const { postalCode, city, latitude, longitude, periodYears, propertyTypes } = params;

  try {
    // 1. Résoudre le code INSEE depuis le code postal
    const commune = await getCommuneInfo(postalCode, city);
    if (!commune) {
      console.error("[DVF] Commune introuvable pour", postalCode, city);
      return [];
    }

    // 2. Chercher les mutations DVF par code département + code commune
    const allTransactions: DvfTransaction[] = [];
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - periodYears;

    // L'API Etalab nécessite de requêter année par année
    for (let year = Math.max(startYear, 2019); year <= currentYear; year++) {
      try {
        const yearTransactions = await fetchDvfByCommune(
          commune.codeDepartement,
          commune.code,
          year,
          latitude,
          longitude
        );
        allTransactions.push(...yearTransactions);
      } catch (error) {
        console.error(`[DVF] Erreur année ${year}:`, error);
      }
    }

    // 3. Filtrer par type de bien et trier
    return allTransactions
      .filter((t) => filterByPropertyType(t, propertyTypes))
      .filter((t) => t.salePrice > 0)
      .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())
      .slice(0, 100);
  } catch (error) {
    console.error("[DVF] Erreur recherche:", error);
    return [];
  }
}

/**
 * Résout le code INSEE et le département depuis le code postal
 */
async function getCommuneInfo(
  postalCode: string,
  city: string
): Promise<{ code: string; codeDepartement: string; nom: string; centre?: { coordinates: [number, number] } } | null> {
  try {
    const url = `${GEO_API_URL}/communes?codePostal=${postalCode}&fields=nom,code,codeDepartement,centre&limit=10`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) return null;

    const communes = await response.json() as Array<{
      nom: string;
      code: string;
      codeDepartement: string;
      centre?: { type: string; coordinates: [number, number] };
    }>;
    if (communes.length === 0) return null;

    if (communes.length === 1) return communes[0];

    // Si plusieurs communes, chercher par nom
    const normalized = city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const match = communes.find((c) =>
      c.nom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalized) ||
      normalized.includes(c.nom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    );

    return match ?? communes[0];
  } catch {
    return null;
  }
}

/**
 * Interroge l'API DVF Etalab par département + code commune + année
 */
async function fetchDvfByCommune(
  codeDepartement: string,
  codeCommune: string,
  year: number,
  centerLat?: number | null,
  centerLng?: number | null
): Promise<DvfTransaction[]> {
  // API: https://app.dvf.etalab.gouv.fr/api/mutations?code_commune=76540&annee_min=2023&annee_max=2023
  const url = new URL(DVF_API_URL);
  url.searchParams.set("code_commune", codeCommune);
  url.searchParams.set("annee_min", String(year));
  url.searchParams.set("annee_max", String(year));

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`DVF Etalab API error: ${response.status}`);
  }

  const mutations = await response.json() as EtalabMutation[];

  return mutations
    .filter((m) => m.nature_mutation === "Vente")
    .map((m) => mapEtalabMutation(m, centerLat, centerLng));
}

// ============================================================
// Mapping
// ============================================================

function mapEtalabMutation(
  mutation: EtalabMutation,
  centerLat?: number | null,
  centerLng?: number | null
): DvfTransaction {
  const builtArea = mutation.surface_reelle_bati ?? null;
  const salePrice = mutation.valeur_fonciere ?? 0;
  const lat = mutation.latitude ?? null;
  const lng = mutation.longitude ?? null;

  return {
    id: mutation.id_mutation ?? `dvf-${Date.now()}-${Math.random()}`,
    address: [mutation.adresse_numero, mutation.adresse_suffixe, mutation.adresse_nom_voie].filter(Boolean).join(" "),
    city: mutation.nom_commune ?? "",
    postalCode: mutation.code_postal ?? "",
    saleDate: mutation.date_mutation ?? "",
    salePrice,
    builtArea,
    landArea: mutation.surface_terrain ?? null,
    pricePerSqm: builtArea && builtArea > 0 ? Math.round(salePrice / builtArea) : null,
    propertyType: mapPropertyType(mutation.type_local),
    latitude: lat,
    longitude: lng,
    distanceKm:
      lat && lng && centerLat && centerLng
        ? haversineDistance(centerLat, centerLng, lat, lng)
        : null,
  };
}

function mapPropertyType(typeLocal: string | null | undefined): string {
  switch (typeLocal) {
    case "Maison":
    case "Appartement":
      return "HABITATION";
    case "Local industriel. commercial ou assimilé":
    case "Local commercial":
      return "COMMERCIAL";
    case "Dépendance":
      return "MIXTE";
    default:
      return "MIXTE";
  }
}

function filterByPropertyType(
  transaction: DvfTransaction,
  propertyTypes?: string[]
): boolean {
  if (!propertyTypes || propertyTypes.length === 0) return true;
  return propertyTypes.includes(transaction.propertyType);
}

/** Calcul de distance Haversine entre deux points GPS (en km) */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

// ============================================================
// Types API Etalab
// ============================================================

interface EtalabMutation {
  id_mutation?: string;
  date_mutation?: string;
  nature_mutation?: string;
  valeur_fonciere?: number;
  adresse_numero?: string;
  adresse_suffixe?: string;
  adresse_nom_voie?: string;
  code_postal?: string;
  nom_commune?: string;
  code_commune?: string;
  type_local?: string;
  surface_reelle_bati?: number;
  surface_terrain?: number;
  nombre_pieces_principales?: number;
  latitude?: number;
  longitude?: number;
}
