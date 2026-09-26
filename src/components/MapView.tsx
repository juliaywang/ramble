import { DesignIcon, categoryIcons } from "./DesignIcon";
import { ANCHOR, MAP_H, MAP_W, project } from "../pipeline/geo";
import { CATEGORIES, type CategoryId, type DataSource } from "../pipeline/types";

export type MapPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: CategoryId;
  source: DataSource;
  minutes: number;
  match: number;
};

type Props = {
  places: MapPlace[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpen: (id: string) => void;
};

function line(coords: [number, number][]) {
  return coords
    .map(([lat, lng]) => {
      const point = project(lat, lng);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function spread(pins: { id: string; x: number; y: number }[], fixed: { x: number; y: number }) {
  const placed = pins.map((pin) => ({ ...pin }));
  for (let pass = 0; pass < 5; pass += 1) {
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        separate(placed[i]!, placed[j]!, 24);
      }
    }
    for (const pin of placed) separate(pin, fixed, 36);
  }
  return placed.map((pin) => ({
    ...pin,
    x: Math.min(MAP_W - 18, Math.max(18, pin.x)),
    y: Math.min(MAP_H - 18, Math.max(18, pin.y)),
  }));
}

function separate(a: { x: number; y: number }, b: { x: number; y: number }, min: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 0.01;
  if (dist >= min) return;
  const moveB = "id" in b;
  const push = (min - dist) / (moveB ? 2 : 1);
  const ux = dx / dist;
  const uy = dy / dist;
  a.x -= ux * push;
  a.y -= uy * push;
  if (moveB) {
    b.x += ux * push;
    b.y += uy * push;
  }
}

const BROADWAY: [number, number][] = [
  [40.8002, -73.9674],
  [40.80515, -73.96585],
  [40.8083, -73.9637],
  [40.8138, -73.9612],
  [40.817, -73.9596],
];

const AMSTERDAM: [number, number][] = [
  [40.8004, -73.9632],
  [40.8035, -73.9616],
  [40.8078, -73.9596],
  [40.8109, -73.9563],
  [40.8162, -73.955],
];

const RIVERSIDE: [number, number][] = [
  [40.8006, -73.9712],
  [40.8045, -73.9694],
  [40.8088, -73.9668],
  [40.8117, -73.9635],
  [40.8135, -73.9632],
  [40.8168, -73.9622],
];

const MORNINGSIDE: [number, number][] = [
  [40.8012, -73.9598],
  [40.8064, -73.9588],
  [40.8118, -73.9574],
  [40.8158, -73.9564],
];

export function MapView({ places, selectedId, onSelect, onOpen }: Props) {
  const you = project(ANCHOR.lat, ANCHOR.lng);
  const laidOut = spread(
    places.map((place) => ({ id: place.id, ...project(place.lat, place.lng) })),
    you,
  );
  const byId = new Map(laidOut.map((pin) => [pin.id, pin]));
  const selected = places.find((place) => place.id === selectedId) ?? null;

  return (
    <div className="map-frame">
      <svg className="map-svg" preserveAspectRatio="none" viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label="Illustrated map of Morningside Heights">
        <rect width={MAP_W} height={MAP_H} fill="#e0e3d8" />
        <polygon points={line([[40.8172, -73.9742], [40.7992, -73.9742], [40.7992, -73.9722], [40.806, -73.9716], [40.812, -73.9692], [40.8172, -73.9676]])} fill="#d0dde0" />
        <polygon points={line([[40.8008, -73.9724], [40.8062, -73.9714], [40.8102, -73.9696], [40.8142, -73.9668], [40.8166, -73.9648], [40.8166, -73.9626], [40.8134, -73.963], [40.8115, -73.9633], [40.8086, -73.9664], [40.8042, -73.969], [40.8008, -73.9708]])} fill="#c9dec3" />
        <polygon points={line([[40.8016, -73.9594], [40.8148, -73.9568], [40.8148, -73.9552], [40.8016, -73.9576]])} fill="#c5d8bf" />
        <polygon points={line([[40.8112, -73.9638], [40.8132, -73.9634], [40.8132, -73.9616], [40.8114, -73.9618]])} fill="#d5e6cf" />
        <polygon points={line([[40.806, -73.9653], [40.8116, -73.9624], [40.8116, -73.9562], [40.806, -73.9602]])} fill="#e8dfdc" />
        <polyline points={line(BROADWAY)} fill="none" stroke="rgba(72,52,32,0.72)" strokeWidth="3.2" strokeLinecap="round" />
        <polyline points={line(AMSTERDAM)} fill="none" stroke="rgba(90,68,44,0.48)" strokeWidth="2.2" strokeLinecap="round" />
        <polyline points={line(RIVERSIDE)} fill="none" stroke="rgba(90,68,44,0.48)" strokeWidth="2.2" strokeLinecap="round" />
        <polyline points={line(MORNINGSIDE)} fill="none" stroke="rgba(90,68,44,0.35)" strokeWidth="1.6" strokeLinecap="round" />
        {[110, 112, 114, 116, 120, 122].map((street) => {
          const lat = 40.8079 + (street - 116) * 0.00095;
          return (
            <line
              key={street}
              x1={project(lat, -73.9708).x}
              y1={project(lat, -73.9708).y}
              x2={project(lat, -73.9552).x}
              y2={project(lat, -73.9552).y}
              stroke="rgba(92,74,52,0.22)"
              strokeWidth="1.2"
            />
          );
        })}
        <text x="18" y="250" fill="#5d7380" fontSize="11" fontFamily="Manrope, sans-serif">Hudson</text>
        <text x="78" y="168" fill="#3f624c" fontSize="11" fontFamily="Manrope, sans-serif">Riverside Park</text>
        <text x="168" y="250" fill="#6d5738" fontSize="12" fontFamily="Manrope, sans-serif">Columbia</text>
        <text x="248" y="188" fill="#3f624c" fontSize="11" fontFamily="Manrope, sans-serif">Morningside Park</text>
        <text x="198" y="78" fill="#5c5146" fontSize="10" fontFamily="Manrope, sans-serif">122</text>
        <text x="150" y="214" fill="#5c5146" fontSize="10" fontFamily="Manrope, sans-serif">116</text>
        <text x="118" y="300" fill="#5c5146" fontSize="10" fontFamily="Manrope, sans-serif">110</text>
        <text x="86" y="430" fill="#6a5a48" fontSize="11" fontFamily="Manrope, sans-serif">Broadway</text>
        <text x="300" y="40" fill="#6a5a48" fontSize="10" fontFamily="Manrope, sans-serif">N</text>
      </svg>
      <div className="map-pins">
        <button type="button" className="map-hit" tabIndex={-1} aria-label="Clear selection" onClick={() => onSelect(null)} />
        <div className="you" style={{ left: `${(you.x / MAP_W) * 100}%`, top: `${(you.y / MAP_H) * 100}%` }}>
          <span className="you-dot" />
          <span className="you-label">You</span>
        </div>
        {places.map((place) => {
          const point = byId.get(place.id);
          if (!point) return null;
          const meta = CATEGORIES[place.category];
          const selectedPin = place.id === selectedId;
          return (
            <button
              key={place.id}
              type="button"
              className={["pin", place.source === "live-discovery" ? "pin-live" : "pin-verified", selectedPin ? "is-selected" : ""].filter(Boolean).join(" ")}
              style={{ left: `${(point.x / MAP_W) * 100}%`, top: `${(point.y / MAP_H) * 100}%` }}
              aria-label={`${place.name}, ${meta.label}`}
              aria-pressed={selectedPin}
              onClick={(event) => {
                event.stopPropagation();
                if (selectedPin) onOpen(place.id);
                else onSelect(place.id);
              }}
            >
              <span aria-hidden="true"><DesignIcon name={categoryIcons[place.category] ?? "pin"} size="sm" /></span>
            </button>
          );
        })}
        {selected ? (
          <button
            type="button"
            className="map-callout"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(selected.id);
            }}
          >
            <span>
              <strong>{selected.name}</strong>
              <small>
                {selected.minutes} min · {selected.match}% match
              </small>
            </span>
            <span className="map-callout-go">Open</span>
          </button>
        ) : null}
        <div className="map-legend">
          <span><i className="legend-you" /> You</span>
          <span><i className="legend-verified" /> Verified</span>
          <span><i className="legend-live" /> Live</span>
        </div>
      </div>
    </div>
  );
}
