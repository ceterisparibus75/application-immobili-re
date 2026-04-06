import type { DvfTransaction, DvfSearchParams } from "./types";

/**
 * Recherche DVF multi-sources.
 * Essaie plusieurs APIs publiques DVF dans l'ordre :
 * 1. API DVF data.gouv.fr (Etalab)
 * 2. API DVF CEREMA
 * 3. API cquest (fallback, par lat/lon)
 */
const GEO_API_URL = "https://geo.api.gouv.fr";

export async function searchDvfTransactions(
  params: DvfSearchParams
): Promise<DvfTransaction[]> {
  const { postalCode, city, latitude, longitude, periodYears, propertyTypes } = params;

  try {
    // 1. Résoudre le code INSEE et les coordonnées de la commune
    const commune = await getCommuneInfo(postalCode, city);
    if (!commune) {
      console.error("[DVF] Commune introuvable pour", postalCode, city);
      return [];
    }

    const centerLat = latitude ?? commune.lat;
    const centerLng = longitude ?? commune.lon;

    const dateMin = new Date();
    dateMin.setFullYear(dateMin.getFullYear() - periodYears);
    const dateMinStr = dateMin.toISOString().split("T")[0];

    // 2. Essayer les APIs DVF dans l'ordre
    let transactions: DvfTransaction[] = [];

    // Tentative 1: API Etalab DVF
    try {
      transactions = await fetchFromEtalab(commune.code, dateMinStr, centerLat, centerLng);
    } catch (e) {
      console.error("[DVF] Etalab failed:", e);
    }

    // Tentative 2: API CEREMA si Etalab n'a rien retourné
    if (transactions.length === 0 && centerLat && centerLng) {
      try {
        transactions = await fetchFromCerema(centerLat, centerLng, 5, dateMinStr);
      } catch (e) {
        console.error("[DVF] CEREMA failed:", e);
      }
    }

    // Tentative 3: API cquest si toujours rien
    if (transactions.length === 0 && centerLat && centerLng) {
      try {
        transactions = await fetchFromCquest(centerLat, centerLng, 5000, dateMinStr);
      } catch (e) {
        console.error("[DVF] cquest failed:", e);
      }
    }

    // 3. Filtrer et trier
    return transactions
      .filter((t) => filterByPropertyType(t, propertyTypes))
      .filter((t) => t.salePrice > 0)
      .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())
      .slice(0, 100);
  } catch (error) {
    console.error("[DVF] Erreur recherche:", error);
    return [];
  }
}

// ============================================================
// Résolution commune
// ============================================================

async function getCommuneInfo(
  postalCode: string,
  city: string
): Promise<{ code: string; nom: string; lat: number | null; lon: number | null } | null> {
  try {
    const url = `${GEO_API_URL}/communes?codePostal=${postalCode}&fields=nom,code,centre&limit=10`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) return null;

    const communes = await response.json() as Array<{
      nom: string;
      code: string;
      centre?: { coordinates: [number, number] };
    }>;
    if (communes.length === 0) return null;

    const normalized = city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const match = communes.find((c) => {
      const n = c.nom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return n.includes(normalized) || normalized.includes(n);
    });

    const selected = match ?? communes[0];
    return {
      code: selected.code,
      nom: selected.nom,
      lat: selected.centre?.coordinates[1] ?? null,
      lon: selected.centre?.coordinates[0] ?? null,
    };
  } catch {
    return null;
  }
}

// ============================================================
// API 1: Etalab DVF (data.gouv.fr)
// ============================================================

