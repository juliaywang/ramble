import { getSupabaseClient } from "../lib/supabase";
import { boroughFromPoint, canonicalBorough, distanceMiles } from "./geo";
import { INTERESTS, type CategoryId, type Discovery, type InterestId } from "./types";

export const SYNCED_SOURCES = ["NYC Parks", "NYC Public Art", "NYC GreenThumb Gardens", "NYC Cultural Organizations", "NYC Libraries", "NYC Farmers Markets", "NYC Restaurants", "NYC POPS"];
export type SyncedRow = {
  source: string; external_id: string; name: string; discovery_type: string;
  categories: string[] | null; description: string | null; address: string | null;
  neighborhood: string | null; borough: string | null; latitude: number | string | null;
  longitude: number | string | null; start_time: string | null; end_time: string | null;
  source_url: string | null; last_synced_at: string | null;
};
function text(value: unknown): string {
  const clean = typeof value === "string" ? value.trim() : "";
  return clean.toUpperCase() === "NULL" ? "" : clean;
}
function plain(value: unknown) {
  return text(value).replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
export function syncedPlace(row: SyncedRow, now = Date.now()): Discovery | null {
  const name = plain(row.name);
  if (!name || !text(row.external_id) || !SYNCED_SOURCES.includes(row.source)) return null;
  if (row.latitude === null || row.longitude === null || String(row.latitude).trim() === "" || String(row.longitude).trim() === "") return null;
  const lat = Number(row.latitude), lng = Number(row.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 40.45 || lat > 40.95 || lng < -74.3 || lng > -73.65) return null;
  const borough = canonicalBorough(row.borough) ?? boroughFromPoint(lat, lng);
  if (!borough) return null;
  const event = row.discovery_type === "event";
  if (!event && row.discovery_type !== "place") return null;
  if (event && (!row.end_time || !Number.isFinite(Date.parse(row.end_time)) || Date.parse(row.end_time) <= now)) return null;
  const tags = (row.categories ?? []).filter((tag): tag is InterestId => INTERESTS.some(i => i.id === tag));
  const categories: Record<string, CategoryId> = {
    "NYC Public Art": "public-art", "NYC GreenThumb Gardens": "garden", "NYC Cultural Organizations": "culture",
    "NYC Libraries": "library", "NYC Farmers Markets": "farmers-market", "NYC Restaurants": tags.includes("coffee") ? "cafe" : "food", "NYC POPS": "park",
  };
  const category = event ? tags.includes("music") ? "music" : tags.includes("art") ? "public-art" : tags.includes("food") ? "food" : "culture" : categories[row.source] ?? "culture";
  const description = plain(row.description) || `${name} · ${row.source}`;
  const eventTime = event && row.start_time ? new Date(row.start_time) : null;
  const hours = eventTime && Number.isFinite(eventTime.getTime())
    ? eventTime.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " (New York time)"
    : "Check the venue for current opening hours";
  return {
    id: `synced:${encodeURIComponent(row.source)}:${encodeURIComponent(row.external_id)}`,
    name, category, source: "nyc-open-data", sourceDetail: row.source,
    borough, lat, lng, address: plain(row.address) || "See map for location", hours,
    summary: description, about: description, tip: event ? "Check the event listing for attendance details before heading out." : "Check current access and opening hours before visiting.",
    tags: tags.length ? tags : ["culture"],
    passportCategory: event ? "community-event" : category === "farmers-market" ? "farmers-market" : category === "cafe" ? "cafe" : category === "culture" ? "cultural" : null,
    eventStart: event ? row.start_time ?? undefined : undefined,
    eventEnd: event ? row.end_time ?? undefined : undefined,
    sourceUrl: /^https?:\/\//i.test(row.source_url ?? "") ? row.source_url! : undefined,
  };
}

// Reuse existing IDs only for same-name nearby places, preserving saved quests/stamps.
export function preservePlaceIds(places: Discovery[], existing: Discovery[]): Discovery[] {
  const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const names = new Map<string, Discovery[]>();
  for (const place of existing) names.set(key(place.name), [...(names.get(key(place.name)) ?? []), place]);
  const used = new Set<string>();
  return places.map(place => {
    if (place.eventEnd) return place;
    const match = names.get(key(place.name))?.find(old => !used.has(old.id) && distanceMiles(place, old) < 0.06);
    if (!match) return place;
    used.add(match.id);
    return { ...place, id: match.id };
  });
}

export async function loadSyncedDiscoveries(signal?: AbortSignal) {
  const client = getSupabaseClient();
  if (!client) return null;
  const rows: SyncedRow[] = [];
  const columns = "source,external_id,name,discovery_type,categories,description,address,neighborhood,borough,latitude,longitude,start_time,end_time,source_url,last_synced_at";
  for (let offset = 0; ; offset += 1000) {
    let query = client.from("discoveries").select(columns).in("source", SYNCED_SOURCES)
      .order("source").order("external_id").range(offset, offset + 999);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw new Error(`Couldn't load synced discoveries: ${error.message}`);
    const page = (data ?? []) as SyncedRow[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  const places = rows.map(row => syncedPlace(row)).filter((p): p is Discovery => p !== null);
  return { places: [...new Map(places.map(p => [p.id, p])).values()], fetched: rows.length,
    unmapped: rows.filter(r => r.latitude === null || r.longitude === null).length };
}
