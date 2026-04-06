import type { DvfTransaction, DvfSearchParams } from "./types";

const DVF_API_URL = "https://apidf-preprod.cerema.fr/dvf/geomutations/";
const DVF_FALLBACK_URL = "https://api.cquest.org/dvf";

/**
 * Recherche les transactions immobilières DVF (Demandes de Valeurs Foncières)
 * dans un rayon autour de coordonnées GPS.
 *
 * L'API DVF est publique et gratuite (données Etalab).
 * Couvre principalement la France métropolitaine.
 */
export async function searchDvfTransactions(
  params: DvfSearchParams
): Promise<DvfTransaction[]> {
  const { latitude, longitude, radiusKm, periodYears, propertyTypes } = params;

  const dateMin = new Date();
  dateMin.setFullYear(dateMin.getFullYear() - periodYears);
  const dateMinStr = dateMin.toISOString().split("T")[0];

  // Convertir rayon en bounding box approximative
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));

  const bbox = {
    latMin: latitude - latDelta,
    latMax: latitude + latDelta,
    lngMin: longitude - lngDelta,
    lngMax: longitude + lngDelta,
  };

  try {
    return await fetchFromCerema(bbox, dateMinStr, latitude, longitude, propertyTypes);
  } catch {
    // Fallback vers l'API communautaire cquest
    try {
      return await fetchFromCquest(bbox, dateMinStr, latitude, longitude, propertyTypes);
    } catch {
      // Graceful fallback: retourner une liste vide (DOM-TOM, données absentes, etc.)
      return [];
    }
  }
}

async function fetchFromCerema(
  bbox: { latMin: number; latMax: number; lngMin: number; lngMax: number },
  dateMin: string,
  centerLat: number,
  centerLng: number,
  propertyTypes?: string[]
): Promise<DvfTransaction[]> {
  const url = new URL(DVF_API_URL);
  url.searchParams.set("in_bbox", `${bbox.lngMin},${bbox.latMin},${bbox.lngMax},${bbox.latMax}`);
  url.searchParams.set("date_mutation_min", dateMin);
  url.searchParams.set("nature_mutation", "Vente");
  url.searchParams.set("page_size", "100");

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`CEREMA API error: ${response.status}`);
  }

  const data = await response.json() as CeremaResponse;
  const features = data.features ?? [];

  return features
    .map((f) => mapCeremaFeature(f, centerLat, centerLng))
    .filter((t) => filterByPropertyType(t, propertyTypes))
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
}

async function fetchFromCquest(
  bbox: { latMin: number; latMax: number; lngMin: number; lngMax: number },
  dateMin: string,
  centerLat: number,
  centerLng: number,
  propertyTypes?: string[]
): Promise<DvfTransaction[]> {
  const url = new URL(DVF_FALLBACK_URL);
  url.searchParams.set("lat", String((bbox.latMin + bbox.latMax) / 2));
  url.searchParams.set("lon", String((bbox.lngMin + bbox.lngMax) / 2));
  url.searchParams.set("dist", String(Math.round(((bbox.latMax - bbox.latMin) * 111) / 2 * 1000)));

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`CQuest API error: ${response.status}`);
  }

  const data = await response.json() as CquestResponse;
  const results = data.resultats ?? [];

  return results
    .filter((r) => new Date(r.date_mutation) >= new Date(dateMin))
    .map((r) => mapCquestResult(r, centerLat, centerLng))
    .filter((t) => filterByPropertyType(t, propertyTypes))
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
}

// ============================================================
// Mapping
// ============================================================

function mapCeremaFeature(
  feature: CeremaFeature,
  centerLat: number,
  centerLng: number
): DvfTransaction {
  const p = feature.properties;
  const coords = feature.geometry?.coordinates;
  const lat = coords ? coords[1] : null;
  const lng = coords ? coords[0] : null;

  const builtArea = p.surface_reelle_bati ?? null;
  const salePrice = p.valeur_fonciere ?? 0;

  return {
    id: p.id_mutation ?? `cerema-${Date.now()}-${Math.random()}`,
    address: [p.numero_voie, p.type_voie, p.nom_voie].filter(Boolean).join(" "),
    city: p.nom_commune ?? "",
    postalCode: p.code_postal ?? "",
    saleDate: p.date_mutation ?? "",
    salePrice,
    builtArea,
    landArea: p.surface_terrain ?? null,
    pricePerSqm: builtArea && builtArea > 0 ? salePrice / builtArea : null,
    propertyType: mapCeremaPropertyType(p.type_local),
    latitude: lat,
    longitude: lng,
    distanceKm: lat && lng ? haversineDistance(centerLat, centerLng, lat, lng) : null,
  };
}

function mapCquestResult(
  result: CquestResult,
  centerLat: number,
  centerLng: number
): DvfTransaction {
  const builtArea = result.surface_reelle_bati ?? null;
  const salePrice = result.valeur_fonciere ?? 0;

  return {
    id: result.id_mutation ?? `cquest-${Date.now()}-${Math.random()}`,
    address: [result.adresse_numero, result.adresse_nom_voie].filter(Boolean).join(" "),
    city: result.nom_commune ?? "",
    postalCode: result.code_postal ?? "",
    saleDate: result.date_mutation ?? "",
    salePrice,
    builtArea,
    landArea: result.surface_terrain ?? null,
    pricePerSqm: builtArea && builtArea > 0 ? salePrice / builtArea : null,
    propertyType: mapCeremaPropertyType(result.type_local),
    latitude: result.latitude ?? null,
    longitude: result.longitude ?? null,
    distanceKm:
      result.latitude && result.longitude
        ? haversineDistance(centerLat, centerLng, result.latitude, result.longitude)
        : null,
  };
}

function mapCeremaPropertyType(typeLocal: string | null | undefined): string {
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

interface CeremaResponse {
  features: CeremaFeature[];
}

interface CeremaFeature {
  properties: {
    id_mutation?: string;
    date_mutation?: string;
    valeur_fonciere?: number;
    numero_voie?: string;
    type_voie?: string;
    nom_voie?: string;
    code_postal?: string;
    nom_commune?: string;
    type_local?: string;
    surface_reelle_bati?: number;
    surface_terrain?: number;
  };
  geometry?: {
    coordinates: [number, number];
  };
}

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
