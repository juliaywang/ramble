import { getSupabaseClient } from "../lib/supabase";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchNeighborhoodFeed, getNeighborhoodFeed, type NeighborhoodFeed } from "../pipeline/index";

const FeedContext = createContext<NeighborhoodFeed>(getNeighborhoodFeed());

export function FeedProvider({ children }: { children: ReactNode }) {
  const [feed, setFeed] = useState<NeighborhoodFeed>(() => ({ ...getNeighborhoodFeed(), loading: true }));
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
  return <FeedContext.Provider value={feed}>{children}</FeedContext.Provider>;
}

export function useFeed() {
  return useContext(FeedContext);
}

export function usePlace(id: string | undefined) {
  const { places } = useFeed();
  if (!id) return undefined;
  return places.find((place) => place.id === id);
}
