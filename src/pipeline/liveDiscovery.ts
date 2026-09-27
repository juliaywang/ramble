import { boroughFromPoint, canonicalBorough, distanceMiles } from "./geo";
import type { CategoryId, Discovery, InterestId, PassportCategoryId } from "./types";

export const LIVE_ENDPOINT = "https://overpass-api.de/api/interpreter";
export const LIVE_TTL = 30 * 60 * 1000;
export type LiveResult = { places: Discovery[]; fetchedAt: number; cached: boolean };
const cache = new Map<string, LiveResult>();
export type OSMElement = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

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

export async function discoverNearby(lat: number, lng: number, signal?: AbortSignal): Promise<LiveResult> {
  const query = liveQuery(lat, lng);
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const saved = cache.get(key);
  if (saved && Date.now() - saved.fetchedAt < LIVE_TTL) return { ...saved, cached: true };
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, 25000);
  try {
    const url = new URL(LIVE_ENDPOINT);
    url.searchParams.set("data", query);
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("Nearby search is busy. Please try again in a moment.");
    const data = await response.json() as { elements?: OSMElement[]; remark?: string };
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
    const result = { places, fetchedAt: Date.now(), cached: false };
    if (cache.size >= 10) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
    return result;
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(error instanceof Error && error.name !== "AbortError" ? error.message : "Nearby search timed out. Please try again.");
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); }
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
