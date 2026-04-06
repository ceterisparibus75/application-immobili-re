import type { DvfTransaction, DvfSearchParams } from "./types";

/**
 * API DVF officielle Etalab — recherche par code commune.
 * Fonctionne sans coordonnées GPS, juste avec le code postal.
 * Documentation : https://api.gouv.fr/les-api/api-dvf
 */
const DVF_ETALAB_URL = "https://api.cquest.org/dvf";
const GEO_API_URL = "https://geo.api.gouv.fr";

/**
 * Recherche les transactions DVF pour une commune donnée.
 * 1. Résout le code INSEE à partir du code postal via geo.api.gouv.fr
 * 2. Interroge l'API DVF par code commune
 * 3. Calcule les distances si les coordonnées du bien sont fournies
 */
export async function searchDvfTransactions(
  params: DvfSearchParams
): Promise<DvfTransaction[]> {
  const { postalCode, city, latitude, longitude, periodYears, propertyTypes } = params;

  const dateMin = new Date();
  dateMin.setFullYear(dateMin.getFullYear() - periodYears);
  const dateMinStr = dateMin.toISOString().split("T")[0];

  try {
    // 1. Résoudre le code INSEE depuis le code postal
    const codeInsee = await getCodeInsee(postalCode, city);
    if (!codeInsee) {
      console.error("[DVF] Code INSEE introuvable pour", postalCode, city);
      return [];
    }

    // 2. Chercher les mutations DVF via l'API cquest (par code commune)
    const transactions = await fetchDvfByCommune(codeInsee, dateMinStr, latitude, longitude);

    // 3. Filtrer par type de bien
    return transactions
      .filter((t) => filterByPropertyType(t, propertyTypes))
      .filter((t) => t.salePrice > 0)
      .sort((a, b) => {
        // Trier par date décroissante (plus récentes d'abord)
        return new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime();
      })
      .slice(0, 100);
  } catch (error) {
    console.error("[DVF] Erreur recherche:", error);
    return [];
  }
}

/**
 * Résout le code INSEE à partir du code postal via l'API Geo
 */
async function getCodeInsee(postalCode: string, city: string): Promise<string | null> {
  try {
    const url = `${GEO_API_URL}/communes?codePostal=${postalCode}&fields=nom,code&limit=10`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) return null;

    const communes = await response.json() as Array<{ nom: string; code: string }>;
    if (communes.length === 0) return null;

    // Si une seule commune, la retourner
    if (communes.length === 1) return communes[0].code;

    // Si plusieurs, chercher la correspondance par nom de ville
    const normalized = city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const match = communes.find((c) =>
      c.nom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalized) ||
      normalized.includes(c.nom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    );

    return match?.code ?? communes[0].code;
  } catch {
    return null;
  }
}

/**
 * Interroge l'API DVF par code commune
 */
async function fetchDvfByCommune(
  codeInsee: string,
  dateMin: string,
  centerLat?: number | null,
  centerLng?: number | null
): Promise<DvfTransaction[]> {
  const url = new URL(DVF_ETALAB_URL);
  url.searchParams.set("code_commune", codeInsee);

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`DVF API error: ${response.status}`);
  }

  const data = await response.json() as CquestResponse;
  const results = data.resultats ?? [];

  return results
    .filter((r) => new Date(r.date_mutation) >= new Date(dateMin))
    .map((r) => mapDvfResult(r, centerLat, centerLng));
}

// ============================================================
// Mapping
// ============================================================

function mapDvfResult(
  result: CquestResult,
  centerLat?: number | null,
  centerLng?: number | null
): DvfTransaction {
  const builtArea = result.surface_reelle_bati ?? null;
  const salePrice = result.valeur_fonciere ?? 0;
  const lat = result.latitude ?? null;
  const lng = result.longitude ?? null;

  return {
    id: result.id_mutation ?? `dvf-${Date.now()}-${Math.random()}`,
    address: [result.adresse_numero, result.adresse_nom_voie].filter(Boolean).join(" "),
    city: result.nom_commune ?? "",
    postalCode: result.code_postal ?? "",
    saleDate: result.date_mutation ?? "",
    salePrice,
    builtArea,
    landArea: result.surface_terrain ?? null,
    pricePerSqm: builtArea && builtArea > 0 ? Math.round(salePrice / builtArea) : null,
    propertyType: mapPropertyType(result.type_local),
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
// Types API
// ============================================================

interface CquestResponse {
  resultats: CquestResult[];
}

interface CquestResult {
  id_mutation?: string;
  date_mutation: string;
  valeur_fonciere?: number;
  adresse_numero?: string;
  adresse_nom_voie?: string;
  code_postal?: string;
  nom_commune?: string;
  type_local?: string;
  surface_reelle_bati?: number;
  surface_terrain?: number;
  latitude?: number;
  longitude?: number;
}
