import { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DesignIcon, categoryIcons, categoryColors } from "./DesignIcon";
import { ANCHOR } from "../pipeline/geo";
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

export function MapView({ places, selectedId, onSelect, onOpen }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [zoom, setZoom] = useState(15);
  const [tileError, setTileError] = useState(false);
  const callbacks = useRef({ onSelect, onOpen });
  callbacks.current = { onSelect, onOpen };
  const selected = places.find((place) => place.id === selectedId);

  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      minZoom: 13,
      maxZoom: 19,
    }).setView([ANCHOR.lat, ANCHOR.lng], 15);
    instance.attributionControl.setPrefix(false);
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(instance);
    tiles.on("tileerror", () => setTileError(true));
    tiles.on("tileload", () => setTileError(false));
    instance.on("zoomend", () => setZoom(instance.getZoom()));
    instance.on("click", () => callbacks.current.onSelect(null));
    L.circleMarker([ANCHOR.lat, ANCHOR.lng], {
      radius: 7, color: "white", weight: 3, fillColor: "#13293d", fillOpacity: 1,
    }).addTo(instance).bindTooltip("Starting point · College Walk");
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
    const markers = L.layerGroup().addTo(map);
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
      const marker = L.marker([place.lat, place.lng], {
        icon: L.divIcon({ html: button, className: "street-map-marker", iconSize: [30, 30], iconAnchor: [15, 15] }),
        keyboard: false,
        zIndexOffset: active ? 1000 : 0,
      }).addTo(markers);
      const label = document.createElement("span");
      label.textContent = place.name;
      marker.bindTooltip(label, { direction: "top", offset: [0, -16] });
    }
    return () => { markers.remove(); };
  }, [map, places, selectedId]);

  return (
    <div className="map-frame street-map-frame">
      <div ref={container} className="street-map" aria-label="Street map of Morningside Heights" />
      <div className="map-overlays">
        {selected && (
          <button type="button" className="map-callout" onClick={() => onOpen(selected.id)}>
            <span><strong>{selected.name}</strong><small>{selected.minutes} min · {selected.match}% match</small></span>
            <span className="map-callout-go">Open</span>
          </button>
        )}
        <div className="map-controls" role="group" aria-label="Map zoom">
          <button type="button" aria-label="Zoom in" title="Zoom in" disabled={!map || zoom >= 19} onClick={() => map?.zoomIn()}>+</button>
          <button type="button" aria-label="Zoom out" title="Zoom out" disabled={!map || zoom <= 13} onClick={() => map?.zoomOut()}>−</button>
        </div>
        <div className="map-legend"><span><i className="legend-you" /> College Walk</span><span>Colors by activity</span></div>
        {tileError && <p className="map-load-error" role="status">Street map couldn’t load. Check your connection.</p>}
      </div>
    </div>
  );
}
