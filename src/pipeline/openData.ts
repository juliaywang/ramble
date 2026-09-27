import { BOUNDS, boroughFromPoint, boroughName, canonicalBorough, type BoroughId } from "./geo";
import type { CategoryId, Discovery, InterestId, PassportCategoryId } from "./types";
import artJson from "./raw/art.json";
import facilitiesJson from "./raw/facilities.json";
import gardensJson from "./raw/gardens.json";
import marketsJson from "./raw/markets.json";

/** NYC Open Data SODA endpoints, queried across all five boroughs. Landmarks are not included. */
export const NYC_OPEN_DATA = {
  markets: "https://data.cityofnewyork.us/resource/8vwk-6iz2.json",
  art: "https://data.cityofnewyork.us/resource/2pg3-gcaa.json",
  gardens: "https://data.cityofnewyork.us/resource/p78i-pat6.json",
  facilities: "https://data.cityofnewyork.us/resource/ji82-xba5.json",
} as const;

const SOURCE = {
  markets: "NYC Open Data · Farmers Markets",
  art: "NYC Open Data · Public art",
  gardens: "NYC Open Data · GreenThumb community gardens",
  facilities: "NYC Open Data · Libraries, museums, and community centers",
} as const;

type Dataset = keyof typeof NYC_OPEN_DATA;
type Row = Record<string, string | null | undefined>;

export type OpenDataBundle = Record<Dataset, Row[]>;

const BOX = `latitude::number > ${BOUNDS.south} AND latitude::number < ${BOUNDS.north} AND longitude::number > ${BOUNDS.west} AND longitude::number < ${BOUNDS.east}`;

const QUERIES: Record<Dataset, Record<string, string>> = {
  markets: {
    $select:
      "year,marketname,streetaddress,borough,daysoperation,hoursoperations,latitude,longitude,open_year_round,accepts_ebt",
    $where: BOX,
    $order: "year DESC",
    $limit: "5000",
  },
  art: {
    $select:
      "title,primary_artist_first,primary_artist_last,artwork_type1,material,location_name,address,date_created,date_dedicated,latitude,longitude,borough",
    // A few longitude values are not numeric. Casting the column fails the whole query, so bounds are applied after download.
    $limit: "5000",
  },
  gardens: {
    $where: `lat::number > ${BOUNDS.south} AND lat::number < ${BOUNDS.north} AND lon::number > ${BOUNDS.west} AND lon::number < ${BOUNDS.east} AND upper(status) = 'ACTIVE'`,
    $limit: "2000",
  },
  facilities: {
    $select: "facname,address,factype,facgroup,facsubgrp,opname,boro,latitude,longitude",
    $where: `${BOX} AND (upper(facsubgrp) like '%LIBRAR%' OR upper(factype) like '%LIBRAR%' OR upper(facsubgrp) like '%MUSEUM%' OR upper(factype) like '%MUSEUM%' OR upper(facsubgrp) like '%COMMUNITY CENTER%' OR upper(factype) like '%COMMUNITY CENTER%')`,
    $limit: "5000",
  },
};

const ACRONYMS: Record<string, string> = {
  nycha: "NYCHA",
  nyc: "NYC",
  nypl: "NYPL",
  ebt: "EBT",
  "p.s.": "P.S.",
};

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

export function snapshotBundle(): OpenDataBundle {
  return {
    markets: asRows(marketsJson),
    art: asRows(artJson),
    gardens: asRows(gardensJson),
    facilities: asRows(facilitiesJson),
  };
}

