import { gunzipSync } from "zlib";
import Papa from "papaparse";
import type { DvfTransaction, DvfSearchParams } from "./types";

/**
 * Recherche DVF via les fichiers CSV officiels data.gouv.fr (geo-dvf).
 * Source fiable et toujours disponible : https://files.data.gouv.fr/geo-dvf/
 *
 * Workflow :
 * 1. Résout le code INSEE et les coordonnées via geo.api.gouv.fr
 * 2. Télécharge le CSV gzippé du département depuis data.gouv.fr
 * 3. Parse et filtre par code commune
 */
const GEO_API_URL = "https://geo.api.gouv.fr";
const DVF_CSV_BASE = "https://files.data.gouv.fr/geo-dvf/latest/csv";

export async function searchDvfTransactions(
  params: DvfSearchParams
): Promise<DvfTransaction[]> {
  const { postalCode, city, latitude, longitude, periodYears, propertyTypes } = params;

  try {
    // 1. Résoudre la commune
    const commune = await getCommuneInfo(postalCode, city);
    if (!commune) {
      console.error("[DVF] Commune introuvable pour", postalCode, city);
      return [];
    }

    const centerLat = latitude ?? commune.lat;
    const centerLng = longitude ?? commune.lon;
    const dept = commune.code.substring(0, 2);

    // 2. Télécharger les CSV DVF pour chaque année
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - periodYears;
    const allTransactions: DvfTransaction[] = [];

    // Les données DVF sont disponibles avec ~6 mois de retard
    // On cherche les 3 dernières années de données disponibles
    for (let year = Math.max(startYear, 2020); year <= currentYear; year++) {
      try {
        const yearTransactions = await fetchDvfCsv(dept, year, commune.code, centerLat, centerLng);
        allTransactions.push(...yearTransactions);
      } catch (error) {
        // L'année peut ne pas être encore disponible
        console.error(`[DVF] Année ${year} non disponible:`, error instanceof Error ? error.message : error);
      }
    }

    // 3. Filtrer et trier
    return allTransactions
      .filter((t) => filterByPropertyType(t, propertyTypes))
      .filter((t) => t.salePrice > 0 && t.salePrice < 100_000_000) // Exclure les aberrations
      .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())
      .slice(0, 100);
  } catch (error) {
    console.error("[DVF] Erreur recherche:", error);
    return [];
  }
}

// ============================================================
// Résolution commune via geo.api.gouv.fr
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
// Téléchargement et parsing CSV data.gouv.fr
// ============================================================

async function fetchDvfCsv(
  dept: string,
  year: number,
  codeCommune: string,
  centerLat: number | null,
  centerLng: number | null
): Promise<DvfTransaction[]> {
  const url = `${DVF_CSV_BASE}/${year}/departements/${dept}.csv.gz`;

  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    throw new Error(`data.gouv.fr ${response.status} pour ${url}`);
  }

  const gzBuffer = Buffer.from(await response.arrayBuffer());
  const csvBuffer = gunzipSync(gzBuffer);
  const csvText = csvBuffer.toString("utf-8");

  // Parser le CSV
  const parsed = Papa.parse<DvfCsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  // Filtrer par code commune et type de mutation "Vente"
  return parsed.data
    .filter((row) => row.code_commune === codeCommune && row.nature_mutation === "Vente")
    .map((row) => mapCsvRow(row, centerLat, centerLng));
}

// ============================================================
// Mapping CSV → DvfTransaction
// ============================================================

interface DvfCsvRow {
  id_mutation?: string;
  date_mutation?: string;
  nature_mutation?: string;
  valeur_fonciere?: string;
  adresse_numero?: string;
  adresse_suffixe?: string;
  adresse_nom_voie?: string;
  code_postal?: string;
  nom_commune?: string;
  code_commune?: string;
  type_local?: string;
  surface_reelle_bati?: string;
  nombre_pieces_principales?: string;
  surface_terrain?: string;
  longitude?: string;
  latitude?: string;
}

function mapCsvRow(row: DvfCsvRow, centerLat: number | null, centerLng: number | null): DvfTransaction {
  const salePrice = parseFloat(row.valeur_fonciere?.replace(",", ".") ?? "0") || 0;
  const builtArea = parseFloat(row.surface_reelle_bati ?? "") || null;
  const lat = parseFloat(row.latitude ?? "") || null;
  const lng = parseFloat(row.longitude ?? "") || null;

  return {
    id: row.id_mutation ?? `dvf-${Date.now()}-${Math.random()}`,
    address: [row.adresse_numero, row.adresse_suffixe, row.adresse_nom_voie].filter(Boolean).join(" ").trim() || "Adresse non renseignée",
    city: row.nom_commune ?? "",
    postalCode: row.code_postal ?? "",
    saleDate: row.date_mutation ?? "",
    salePrice,
    builtArea,
    landArea: parseFloat(row.surface_terrain ?? "") || null,
    pricePerSqm: builtArea && builtArea > 0 ? Math.round(salePrice / builtArea) : null,
    propertyType: mapPropertyType(row.type_local ?? ""),
    latitude: lat,
    longitude: lng,
    distanceKm:
      lat && lng && centerLat && centerLng
        ? haversineDistance(centerLat, centerLng, lat, lng)
        : null,
  };
}

// ============================================================
// Helpers
// ============================================================

function mapPropertyType(typeLocal: string): string {
  if (typeLocal.includes("Maison") || typeLocal.includes("Appartement")) return "HABITATION";
  if (typeLocal.includes("Local") || typeLocal.includes("commercial") || typeLocal.includes("industriel")) return "COMMERCIAL";
  if (typeLocal.includes("Dépendance")) return "DEPENDANCE";
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
