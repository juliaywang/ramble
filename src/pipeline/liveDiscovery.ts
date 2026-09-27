import { boroughFromPoint, canonicalBorough, distanceMiles, type LatLng } from "./geo";
import type { CategoryId, Discovery, InterestId, PassportCategoryId } from "./types";
import { INTERESTS } from "./types";
import { getSupabaseConfig } from "../lib/supabase";

export const LIVE_ENDPOINT = "https://overpass-api.de/api/interpreter";
export const LIVE_TTL = 30 * 60 * 1000;
export type LiveResult = { places: Discovery[]; fetchedAt: number; cached: boolean; neighborhood?: string };
const cache = new Map<string, LiveResult>();
export type OSMElement = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

export interface RawLiveDiscovery {
  name: string;
  discovery_type: "place" | "event";
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
  source_url: string;
  verified?: boolean;
}

export interface LiveDiscoveryResponse {
  success: boolean;
  neighborhood?: string;
  categories?: string[];
  count?: number;
  discoveries?: RawLiveDiscovery[];
  error?: string;
}

export const NEIGHBORHOOD_CENTERS: Record<string, { lat: number; lng: number }> = {
  "Morningside Heights": { lat: 40.808, lng: -73.964 },
  "Harlem": { lat: 40.811, lng: -73.946 },
  "Upper West Side": { lat: 40.787, lng: -73.975 },
  "Upper East Side": { lat: 40.773, lng: -73.956 },
  "East Village": { lat: 40.726, lng: -73.981 },
  "West Village": { lat: 40.735, lng: -74.003 },
  "Williamsburg": { lat: 40.708, lng: -73.957 },
  "Bushwick": { lat: 40.695, lng: -73.917 },
  "DUMBO": { lat: 40.703, lng: -73.989 },
  "Astoria": { lat: 40.764, lng: -73.923 },
};

export function inferNeighborhood(lat: number, lng: number): string {
  if (lat >= 40.80 && lat <= 40.825 && lng >= -73.972 && lng <= -73.952) return "Morningside Heights";
  if (lat > 40.80 && lat <= 40.835 && lng > -73.955 && lng <= -73.93) return "Harlem";
  if (lat >= 40.77 && lat < 40.805 && lng >= -73.99 && lng <= -73.965) return "Upper West Side";
  if (lat >= 40.76 && lat < 40.79 && lng > -73.965 && lng <= -73.94) return "Upper East Side";
  if (lat >= 40.72 && lat < 40.735 && lng >= -73.99 && lng <= -73.97) return "East Village";
  if (lat >= 40.73 && lat < 40.745 && lng >= -74.015 && lng <= -73.995) return "West Village";
  if (lat >= 40.70 && lat < 40.725 && lng >= -73.97 && lng <= -73.94) return "Williamsburg";
  if (lat >= 40.69 && lat < 40.71 && lng >= -73.94 && lng <= -73.905) return "Bushwick";
  if (lat >= 40.698 && lat <= 40.708 && lng >= -73.998 && lng <= -73.98) return "DUMBO";
  if (lat >= 40.75 && lat <= 40.78 && lng >= -73.94 && lng <= -73.91) return "Astoria";
  return "Morningside Heights";
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

export function mapCategory(categories: string[]): CategoryId {
  const catMap: Record<string, CategoryId> = {
    coffee: "cafe",
    books: "bookstore",
    music: "music",
    art: "public-art",
    food: "food",
    gaming: "gaming",
    history: "historic",
    sustainability: "garden",
    volunteering: "culture",
    culture: "culture",
    technology: "culture",
  };
  for (const c of categories) {
    if (catMap[c]) return catMap[c];
  }
  return "cafe";
}

export function liveDiscoveryToPlace(
  raw: RawLiveDiscovery,
  origin?: LatLng | null
): Discovery {
  const category = mapCategory(raw.categories ?? []);
  const isEvent = raw.discovery_type === "event";

  const tags = (raw.categories ?? []).filter((tag): tag is InterestId =>
    INTERESTS.some((i) => i.id === tag)
  );
  const finalTags: InterestId[] = tags.length ? tags : ["culture"];

  const passportCategory: PassportCategoryId | null = isEvent
    ? "community-event"
    : category === "cafe"
    ? "cafe"
    : category === "bookstore"
    ? "bookstore"
    : category === "historic"
    ? "historic"
    : category === "culture" || category === "music" || category === "public-art"
    ? "cultural"
    : null;

  // Determine coordinates:
  // If raw coordinates are valid NYC floats, use them.
  // Otherwise, use the neighborhood center (or origin) with a deterministic jitter.
  let lat = raw.latitude;
  let lng = raw.longitude;
  const hasExplicitCoords =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 40.45 &&
    lat <= 40.95 &&
    lng >= -74.3 &&
    lng <= -73.65;

  if (!hasExplicitCoords) {
    const hoodCenter = raw.neighborhood ? NEIGHBORHOOD_CENTERS[raw.neighborhood] : null;
    const base = hoodCenter ?? (origin && Number.isFinite(origin.lat) ? origin : { lat: 40.808, lng: -73.964 });
    const hash = Math.abs(hashString(raw.name + (raw.address ?? "")));
    const offsetLat = (((hash % 100) - 50) / 100) * 0.005;
    const offsetLng = ((((hash >> 8) % 100) - 50) / 100) * 0.005;
    lat = Number((base.lat + offsetLat).toFixed(4));
    lng = Number((base.lng + offsetLng).toFixed(4));
  }

  const borough = canonicalBorough(raw.borough) ?? (lat && lng ? boroughFromPoint(lat, lng) : null) ?? "manhattan";

  let hours = "Check venue for current opening hours";
  if (isEvent && raw.start_time) {
    try {
      const start = new Date(raw.start_time);
      if (Number.isFinite(start.getTime())) {
        const dateStr = start.toLocaleDateString("en-US", {
          timeZone: "America/New_York",
          month: "short",
          day: "numeric",
        });
        const timeStr = start.toLocaleTimeString("en-US", {
          timeZone: "America/New_York",
          hour: "numeric",
          minute: "2-digit",
        });
        hours = `${dateStr} · ${timeStr} (NYC time)`;
      }
    } catch {
      hours = raw.start_time;
    }
  }

  const description =
    raw.description?.trim() ||
    (isEvent
      ? `${raw.name} is a live event in ${raw.neighborhood ?? "NYC"}.`
      : `${raw.name} is a local spot in ${raw.neighborhood ?? "NYC"}.`);

  const idSlug = raw.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const idHash = Math.abs(hashString(raw.name + (raw.address ?? raw.source_url ?? "")));

  return {
    id: `live:${idSlug}:${idHash}`,
    name: raw.name,
    category,
    source: "live-discovery",
    sourceDetail: "Tavily · Live Web Discovery",
    sourceUrl: raw.source_url || undefined,
    borough,
    lat: lat!,
    lng: lng!,
    address: raw.address?.trim() || "See details for location",
    hours,
    summary: description,
    about: description,
    tip: isEvent
      ? "Live event discovered via real-time web search. Check details and timing before heading out."
      : "Live place discovered via real-time web search. Check opening hours before visiting.",
    tags: finalTags,
    passportCategory,
    eventStart: isEvent ? raw.start_time ?? undefined : undefined,
    eventEnd: isEvent ? raw.end_time ?? undefined : undefined,
  };
}

export function liveQuery(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 40.45 || lat > 40.95 || lng < -74.3 || lng > -73.65) throw new Error("Live Discovery is currently available in New York City.");
  const around = `(around:1200,${lat.toFixed(3)},${lng.toFixed(3)})`;
  return `[out:json][timeout:20];(nwr["name"]["amenity"~"^(cafe|restaurant|library|arts_centre|theatre|community_centre|marketplace|music_venue)$"]${around};nwr["name"]["shop"~"^(books|games)$"]${around};nwr["name"]["tourism"~"^(museum|gallery)$"]${around};nwr["name"]["leisure"="garden"]${around};);out center tags;`;
}

