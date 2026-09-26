import { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { DesignIcon, categoryIcons, categoryColors } from "./DesignIcon";
import type { CityArea } from "../pipeline/geo";
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
  area: CityArea;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpen: (id: string) => void;
};

export function MapView({ places, area, selectedId, onSelect, onOpen }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [zoom, setZoom] = useState(area.zoom);
  const [tileError, setTileError] = useState(false);
  const callbacks = useRef({ onSelect, onOpen });
  callbacks.current = { onSelect, onOpen };
  const selected = places.find((place) => place.id === selectedId);
  const areaRef = useRef(area);
  areaRef.current = area;

  useEffect(() => {
    if (!container.current) return;
    const start = areaRef.current;
    const instance = L.map(container.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      minZoom: 10,
      maxZoom: 19,
    }).setView([start.center.lat, start.center.lng], start.zoom);
    instance.attributionControl.setPrefix(false);
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(instance);
    tiles.on("tileerror", () => setTileError(true));
    tiles.on("tileload", () => setTileError(false));
    instance.on("zoomend", () => setZoom(instance.getZoom()));
    instance.on("click", () => callbacks.current.onSelect(null));
    const resize = new ResizeObserver(() => instance.invalidateSize());
    resize.observe(container.current);
    setMap(instance);
    return () => {
      resize.disconnect();
      instance.remove();
    };
  }, []);

  useEffect(() => {
    if (!map) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const view: L.LatLngExpression = [area.center.lat, area.center.lng];
    if (reduce) map.setView(view, area.zoom);
    else map.flyTo(view, area.zoom, { duration: 0.6 });
  }, [map, area]);

  useEffect(() => {
    if (!map) return;
    const markers = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 46,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 17,
    });
    const start = L.circleMarker([area.anchor.lat, area.anchor.lng], {
      radius: 7,
      color: "white",
      weight: 3,
      fillColor: "#13293d",
      fillOpacity: 1,
    }).addTo(map).bindTooltip(`Starting point · ${area.anchor.label}`);
    for (const place of places) {
      if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) continue;
      const active = selectedId === place.id;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `street-map-pin${active ? " is-selected" : ""}`;
      button.style.background = categoryColors[place.category];
      button.setAttribute("aria-label", `${place.name}, ${CATEGORIES[place.category].label}`);
      button.setAttribute("aria-pressed", String(active));
      button.innerHTML = renderToStaticMarkup(<DesignIcon name={categoryIcons[place.category] ?? "pin"} size="sm" />);
      L.DomEvent.disableClickPropagation(button);
      button.onclick = () => {
        if (active) callbacks.current.onOpen(place.id);
        else callbacks.current.onSelect(place.id);
      };
      markers.addLayer(
        L.marker([place.lat, place.lng], {
          icon: L.divIcon({ html: button, className: "street-map-marker", iconSize: [30, 30], iconAnchor: [15, 15] }),
          keyboard: false,
          zIndexOffset: active ? 1000 : 0,
        }),
      );
    }
    map.addLayer(markers);
    return () => {
      map.removeLayer(markers);
      map.removeLayer(start);
    };
  }, [map, places, selectedId, area.anchor]);

  return (
    <div className="map-frame street-map-frame">
      <div ref={container} className="street-map" aria-label={`Street map of ${area.name}`} />
      <div className="map-overlays">
        {selected && (
          <button type="button" className="map-callout" onClick={() => onOpen(selected.id)}>
            <span><strong>{selected.name}</strong><small>{selected.minutes} min · {selected.match}% match</small></span>
            <span className="map-callout-go">Open</span>
          </button>
        )}
        <div className="map-controls" role="group" aria-label="Map zoom">
          <button type="button" aria-label="Zoom in" title="Zoom in" disabled={!map || zoom >= 19} onClick={() => map?.zoomIn()}>+</button>
          <button type="button" aria-label="Zoom out" title="Zoom out" disabled={!map || zoom <= 10} onClick={() => map?.zoomOut()}>−</button>
        </div>
        <div className="map-legend"><span><i className="legend-you" /> {area.anchor.label}</span><span>Colors by activity</span></div>
        {tileError && <p className="map-load-error" role="status">Street map couldn’t load. Check your connection.</p>}
      </div>
    </div>
  );
}
