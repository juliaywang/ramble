import type { Discovery } from "../pipeline/types";
import { mergeLivePlaces } from "../pipeline/liveDiscovery";
import { availableForQuest } from "../pipeline/availability";
import { getSupabaseClient } from "../lib/supabase";
import { createContext, useContext, useEffect, useState, useMemo, useCallback, type ReactNode } from "react";
import { fetchNeighborhoodFeed, getNeighborhoodFeed, type NeighborhoodFeed, questForPlace } from "../pipeline/index";

const FeedContext = createContext<NeighborhoodFeed>(getNeighborhoodFeed());

const LiveFeedContext = createContext<(places: Discovery[]) => void>(() => {});
const LIVE_HISTORY = "ramble.live-places.v1";
function savedLivePlaces(): Discovery[] {
  try {
    const rows = JSON.parse(localStorage.getItem(LIVE_HISTORY) ?? "[]");
    return Array.isArray(rows) ? rows.filter((p: Discovery) => p && typeof p.id === "string" && typeof p.name === "string" && Array.isArray(p.tags) && Number.isFinite(p.lat) && Number.isFinite(p.lng)).map((p: Discovery) => ({ ...p, source: "saved-guide", sourceDetail: "Saved OpenStreetMap discovery" })) : [];
  } catch { return []; }
}
export function useLiveFeedUpdate() { return useContext(LiveFeedContext); }

export function FeedProvider({ children }: { children: ReactNode }) {
  const [feed, setFeed] = useState<NeighborhoodFeed>(() => ({ ...getNeighborhoodFeed(), loading: true }));
  const [live, setLive] = useState<Discovery[]>(savedLivePlaces);
  const addLive = useCallback((places: Discovery[]) => {
    setLive(current => [...new Map([...current, ...places].map(p => [p.id, p])).values()]);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(LIVE_HISTORY, JSON.stringify(live)); } catch { /* Discovery remains available for this session. */ }
  }, [live]);
  const combined = useMemo(() => {
    const places = mergeLivePlaces(feed.places, live);
    return { ...feed, places, questTemplates: places.filter(p => availableForQuest(p)).map(questForPlace) };
  }, [feed, live]);
  useEffect(() => {
    let cancel = false;
    let controller: AbortController | undefined;
    const refresh = () => {
      if (cancel) return;
      setFeed(current => ({ ...current, loading: true }));
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      void fetchNeighborhoodFeed(signal).then(next => {
        if (!cancel && !signal.aborted) setFeed(next);
      }).catch(() => {});
    };
    refresh();
    const client = getSupabaseClient();
    const subscription = client?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") queueMicrotask(refresh);
    }).data.subscription;
    const timer = window.setInterval(refresh, 5 * 60 * 1000);
    window.addEventListener("focus", refresh);
    return () => {
      cancel = true;
      controller?.abort();
      subscription?.unsubscribe();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return <LiveFeedContext.Provider value={addLive}><FeedContext.Provider value={combined}>{children}</FeedContext.Provider></LiveFeedContext.Provider>;
}

export function useFeed() {
  return useContext(FeedContext);
}

export function usePlace(id: string | undefined) {
  const { places } = useFeed();
  if (!id) return undefined;
  return places.find((place) => place.id === id);
}
