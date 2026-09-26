import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchNeighborhoodFeed, getNeighborhoodFeed, type NeighborhoodFeed } from "../pipeline/index";

const FeedContext = createContext<NeighborhoodFeed>(getNeighborhoodFeed());

function signature(feed: NeighborhoodFeed) {
  return `${feed.updatedFrom}:${feed.places.map((place) => place.id).sort().join("|")}`;
}

export function FeedProvider({ children }: { children: ReactNode }) {
  const [feed, setFeed] = useState(getNeighborhoodFeed);
  useEffect(() => {
    let cancel = false;
    fetchNeighborhoodFeed().then((next) => {
      if (cancel) return;
      setFeed((current) => (signature(current) === signature(next) ? current : next));
    });
    return () => {
      cancel = true;
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
