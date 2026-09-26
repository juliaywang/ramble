import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { inCity, type WalkStart } from "../pipeline/geo";
import { useRamble } from "./RambleContext";

export type LocationStatus = "locating" | "ready" | "denied" | "unavailable" | "outside";

type LocationValue = {
  origin: WalkStart | null;
  status: LocationStatus;
  usingGps: boolean;
  request: () => Promise<WalkStart | null>;
};

const LocationContext = createContext<LocationValue | null>(null);

function sameFix(current: { lat: number; lng: number } | null, next: { lat: number; lng: number }) {
  return current !== null && Math.abs(current.lat - next.lat) < 0.00002 && Math.abs(current.lng - next.lng) < 0.00002;
}

function toStart(fix: { lat: number; lng: number }): WalkStart {
  return { label: "Your location", detail: "Current position", lat: fix.lat, lng: fix.lng };
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const { session } = useRamble();
  const [fix, setFix] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState<LocationStatus>("locating");

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setFix(null);
      setStatus("unavailable");
      return Promise.resolve(null);
    }
    setStatus((current) => (current === "ready" ? current : "locating"));

    const read = (high: boolean) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: high,
          timeout: high ? 8000 : 12000,
          maximumAge: 20000,
        });
      });

    return read(true)
      .catch((error: GeolocationPositionError) => {
        if (error.code === error.TIMEOUT) return read(false);
        throw error;
      })
      .then((position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng) || (next.lat === 0 && next.lng === 0)) {
          setFix(null);
          setStatus("unavailable");
          return null;
        }
        if (!inCity(next.lat, next.lng)) {
          setFix(null);
          setStatus("outside");
          return null;
        }
        setFix((current) => (sameFix(current, next) ? current : next));
        setStatus("ready");
        return toStart(next);
      })
      .catch((error: GeolocationPositionError) => {
        setFix(null);
        setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
        return null;
      });
  }, []);

  useEffect(() => {
    if (!session) {
      setFix(null);
      setStatus("unavailable");
      return;
    }
    void request();
  }, [request, session]);

  useEffect(() => {
    if (status !== "ready" || !navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (!inCity(next.lat, next.lng)) return;
        setFix((current) => (sameFix(current, next) ? current : next));
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [status]);

  const value = useMemo<LocationValue>(() => {
    if (fix && status === "ready") {
      return { origin: toStart(fix), status, usingGps: true, request };
    }
    return { origin: null, status, usingGps: false, request };
  }, [fix, request, status]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used inside LocationProvider");
  return ctx;
}

export function locationNote(status: LocationStatus) {
  if (status === "ready") return "Walks start at your current location.";
  if (status === "locating") return "Finding your location. Walks start there.";
  if (status === "denied") return "Location is off. Allow it so walks can start where you are.";
  if (status === "outside") return "That position is outside New York City. Ramble starts a walk from where you are in the city.";
  return "Ramble couldn’t read your location yet. Try again so the walk starts where you are.";
}
