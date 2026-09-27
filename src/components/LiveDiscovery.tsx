import { useEffect, useState } from "react";
import { discoverNearby } from "../pipeline/liveDiscovery";
import { useLiveFeedUpdate } from "../state/FeedContext";
import { useLocation } from "../state/LocationContext";

export function LiveDiscovery() {
  const { origin } = useLocation();
  const addPlaces = useLiveFeedUpdate();
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState("Turn on location to discover nearby places.");
  const [loading, setLoading] = useState(false);
  // Rounded coordinates avoid sending an exact GPS fix and prevent requests for tiny movements.
  const lat = origin ? Number(origin.lat.toFixed(3)) : null;
  const lng = origin ? Number(origin.lng.toFixed(3)) : null;
  useEffect(() => {
    if (lat === null || lng === null) {
      setLoading(false); setStatus("Turn on location to discover nearby places."); return;
    }
    const controller = new AbortController();
    setLoading(true); setStatus("Finding nearby cafés, bookshops, and cultural spots…");
    const timer = window.setTimeout(() => {
      void discoverNearby(lat, lng, controller.signal).then(result => {
        if (controller.signal.aborted) return;
        addPlaces(result.places);
        setStatus(result.places.length ? `${result.places.length} nearby listings found${result.cached ? " · checked recently" : ""}. Matches already in NYC Open Data are combined.` : "No nearby listings found. Try again in another neighborhood.");
      }).catch(error => {
        if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : "Nearby search is unavailable. Please try again.");
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 700);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [lat, lng, attempt, addPlaces]);
  return <section className="live-discovery-panel" aria-label="Live Discovery">
    <div className="section-head"><h2>Live Discovery</h2>
      <button type="button" className="text-btn" disabled={loading || lat === null} onClick={() => setAttempt(n => n + 1)}>{loading ? "Searching…" : "Refresh"}</button>
    </div>
    <p className="fine" role="status">{status}</p>
    <p className="fine">Nearby venue listings from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>. Opening hours and access may change.</p>
  </section>;
}