async function fetchFromEtalab(
  codeInsee: string,
  dateMin: string,
  centerLat: number | null,
  centerLng: number | null
): Promise<DvfTransaction[]> {
  // L'API Etalab retourne les mutations par code commune
  const url = `https://app.dvf.etalab.gouv.fr/api/mutations?code_commune=${codeInsee}`;

  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Etalab API: ${response.status}`);

  const data = await response.json();
  const mutations = Array.isArray(data) ? data : (data.mutations ?? data.resultats ?? []);

  return mutations
    .filter((m: Record<string, unknown>) => {
      const date = String(m.date_mutation ?? "");
      return date >= dateMin && (m.nature_mutation === "Vente" || !m.nature_mutation);
    })
    .map((m: Record<string, unknown>) => mapGenericMutation(m, centerLat, centerLng));
}

// ============================================================
// API 2: CEREMA (bbox)
// ============================================================

async function fetchFromCerema(
  lat: number,
  lng: number,
  radiusKm: number,
  dateMin: string
): Promise<DvfTransaction[]> {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const url = new URL("https://apidf-preprod.cerema.fr/dvf/geomutations/");
  url.searchParams.set("in_bbox", `${lng - lngDelta},${lat - latDelta},${lng + lngDelta},${lat + latDelta}`);
  url.searchParams.set("date_mutation_min", dateMin);
  url.searchParams.set("nature_mutation", "Vente");
  url.searchParams.set("page_size", "100");

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`CEREMA API: ${response.status}`);

  const data = await response.json() as { features?: Array<{ properties: Record<string, unknown>; geometry?: { coordinates: [number, number] } }> };
  const features = data.features ?? [];

  return features.map((f) => {
    const p = f.properties;
    const coords = f.geometry?.coordinates;
    return mapGenericMutation(
      {
        ...p,
        latitude: coords ? coords[1] : null,
        longitude: coords ? coords[0] : null,
      },
      lat,
      lng
    );
  });
}

// ============================================================
// API 3: cquest (fallback, par lat/lon/dist)
// ============================================================

async function fetchFromCquest(
  lat: number,
  lng: number,
  distMeters: number,
  dateMin: string
): Promise<DvfTransaction[]> {
  const url = `https://api.cquest.org/dvf?lat=${lat}&lon=${lng}&dist=${distMeters}`;

  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`cquest API: ${response.status}`);

  const data = await response.json() as { resultats?: Array<Record<string, unknown>> };
  const results = data.resultats ?? [];

  return results
    .filter((r) => String(r.date_mutation ?? "") >= dateMin)
    .map((r) => mapGenericMutation(r, lat, lng));
}

// ============================================================
// Mapping générique
// ============================================================

function mapGenericMutation(
  m: Record<string, unknown>,
  centerLat: number | null,
  centerLng: number | null
): DvfTransaction {
  const builtArea = toNumber(m.surface_reelle_bati);
  const salePrice = toNumber(m.valeur_fonciere) ?? 0;
  const lat = toNumber(m.latitude);
  const lng = toNumber(m.longitude);

  const address = [m.adresse_numero ?? m.numero_voie, m.adresse_suffixe, m.adresse_nom_voie ?? m.type_voie ? `${m.type_voie ?? ""} ${m.nom_voie ?? ""}` : m.nom_voie]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    id: String(m.id_mutation ?? `dvf-${Date.now()}-${Math.random()}`),
    address: address || "Adresse non renseignée",
    city: String(m.nom_commune ?? ""),
    postalCode: String(m.code_postal ?? ""),
    saleDate: String(m.date_mutation ?? ""),
    salePrice,
    builtArea,
    landArea: toNumber(m.surface_terrain),
    pricePerSqm: builtArea && builtArea > 0 ? Math.round(salePrice / builtArea) : null,
    propertyType: mapPropertyType(String(m.type_local ?? "")),
    latitude: lat,
    longitude: lng,
    distanceKm:
      lat && lng && centerLat && centerLng
        ? haversineDistance(centerLat, centerLng, lat, lng)
        : null,
  };
}

function toNumber(val: unknown): number | null {
  if (val == null) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function mapPropertyType(typeLocal: string): string {
  if (typeLocal.includes("Maison") || typeLocal.includes("Appartement")) return "HABITATION";
  if (typeLocal.includes("Local") || typeLocal.includes("commercial") || typeLocal.includes("industriel")) return "COMMERCIAL";
  return "MIXTE";
}

function filterByPropertyType(t: DvfTransaction, types?: string[]): boolean {
  if (!types || types.length === 0) return true;
  return types.includes(t.propertyType);
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
}
