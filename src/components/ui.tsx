import { DesignIcon, categoryIcons, categoryColors } from "./DesignIcon";
import { useEffect, useState } from "react";
import { CATEGORIES, SOURCE_LABEL, type DataSource, type Discovery, type RankedDiscovery } from "../pipeline/types";
import { formatDistance } from "../pipeline/geo";
import { IconBack } from "./Icons";

export function SourceBadge({ source }: { source: DataSource }) {
  const live = source === "live-discovery";
  return (
    <span className={live ? "badge badge-live" : "badge badge-verified"}>
      {live ? <span className="live-dot" aria-hidden="true" /> : null}
      {SOURCE_LABEL[source]}
    </span>
  );
}

export function PlaceMedia({ place, tall = false }: { place: Discovery; tall?: boolean }) {
  const meta = CATEGORIES[place.category];
  return (
    <div
      className={tall ? "media media-tall" : "media"}
      style={{ background: categoryColors[place.category], color: "white" }}
    >
      <span className="media-emoji" aria-hidden="true">
        <DesignIcon name={categoryIcons[place.category] ?? "pin"} size="lg" />
      </span>
      <span className="media-cat">{meta.label}</span>
    </div>
  );
}

export function BackRow({ onBack, label = "Back" }: { onBack: () => void; label?: string }) {
  return (
    <div className="back-row">
      <button type="button" className="back-btn" onClick={onBack}>
        <IconBack />
        {label}
      </button>
    </div>
  );
}

export function PlaceCard({
  place,
  logged = false,
  selected = false,
  highlighted = false,
  onOpen,
}: {
  place: RankedDiscovery;
  logged?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  onOpen: () => void;
}) {
  const meta = CATEGORIES[place.category];
  const className = ["card", "place-card", selected ? "is-selected" : "", highlighted ? "is-highlight" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <article id={`place-${place.id}`} className={className}>
      <button type="button" className="place-card-hit" onClick={onOpen}>
        <PlaceMedia place={place} />
        <div className="place-card-body">
          <div className="place-card-top">
            <h3>{place.name}</h3>
            <span className="match">{place.match}% match</span>
          </div>
          <p className="meta-line">
            {meta.label} · {formatDistance(place.miles)} · {place.minutes} min walk
          </p>
          <p className="why clamp-3">{place.why}</p>
          <div className="badge-row">
            <SourceBadge source={place.source} />
            {logged ? <span className="logged">In your log</span> : null}
          </div>
        </div>
      </button>
      <div className="place-card-actions">
        <a
          className="open-maps"
          href={`https://maps.apple.com/?${new URLSearchParams({ ll: `${place.lat},${place.lng}`, q: place.name })}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${place.name} in Maps`}
        >
          <DesignIcon name="map" size="sm" />
          Open in Maps
          <DesignIcon name="arrow" size="sm" />
        </a>
      </div>
    </article>
  );
}

export function Generating({ mark, lines }: { mark: string; lines: string[] }) {
  const line = lines[0] ?? "";
  return (
    <div className="generating" role="status" aria-live="polite">
      <div className="generating-mark" aria-hidden="true">
        {mark}
      </div>
      <RotatingLines lines={lines} fallback={line} />
    </div>
  );
}

function RotatingLines({ lines, fallback }: { lines: string[]; fallback: string }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (lines.length < 2) return;
    const handle = window.setInterval(() => {
      setIndex((current) => (current + 1) % lines.length);
    }, 520);
    return () => window.clearInterval(handle);
  }, [lines.length]);
  return <p>{lines[index] ?? fallback}</p>;
}
