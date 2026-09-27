import { useEffect, useMemo, useRef, useState } from "react";
import { discoverNearby, inferNeighborhood, NEIGHBORHOOD_CENTERS } from "../pipeline/liveDiscovery";
import { useLiveFeedUpdate } from "../state/FeedContext";
import { useLocation } from "../state/LocationContext";
import { useRamble } from "../state/RambleContext";

export const NEIGHBORHOOD_GROUPS: Array<{ borough: string; neighborhoods: string[] }> = [
  {
    borough: "Manhattan",
    neighborhoods: [
      "Morningside Heights",
      "Harlem",
      "Upper West Side",
      "Upper East Side",
      "East Village",
      "West Village",
    ],
  },
  {
    borough: "Brooklyn",
    neighborhoods: ["Williamsburg", "Bushwick", "DUMBO"],
  },
  {
    borough: "Queens",
    neighborhoods: ["Astoria"],
  },
];

export const SUPPORTED_NEIGHBORHOODS = NEIGHBORHOOD_GROUPS.flatMap((g) => g.neighborhoods);

export function LiveDiscovery() {
  const { origin } = useLocation();
  const { user } = useRamble();
  const addPlaces = useLiveFeedUpdate();

  const defaultHood = origin ? inferNeighborhood(origin.lat, origin.lng) : "Morningside Heights";
  const [selectedHood, setSelectedHood] = useState(defaultHood);
  const [isOpen, setIsOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState("Searching live web discoveries…");
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync inferred neighborhood when location fix changes
  useEffect(() => {
    if (origin) {
      const inferred = inferNeighborhood(origin.lat, origin.lng);
      setSelectedHood(inferred);
    }
  }, [origin?.lat, origin?.lng]);

  // Click outside or press Escape to close dropdown
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const center = NEIGHBORHOOD_CENTERS[selectedHood] ?? { lat: 40.808, lng: -73.964 };
  const lat = origin ? Number(origin.lat.toFixed(3)) : center.lat;
  const lng = origin ? Number(origin.lng.toFixed(3)) : center.lng;

  const categories = useMemo(() => {
    return user?.interests && user.interests.length > 0
      ? user.interests.slice(0, 3)
      : ["coffee", "books", "music"];
  }, [user?.interests]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setStatus(`Searching live web discoveries in ${selectedHood}…`);

    const timer = window.setTimeout(() => {
      void discoverNearby(lat, lng, controller.signal, {
        neighborhood: selectedHood,
        categories,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          addPlaces(result.places);
          setStatus(
            result.places.length
              ? `${result.places.length} live discoveries found in ${selectedHood}${
                  result.cached ? " · checked recently" : ""
                }. Matches already in NYC Open Data are combined.`
              : `No live web discoveries found for ${selectedHood}. Try refreshing or selecting another neighborhood.`
          );
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            setStatus(
              error instanceof Error
                ? error.message
                : "Live discovery search is unavailable. Please try again."
            );
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [lat, lng, selectedHood, attempt, addPlaces, categories]);

  return (
    <section className="live-discovery-panel" aria-label="Live Discovery">
      <div className="section-head">
        <div className="live-head-title">
          <h2>Live Discovery</h2>
          <span className="live-badge">Tavily + Gemini</span>
        </div>
        <div className="live-discovery-actions">
          {/* Clean Custom Neighborhood Dropdown */}
          <div className="live-dropdown-wrap" ref={dropdownRef}>
            <button
              type="button"
              className={`live-hood-trigger ${isOpen ? "is-open" : ""}`}
              onClick={() => setIsOpen((prev) => !prev)}
              aria-expanded={isOpen}
              aria-haspopup="listbox"
              disabled={loading}
              title="Select NYC Neighborhood"
            >
              <span className="live-hood-icon" aria-hidden="true">📍</span>
              <span className="live-hood-label">{selectedHood}</span>
              <svg
                className={`live-hood-caret ${isOpen ? "is-rotated" : ""}`}
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2.5 4.5L6 8L9.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {isOpen && (
              <div className="live-hood-menu" role="listbox" aria-label="NYC Neighborhoods">
                {NEIGHBORHOOD_GROUPS.map((group) => (
                  <div key={group.borough} className="live-hood-group">
                    <div className="live-hood-group-title">{group.borough}</div>
                    {group.neighborhoods.map((hood) => {
                      const isSelected = selectedHood === hood;
                      return (
                        <button
                          key={hood}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`live-hood-option ${isSelected ? "is-selected" : ""}`}
                          onClick={() => {
                            setSelectedHood(hood);
                            setIsOpen(false);
                          }}
                        >
                          <span className="live-hood-option-text">{hood}</span>
                          {isSelected && (
                            <span className="live-hood-check" aria-hidden="true">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className="live-refresh-btn"
            disabled={loading}
            onClick={() => setAttempt((n) => n + 1)}
            aria-label="Refresh live web discoveries"
          >
            <span className={`live-refresh-icon ${loading ? "is-spinning" : ""}`} aria-hidden="true">
              ↻
            </span>
            <span>{loading ? "Searching…" : "Refresh"}</span>
          </button>
        </div>
      </div>

      <div className="live-status-row">
        <span className={`live-status-dot ${loading ? "is-loading" : ""}`} aria-hidden="true" />
        <p className="fine" role="status">
          {status}
        </p>
      </div>

      <p className="fine live-footnote">
        Real-time NYC places and events discovered via Tavily web search and Google Gemini.
      </p>
    </section>
  );
}
