export type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
export type NYCRow = Record<string, any>;
export type DiscoveryRow = {
  external_id: string;
  name: string;
  discovery_type: string;
  categories: string[];
  description: string | null;
  address: string | null;
  neighborhood: string | null;
  borough: string | null;
  latitude: number | null;
  longitude: number | null;
  start_time: string | null;
  end_time: string | null;
  source: string;
  source_url: string | null;
  last_synced_at: string;
};

export function cleanNYCValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return !text || text.toUpperCase() === "NULL" ? null : text;
}

export function joinValues(values: unknown[], separator = ", "): string | null {
  return values.map(cleanNYCValue).filter(Boolean).join(separator) || null;
}

export function numeric(value: unknown): number | null {
  const text = cleanNYCValue(value);
  if (text === null) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function nycCoordinates(lat: unknown, lng: unknown) {
  const latitude = numeric(lat);
  const longitude = numeric(lng);
  // Broad NYC bounds also reject placeholder 0,0 and swapped/projected coordinates.
  if (latitude === null || longitude === null || latitude < 40.45 || latitude > 40.95 || longitude < -74.3 || longitude > -73.65) return null;
  return { latitude, longitude };
}

export function boroughName(value: unknown): string | null {
  const text = cleanNYCValue(value);
  if (!text) return null;
  const names: Record<string, string> = {
    "1": "Manhattan", M: "Manhattan", MANHATTAN: "Manhattan",
    "2": "Bronx", X: "Bronx", BRONX: "Bronx",
    "3": "Brooklyn", B: "Brooklyn", K: "Brooklyn", BROOKLYN: "Brooklyn",
    "4": "Queens", Q: "Queens", QUEENS: "Queens",
    "5": "Staten Island", R: "Staten Island", S: "Staten Island", "STATEN ISLAND": "Staten Island",
  };
  return names[text.toUpperCase()] ?? null;
}

// Tuple encoding retains punctuation and field boundaries, avoiding slug collisions.
// Deliberately excludes changing fields such as hours, year, and coordinates.
export function deterministicId(prefix: string, parts: unknown[]): string {
  return `${prefix}:${JSON.stringify(parts.map(v => (cleanNYCValue(v) ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ")))}`;
}

export async function fetchSocrata(dataset: string, source: string, query: Record<string, string> = {}, pageSize = 1000): Promise<NYCRow[]> {
  const rows: NYCRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`https://data.cityofnewyork.us/resource/${dataset}.json`);
    const params = { "$order": ":id", ...query, "$limit": String(pageSize), "$offset": String(offset) };
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      const page = await response.json();
      if (!Array.isArray(page)) throw new Error("Expected a Socrata array response");
      rows.push(...page);
      if (page.length < pageSize) return rows;
    } catch (error) {
      throw new Error(`${source} API (${dataset}), offset ${offset}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// First row wins; dataset-specific ordering determines which version is preferred.
export function deduplicate(rows: DiscoveryRow[]): DiscoveryRow[] {
  const seen = new Map<string, DiscoveryRow>();
  for (const row of rows) {
    const key = JSON.stringify([row.source, row.external_id]);
    if (!seen.has(key)) seen.set(key, row);
  }
  return [...seen.values()];
}

export async function upsertDiscoveries(supabase: SupabaseClient, source: string, rows: DiscoveryRow[]) {
  const unique = deduplicate(rows);
  for (let offset = 0; offset < unique.length; offset += 500) {
    try {
      const { error } = await supabase.from("discoveries").upsert(unique.slice(offset, offset + 500), { onConflict: "source,external_id" });
      if (error) throw new Error(error.message);
    } catch (error) {
      throw new Error(`${source} database error, batch ${offset / 500 + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return unique.length;
}