/** Stable ids so handcrafted quests and the starter passport survive the city feed. */
export function stableId(name: string): string | null {
  const n = name.toLowerCase().replace(/['’]/g, "");
  if (n.includes("columbia") && n.includes("greenmarket")) return "greenmarket";
  if (n.includes("gatehouse garden")) return "gatehouse";
  if (n.includes("morningside heights library")) return "nypl";
  if (n.includes("roerich")) return "roerich";
  return null;
}

function applyStableId(dataset: Dataset, name: string): string | null {
  const id = stableId(name);
  if (!id) return null;
  if (dataset === "markets" && id === "greenmarket") return id;
  if (dataset === "gardens" && id === "gatehouse") return id;
  if (dataset === "facilities" && (id === "nypl" || id === "roerich")) return id;
  return null;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function placeId(dataset: Dataset, name: string, extra: string) {
  return applyStableId(dataset, name) ?? `nyc-${dataset}-${slug(name)}-${slug(extra)}`.replace(/-+$/g, "");
}

function tidy(raw: string) {
  let value = raw.replace(/\s+/g, " ").trim().replace(/,\s*$/, "").replace(/,\s*inc\.?$/i, "").trim();
  const letters = value.replace(/[^A-Za-z]/g, "");
  if (!letters || value.replace(/[^A-Z]/g, "").length / letters.length < 0.6) return value;
  const small = new Set(["of", "the", "and", "at", "a", "for", "de"]);
  return value
    .split(" ")
    .map((word, index) => {
      const lower = word.toLowerCase();
      const acronym = ACRONYMS[lower.replace(/\.$/, "")] ?? ACRONYMS[lower];
      if (acronym) return acronym;
      if (index > 0 && small.has(lower.replace(/[^a-z]/g, ""))) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function text(value: string | null | undefined) {
  const cleaned = (value ?? "").trim();
  if (!cleaned || cleaned.toUpperCase() === "NULL") return "";
  return cleaned;
}

function coord(value: string | null | undefined) {
  const match = (value ?? "").match(/-?\d+(?:\.\d+)?/);
  const n = Number(match?.[0] ?? value);
  return Number.isFinite(n) ? n : null;
}

function inBounds(lat: number, lng: number) {
  return lat > BOUNDS.south && lat < BOUNDS.north && lng > BOUNDS.west && lng < BOUNDS.east;
}

function resolveBorough(raw: string | null | undefined, lat: number, lng: number): BoroughId | null {
  return canonicalBorough(raw) ?? boroughFromPoint(lat, lng);
}

function marketKey(name: string) {
  const n = name.toLowerCase();
  if (n.includes("columbia") && n.includes("green")) return "columbia-greenmarket";
  if (n.includes("down to earth") || (n.includes("morningside") && n.includes("market"))) return "down-to-earth";
  if (n.includes("soul")) return "soul-to-soul";
  if (n.includes("adam clayton") || n.includes("community farmers")) return "community-farmers-acp";
  return slug(name);
}

function artistName(row: Row) {
  const parts = [text(row.primary_artist_first), text(row.primary_artist_last)].filter(Boolean);
  return parts.length ? parts.join(" ") : "";
}

function cleanHour(value: string) {
  return value.replace(/::/g, ":").replace(/\.\./g, ".").replace(/\s+/g, " ").trim();
}

function gardenHours(row: Row) {
  const days: [string, string][] = [
    ["Mon", text(row.openhrsm)],
    ["Tue", text(row.openhrstu)],
    ["Wed", text(row.openhrsw)],
    ["Thu", text(row.openhrsth)],
    ["Fri", text(row.openhrsf)],
    ["Sat", text(row.openhrssa)],
    ["Sun", text(row.openhrssu)],
  ];
  const open = days.filter(([, hours]) => hours && !/^close/i.test(hours));
  if (open.length === 0) return "Hours posted at the gate.";
  return open.map(([day, hours]) => `${day} ${cleanHour(hours)}`).join(" · ");
}

function discovery(
  partial: Omit<Discovery, "source"> & { source?: Discovery["source"] },
): Discovery {
  return { source: "nyc-open-data", ...partial };
}

function normalizeMarkets(rows: Row[]): Discovery[] {
  const sorted = rows
    .map((row) => ({ row, year: Number(text(row.year)) || 0 }))
    .sort((a, b) => b.year - a.year);
  const seen = new Set<string>();
  const places: Discovery[] = [];
  for (const { row, year } of sorted) {
    const name = tidy(text(row.marketname));
    const lat = coord(row.latitude);
    const lng = coord(row.longitude);
    if (!name || lat === null || lng === null || !inBounds(lat, lng)) continue;
    const borough = resolveBorough(row.borough, lat, lng);
    if (!borough) continue;
    const key = marketKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    const address = tidy(text(row.streetaddress)) || boroughName(borough);
    const days = text(row.daysoperation);
    const hours = text(row.hoursoperations);
    const ebt = text(row.accepts_ebt).toLowerCase() === "yes";
    const schedule = [days, hours].filter(Boolean).join(", ");
    places.push(
      discovery({
        id: placeId("markets", name, address),
        name,
        category: "farmers-market",
        sourceDetail: SOURCE.markets,
        borough,
        lat,
        lng,
        address,
        hours: [schedule, ebt ? "EBT" : "", text(row.open_year_round).toLowerCase() === "yes" ? "year-round" : ""]
          .filter(Boolean)
          .join(" · "),
        summary: `${name} sets up at ${address}.`,
        about: `Listed in the city's farmers market directory${year ? ` for ${year}` : ""}. ${schedule || "Days and hours are posted at the market."}`,
        tip: ebt ? "This market takes EBT." : "Ask whoever is selling what you don't recognize how they'd cook it this week.",
        tags: ["food", "sustainability"],
        passportCategory: "farmers-market",
      }),
    );
  }
  return places;
}

function normalizeArt(rows: Row[]): Discovery[] {
  return rows.flatMap((row) => {
    const name = tidy(text(row.title));
    const lat = coord(row.latitude);
    const lng = coord(row.longitude);
    if (!name || lat === null || lng === null || !inBounds(lat, lng)) return [];
    const borough = resolveBorough(row.borough, lat, lng);
    if (!borough) return [];
    const artist = artistName(row);
    const kind = text(row.artwork_type1) || "Work";
    const where = text(row.location_name);
    const material = text(row.material);
    const year = text(row.date_created);
    const address = tidy(text(row.address)) || where || boroughName(borough);
    return [
      discovery({
        id: placeId("art", name, kind),
        name,
        category: "public-art",
        sourceDetail: SOURCE.art,
        borough,
        lat,
        lng,
        address,
        hours: where ? `Outdoors, ${where}.` : "Outdoors.",
        summary: artist ? `${kind} by ${artist}${where ? `, ${where}` : ""}.` : `${kind}${where ? ` at ${where}` : ""}.`,
        about: `${name} is in the city's public art inventory${material ? `, ${material.toLowerCase()}` : ""}${year ? ` (${year})` : ""}.`,
        tip: "Read the plaque before you photograph it.",
        tags: ["art", "history"],
        passportCategory: "cultural",
      }),
    ];
  });
}

function normalizeGardens(rows: Row[]): Discovery[] {
  return rows.flatMap((row) => {
    const name = tidy(text(row.gardenname));
    const lat = coord(row.lat);
    const lng = coord(row.lon);
    const status = text(row.status);
    if (!name || lat === null || lng === null || !inBounds(lat, lng)) return [];
    if (status && status.toLowerCase() !== "active") return [];
    const borough = resolveBorough(row.borough, lat, lng);
    if (!borough) return [];
    const address = tidy(text(row.address)) || boroughName(borough);
    return [
      discovery({
        id: placeId("gardens", name, address),
        name,
        category: "garden",
        sourceDetail: SOURCE.gardens,
        borough,
        lat,
        lng,
        address,
        hours: gardenHours(row),
        summary: `An active GreenThumb garden at ${address}.`,
        about: `${name} is listed as an active community garden in the city's GreenThumb directory.`,
        tip: "If the gate is locked, the posted hours are the invitation back.",
        tags: ["sustainability", "volunteering"],
        passportCategory: "community-event",
      }),
    ];
  });
}

function facilityKind(row: Row): { category: CategoryId; passport: PassportCategoryId; tags: InterestId[] } | null {
  const blob = `${text(row.factype)} ${text(row.facsubgrp)}`.toUpperCase();
  if (blob.includes("TA USE")) return null;
  if (blob.includes("LIBRAR")) return { category: "library", passport: "cultural", tags: ["books"] };
  if (blob.includes("MUSEUM")) return { category: "museum", passport: "cultural", tags: ["art", "culture"] };
  if (blob.includes("COMMUNITY CENTER")) {
    return { category: "culture", passport: "community-event", tags: ["volunteering", "culture"] };
  }
  return null;
}

function normalizeFacilities(rows: Row[]): Discovery[] {
  return rows.flatMap((row) => {
    const kind = facilityKind(row);
    const lat = coord(row.latitude);
    const lng = coord(row.longitude);
    if (!kind || lat === null || lng === null || !inBounds(lat, lng)) return [];
    const borough = resolveBorough(row.boro ?? row.borough, lat, lng);
    if (!borough) return [];
    let name = tidy(text(row.facname));
    if (!name) return [];
    if (/^grant$/i.test(name) && kind.category === "culture") name = "Grant Houses Community Center";
    const address = tidy(text(row.address)) || boroughName(borough);
    const operator = tidy(text(row.opname));
    const label =
      kind.category === "library" ? "Library" : kind.category === "museum" ? "Museum" : "Community center";
    return [
      discovery({
        id: placeId("facilities", name, text(row.factype) || address),
        name,
        category: kind.category,
        sourceDetail: SOURCE.facilities,
        borough,
        lat,
        lng,
        address,
        hours: "Hours posted at the door.",
        summary: operator ? `${label} operated by ${operator}.` : `${label} at ${address}.`,
        about: `${name} is in the city's facilities directory${operator ? `, run by ${operator}` : ""}, at ${address}.`,
        tip:
          kind.category === "library"
            ? "Leave with something you would not have searched for."
            : kind.category === "museum"
              ? "Give one room more time than the rest."
              : "Read the bulletin board before you decide this stop is closed.",
        tags: kind.tags,
        passportCategory: kind.passport,
      }),
    ];
  });
}

export function normalizeBundle(bundle: OpenDataBundle): Discovery[] {
  const places = [
    ...normalizeMarkets(bundle.markets),
    ...normalizeArt(bundle.art),
    ...normalizeGardens(bundle.gardens),
    ...normalizeFacilities(bundle.facilities),
  ];
  const seen = new Set<string>();
  return places.filter((place) => {
    if (seen.has(place.id)) return false;
    seen.add(place.id);
    return true;
  });
}

export function normalizeSnapshot() {
  return normalizeBundle(snapshotBundle());
}

async function fetchDataset(dataset: Dataset, fallback: Row[]): Promise<{ rows: Row[]; live: boolean }> {
  const params = new URLSearchParams(QUERIES[dataset]);
  try {
    const response = await fetch(`${NYC_OPEN_DATA[dataset]}?${params.toString()}`);
    if (!response.ok) return { rows: fallback, live: false };
    const data: unknown = await response.json();
    const rows = asRows(data);
    if (rows.length === 0) return { rows: fallback, live: false };
    return { rows, live: true };
  } catch {
    return { rows: fallback, live: false };
  }
}

/** Live SODA pull across New York City. Each dataset falls back to the saved copy on its own. */
export async function loadOpenDataPlaces(): Promise<{ places: Discovery[]; live: boolean }> {
  const saved = snapshotBundle();
  const datasets = Object.keys(NYC_OPEN_DATA) as Dataset[];
  const settled = await Promise.allSettled(datasets.map((dataset) => fetchDataset(dataset, saved[dataset])));
  const bundle = { ...saved };
  let live = false;
  datasets.forEach((dataset, index) => {
    const result = settled[index];
    if (result?.status !== "fulfilled") return;
    bundle[dataset] = result.value.rows;
    live = live || result.value.live;
  });
  return { places: normalizeBundle(bundle), live };
}
