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
    // Départements DOM-TOM ont des codes à 3 chiffres (971, 972…)
    const dept = commune.code.length >= 5 ? commune.code.substring(0, commune.code.length - 3) : commune.code.substring(0, 2);

    // 2. Télécharger les CSV DVF en parallèle pour chaque année
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - periodYears;
    // Les données DVF ont ~6 mois de retard : année courante jamais disponible
    const maxYear = currentYear - 1;
    const years = [];
    for (let y = Math.max(startYear, 2020); y <= maxYear; y++) years.push(y);

    const results = await Promise.allSettled(
      years.map((year) => fetchDvfCsv(dept, year, commune.code, postalCode, centerLat, centerLng))
    );

    const allTransactions: DvfTransaction[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") allTransactions.push(...result.value);
      else console.error("[DVF] Année non disponible:", result.reason instanceof Error ? result.reason.message : result.reason);
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
  postalCode: string,
  centerLat: number | null,
  centerLng: number | null
): Promise<DvfTransaction[]> {
  const url = `${DVF_CSV_BASE}/${year}/departements/${dept}.csv.gz`;

  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) {
    throw new Error(`data.gouv.fr ${response.status} pour ${url}`);
  }

  const gzBuffer = Buffer.from(await response.arrayBuffer());
  const csvBuffer = gunzipSync(gzBuffer);
  const csvText = csvBuffer.toString("utf-8");

  const parsed = Papa.parse<DvfCsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const codesToMatch = new Set(getCodeCommunes(codeCommune, postalCode));
  return parsed.data
    .filter((row) => codesToMatch.has(row.code_commune ?? "") && row.nature_mutation === "Vente")
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

/**
 * Paris, Lyon, Marseille ont des arrondissements avec leurs propres codes INSEE dans le DVF.
 * Le code renvoyé par geo.api.gouv.fr est le code ville (75056/69123/13055) mais le DVF
 * stocke le code arrondissement (75101–75120 / 69381–69389 / 13201–13216).
 * On utilise le code postal de l'immeuble pour cibler le bon arrondissement.
 */
function getCodeCommunes(codeCommune: string, postalCode?: string): string[] {
  if (codeCommune === "75056") {
    // Paris : 75001→75101, 75008→75108, 75020→75120
    if (postalCode && /^750\d{2}$/.test(postalCode)) {
      return [`751${postalCode.slice(3)}`];
    }
    return Array.from({ length: 20 }, (_, i) => `751${String(i + 1).padStart(2, "0")}`);
  }
  if (codeCommune === "69123") {
    // Lyon : 69001→69381, 69002→69382, …, 69009→69389
    if (postalCode && /^690\d{2}$/.test(postalCode)) {
      const n = parseInt(postalCode.slice(3), 10);
      if (n >= 1 && n <= 9) return [String(69380 + n)];
    }
    return Array.from({ length: 9 }, (_, i) => String(69381 + i));
  }
  if (codeCommune === "13055") {
    // Marseille : 13001→13201, 13016→13216
    if (postalCode && /^130\d{2}$/.test(postalCode)) {
      return [`132${postalCode.slice(3)}`];
    }
    return Array.from({ length: 16 }, (_, i) => `132${String(i + 1).padStart(2, "0")}`);
  }
  return [codeCommune];
}

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
