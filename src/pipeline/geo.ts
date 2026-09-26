export const BOUNDS = {
  north: 40.9176,
  south: 40.496,
  west: -74.2591,
  east: -73.7004,
};

export const MAP_W = 390;
export const MAP_H = 474;

export type WalkStart = {
  label: string;
  detail: string;
  lat: number;
  lng: number;
};

/** Original Ramble start, still the Manhattan walk origin. */
export const ANCHOR: WalkStart = {
  label: "College Walk",
  detail: "116th & Broadway",
  lat: 40.8076,
  lng: -73.9643,
};

export type BoroughId = "manhattan" | "brooklyn" | "queens" | "bronx" | "staten-island";

const BOROUGH_LABEL: Record<BoroughId, string> = {
  manhattan: "Manhattan",
  brooklyn: "Brooklyn",
  queens: "Queens",
  bronx: "The Bronx",
  "staten-island": "Staten Island",
};

const BOROUGH_CODES: Record<string, BoroughId> = {
  manhattan: "manhattan",
  mn: "manhattan",
  m: "manhattan",
  brooklyn: "brooklyn",
  bk: "brooklyn",
  b: "brooklyn",
  kings: "brooklyn",
  queens: "queens",
  qn: "queens",
  q: "queens",
  bronx: "bronx",
  "the bronx": "bronx",
  bx: "bronx",
  x: "bronx",
  "staten island": "staten-island",
  si: "staten-island",
  r: "staten-island",
  richmond: "staten-island",
};

export function boroughName(id: BoroughId) {
  return BOROUGH_LABEL[id];
}

export function canonicalBorough(raw: string | null | undefined): BoroughId | null {
  const value = (raw ?? "").trim().toLowerCase().replace(/\./g, "");
  return BOROUGH_CODES[value] ?? null;
}

/**
 * Fallback when a row has coordinates and no borough code.
 * Dataset borough fields win; this only covers the gaps.
 */
export function boroughFromPoint(lat: number, lng: number): BoroughId | null {
  if (!(lat > BOUNDS.south && lat < BOUNDS.north && lng > BOUNDS.west && lng < BOUNDS.east)) return null;
  if (lng <= -74.05 && lat < 40.66) return "staten-island";
  if (lat >= 40.8 && lng > -73.933 && lng < -73.76 && lat < 40.92) {
    if (!(lng < -73.94 && lat < 40.82)) return "bronx";
  }
  if (lng <= -73.98 && lat >= 40.68 && lat <= 40.88) return "manhattan";
  if (lat >= 40.79 && lng <= -73.93 && lng >= -74.02 && lat <= 40.88) return "manhattan";
  if (lng > -73.9 && lat > 40.54) return lat > 40.79 && lng < -73.86 ? "bronx" : "queens";
  if (lat >= 40.735 && lng >= -73.97 && lng < -73.9) return "queens";
  if (lat < 40.8) return "brooklyn";
  return "manhattan";
}

export type CityAreaId = BoroughId | "nyc";

export type CityArea = {
  id: CityAreaId;
  name: string;
  short: string;
  borough: BoroughId | null;
  center: { lat: number; lng: number };
  zoom: number;
  anchor: WalkStart;
};

export const CITY_AREAS: CityArea[] = [
  {
    id: "manhattan",
    name: "Manhattan",
    short: "Manhattan",
    borough: "manhattan",
    center: { lat: 40.783, lng: -73.971 },
    zoom: 12,
    anchor: ANCHOR,
  },
  {
    id: "brooklyn",
    name: "Brooklyn",
    short: "Brooklyn",
    borough: "brooklyn",
    center: { lat: 40.65, lng: -73.95 },
    zoom: 12,
    anchor: { label: "Borough Hall", detail: "Downtown Brooklyn", lat: 40.6926, lng: -73.9903 },
  },
  {
    id: "queens",
    name: "Queens",
    short: "Queens",
    borough: "queens",
    center: { lat: 40.72, lng: -73.82 },
    zoom: 11,
    anchor: { label: "Queens Borough Hall", detail: "Kew Gardens", lat: 40.7136, lng: -73.8283 },
  },
  {
    id: "bronx",
    name: "The Bronx",
    short: "Bronx",
    borough: "bronx",
    center: { lat: 40.85, lng: -73.866 },
    zoom: 12,
    anchor: { label: "Grand Concourse", detail: "161st Street", lat: 40.8276, lng: -73.9254 },
  },
  {
    id: "staten-island",
    name: "Staten Island",
    short: "Staten Island",
    borough: "staten-island",
    center: { lat: 40.58, lng: -74.15 },
    zoom: 12,
    anchor: { label: "St. George", detail: "Ferry terminal", lat: 40.6437, lng: -74.0737 },
  },
  {
    id: "nyc",
    name: "New York City",
    short: "All NYC",
    borough: null,
    center: { lat: 40.7128, lng: -73.99 },
    zoom: 11,
    anchor: { label: "City Hall", detail: "Lower Manhattan", lat: 40.7127, lng: -74.0059 },
  },
];

export const DEFAULT_AREA = CITY_AREAS[0];

export function areaById(id: string | null | undefined): CityArea {
  return CITY_AREAS.find((area) => area.id === id) ?? DEFAULT_AREA;
}

export function placeInArea(borough: BoroughId, area: CityArea) {
  return area.borough === null || area.borough === borough;
}

export type LatLng = { lat: number; lng: number };

export function project(lat: number, lng: number) {
  const x = ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * MAP_W;
  const y = ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * MAP_H;
  return { x, y };
}

export function distanceMiles(a: LatLng, b: LatLng) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 3958.7613 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** About 3 mph, the usual city-walking estimate. */
export function walkMinutes(miles: number) {
  return Math.max(3, Math.round(miles * 20));
}

export function formatDistance(miles: number) {
  if (miles < 0.1) {
    const feet = Math.max(80, Math.round((miles * 5280) / 20) * 20);
    return `${feet} ft`;
  }
  return `${(Math.round(miles * 10) / 10).toFixed(1)} mi`;
}
