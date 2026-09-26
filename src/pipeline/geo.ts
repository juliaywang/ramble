export const BOUNDS = {
  north: 40.8172,
  south: 40.7992,
  west: -73.9742,
  east: -73.9546,
};

export const MAP_W = 390;
export const MAP_H = 474;

export const ANCHOR = {
  label: "College Walk",
  detail: "116th & Broadway",
  lat: 40.8076,
  lng: -73.9643,
};

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