export function osmDiscovery(element: OSMElement): Discovery | null {
  const t = element.tags ?? {};
  const name = t.name?.trim();
  const lat = element.lat ?? element.center?.lat, lng = element.lon ?? element.center?.lon;
  if (!name || !["node", "way", "relation"].includes(element.type) || !Number.isSafeInteger(element.id) || element.id <= 0 || lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < 40.45 || lat > 40.95 || lng < -74.3 || lng > -73.65 || t.access === "private" || t.disused === "yes" || t.abandoned === "yes") return null;
  let category: CategoryId, tags: InterestId[], passportCategory: PassportCategoryId | null = null;
  if (t.amenity === "cafe") { category = "cafe"; tags = ["coffee", "food"]; passportCategory = "cafe"; }
  else if (t.shop === "books") { category = "bookstore"; tags = ["books", "culture"]; passportCategory = "bookstore"; }
  else if (t.shop === "games") { category = "gaming"; tags = ["gaming"]; }
  else if (t.amenity === "library") { category = "library"; tags = ["books", "culture", "technology"]; }
  else if (t.amenity === "restaurant") { category = "food"; tags = ["food"]; }
  else if (t.amenity === "music_venue") { category = "music"; tags = ["music", "culture"]; }
  else if (t.amenity === "marketplace") { category = "market"; tags = ["food"]; }
  else if (t.tourism === "museum") { category = "museum"; tags = ["culture", "art"]; }
  else if (t.tourism === "gallery") { category = "public-art"; tags = ["art", "culture"]; }
  else if (t.leisure === "garden") { category = "garden"; tags = ["sustainability"]; }
  else if (["arts_centre", "theatre", "community_centre"].includes(t.amenity)) { category = "culture"; tags = ["culture"]; passportCategory = "cultural"; }
  else return null;
  const borough = canonicalBorough(t["addr:borough"]) ?? boroughFromPoint(lat, lng);
  if (!borough) return null;
  const kind = (t.amenity ?? t.shop ?? t.tourism ?? t.leisure ?? "place").replaceAll("_", " ");
  const description = t.description?.trim() || `${name} is listed as a ${kind} on OpenStreetMap.${t.cuisine ? ` Cuisine: ${t.cuisine.replaceAll(";", ", ")}.` : ""}`;
  return { id: `osm-${element.type}-${element.id}`, name, category, tags, passportCategory,
    source: "live-discovery", sourceDetail: "OpenStreetMap · nearby discovery", sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    borough, lat, lng, address: [t["addr:housenumber"], t["addr:street"], t["addr:postcode"]].filter(Boolean).join(" ") || "See map for location",
    hours: t.opening_hours ? `Listed hours: ${t.opening_hours}` : "Check the venue for current opening hours",
    summary: description, about: description, tip: "Community-maintained listing. Check opening hours and access before visiting." };
}

