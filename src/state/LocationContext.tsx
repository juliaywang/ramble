import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { inCity, type WalkStart } from "../pipeline/geo";
import { useArea } from "./AreaContext";
import { useRamble } from "./RambleContext";

export type LocationStatus = "locating" | "ready" | "denied" | "unavailable" | "outside";

type LocationValue = {
  origin: WalkStart;
  status: LocationStatus;
  usingGps: boolean;
  request: () => void;
};

const LocationContext = createContext<LocationValue | null>(null);

function sameFix(current: { lat: number; lng: number } | null, next: { lat: number; lng: number }) {
  return current !== null && Math.abs(current.lat - next.lat) < 0.00002 && Math.abs(current.lng - next.lng) < 0.00002;
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const { area } = useArea();
  const { session } = useRamble();
  const [fix, setFix] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState<LocationStatus>("locating");

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setFix(null);
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (!inCity(next.lat, next.lng)) {
          setFix(null);
          setStatus("outside");
          return;
        }
        setFix((current) => (sameFix(current, next) ? current : next));
        setStatus("ready");
      },
      (error) => {
        setFix(null);
        setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 20000 },
    );
  }, []);

  useEffect(() => {
    if (!session) {
      setFix(null);
      setStatus("unavailable");
      return;
    }
    request();
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
      { enableHighAccuracy: true, maximumAge: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [status]);

  const value = useMemo<LocationValue>(() => {
    if (fix) {
      return {
        origin: { label: "Your location", detail: "Current position", lat: fix.lat, lng: fix.lng },
        status,
        usingGps: true,
        request,
      };
    }
    return { origin: area.anchor, status, usingGps: false, request };
  }, [area.anchor, fix, request, status]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used inside LocationProvider");
  return ctx;
}

export function locationNote(status: LocationStatus, fallback: string) {
  if (status === "ready") return "Walks start at your current location.";
  if (status === "locating") return "Finding your location. Walks use it as soon as it arrives.";
  if (status === "denied") return `Location is off, so walks start at ${fallback}. You can turn it on in Settings.`;
  if (status === "outside") return `That location is outside New York City, so walks start at ${fallback}.`;
  return `Location isn’t available, so walks start at ${fallback}.`;
}