export interface DiscoverNearbyOptions {
  neighborhood?: string;
  categories?: string[];
}

export async function discoverNearby(
  lat: number,
  lng: number,
  signal?: AbortSignal,
  options?: DiscoverNearbyOptions
): Promise<LiveResult> {
  const neighborhood = options?.neighborhood ?? inferNeighborhood(lat, lng);
  const categories = options?.categories && options.categories.length > 0
    ? options.categories
    : ["coffee", "books", "culture"];

  const key = `${neighborhood}::${categories.slice().sort().join(",")}::${lat.toFixed(3)},${lng.toFixed(3)}`;
  const saved = cache.get(key);
  if (saved && Date.now() - saved.fetchedAt < LIVE_TTL) return { ...saved, cached: true };

  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, 25000);

  try {
    const config = getSupabaseConfig();
    const canUseEdgeFunction = config.isConfigured && import.meta.env.MODE !== "test";

    if (canUseEdgeFunction) {
      const edgeUrl = `${config.url}/functions/v1/live-discovery`;
      const response = await fetch(edgeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": config.anonKey,
          "Authorization": `Bearer ${config.anonKey}`,
        },
        body: JSON.stringify({
          neighborhood,
          categories,
          latitude: lat,
          longitude: lng,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || "Live discovery service is temporarily unavailable.");
      }

      const data = await response.json() as LiveDiscoveryResponse;
      if (Array.isArray(data.discoveries)) {
        const origin = { lat, lng };
        const places = data.discoveries.map((raw) => liveDiscoveryToPlace(raw, origin));
        const result: LiveResult = { places, fetchedAt: Date.now(), cached: false, neighborhood };
        if (cache.size >= 10) cache.delete(cache.keys().next().value!);
        cache.set(key, result);
        return result;
      }
    }

    // Fallback or Test Mode (OSM / Mocked Fetch)
    const query = liveQuery(lat, lng);
    const url = new URL(LIVE_ENDPOINT);
    url.searchParams.set("data", query);
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("Nearby search is busy. Please try again in a moment.");
    const data = await response.json() as { elements?: OSMElement[]; discoveries?: RawLiveDiscovery[]; remark?: string };

    // Support both OSM elements and Mocked Edge Function discoveries in test mode
    if (Array.isArray(data.discoveries)) {
      const origin = { lat, lng };
      const places = data.discoveries.map((raw) => liveDiscoveryToPlace(raw, origin));
      const result: LiveResult = { places, fetchedAt: Date.now(), cached: false, neighborhood };
      if (cache.size >= 10) cache.delete(cache.keys().next().value!);
      cache.set(key, result);
      return result;
    }

    if (data.remark || !Array.isArray(data.elements)) throw new Error("Nearby search returned an incomplete response. Please try again.");
    const unique = new Map<string, Discovery>();
    const origin = { lat, lng };
    for (const element of data.elements) {
      const place = osmDiscovery(element);
      if (place && distanceMiles(origin, place) <= 0.8) unique.set(place.id, place);
    }
    const sorted = [...unique.values()].sort((a, b) => distanceMiles(origin, a) - distanceMiles(origin, b));
    const places: Discovery[] = [];
    for (const place of sorted) {
      if (!places.some(p => p.name.toLowerCase() === place.name.toLowerCase() && distanceMiles(p, place) < 0.04)) places.push(place);
      if (places.length === 200) break;
    }
    const result = { places, fetchedAt: Date.now(), cached: false, neighborhood };
    if (cache.size >= 10) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
    return result;
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(error instanceof Error && error.name !== "AbortError" ? error.message : "Nearby search timed out. Please try again.");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

export function mergeLivePlaces(base: Discovery[], live: Discovery[]) {
  const byId = new Map(base.map(p => [p.id, p]));
  const names = new Map<string, Discovery[]>();
  const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const p of base) names.set(key(p.name), [...(names.get(key(p.name)) ?? []), p]);
  for (const place of live) {
    const match = names.get(key(place.name))?.find(p => !p.eventEnd && distanceMiles(p, place) < 0.06);
    if (match?.source === "nyc-open-data") continue;
    byId.set(match?.id ?? place.id, { ...place, id: match?.id ?? place.id });
  }
  return [...byId.values()];
}
