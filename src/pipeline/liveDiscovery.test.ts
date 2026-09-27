import { afterEach, describe, expect, it, vi } from "vitest";
import {
  discoverNearby,
  inferNeighborhood,
  liveDiscoveryToPlace,
  liveQuery,
  mapCategory,
  mergeLivePlaces,
  osmDiscovery,
  type RawLiveDiscovery,
} from "./liveDiscovery";

const node = { type: "node", id: 123, lat: 40.808, lon: -73.964, tags: { name: "Corner Cafe", amenity: "cafe", opening_hours: "Mo-Fr 08:00-17:00" } };

afterEach(() => vi.unstubAllGlobals());

describe("live discovery", () => {
  it("validates query coordinates and rounds the search location", () => {
    expect(liveQuery(40.808123, -73.964123)).toContain("around:1200,40.808,-73.964");
    expect(() => liveQuery(NaN, -73)).toThrow();
    expect(() => liveQuery(0, 0)).toThrow();
  });

  it("uses real OSM identifiers, source links, hours and categories", () => {
    expect(osmDiscovery(node)).toMatchObject({ id: "osm-node-123", source: "live-discovery", category: "cafe", tags: ["coffee", "food"], sourceUrl: "https://www.openstreetmap.org/node/123", hours: "Listed hours: Mo-Fr 08:00-17:00" });
    expect(osmDiscovery({ type: "way", id: 456, center: { lat: 40.808, lon: -73.964 }, tags: { name: "Books", shop: "books" } })).toMatchObject({ id: "osm-way-456", category: "bookstore" });
  });

  it("does not recommend unnamed, private, closed or unlocated records", () => {
    expect(osmDiscovery({ ...node, tags: { amenity: "cafe" } })).toBeNull();
    expect(osmDiscovery({ ...node, tags: { ...node.tags, access: "private" } })).toBeNull();
    expect(osmDiscovery({ ...node, tags: { ...node.tags, disused: "yes" } })).toBeNull();
    expect(osmDiscovery({ ...node, lat: undefined })).toBeNull();
    expect(osmDiscovery({ ...node, lat: 0 })).toBeNull();
  });

  it("replaces handwritten guides while preserving IDs and avoids duplicating official venues", () => {
    const live = osmDiscovery(node)!;
    const guide = { ...live, id: "old-cafe", source: "saved-guide" as const, summary: "old copy" };
    expect(mergeLivePlaces([guide], [live])).toEqual([{ ...live, id: "old-cafe" }]);
    const official = { ...guide, source: "nyc-open-data" as const };
    expect(mergeLivePlaces([official], [live])).toEqual([official]);
  });

  it("fetches real responses, deduplicates node/way records and caches repeat searches", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ elements: [node, { ...node, type: "way", id: 456 }] }) });
    vi.stubGlobal("fetch", fetcher);
    const result = await discoverNearby(40.808, -73.964);
    expect(result.places).toHaveLength(1);
    expect(result.cached).toBe(false);
    expect((await discoverNearby(40.808, -73.964)).cached).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects provider errors and partial responses without generating fixture results", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(discoverNearby(40.809, -73.964)).rejects.toThrow("busy");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ elements: [node], remark: "runtime error: timed out" }) }));
    await expect(discoverNearby(40.81, -73.964)).rejects.toThrow("incomplete");
  });

  describe("Tavily + Gemini live-discovery edge function mapping", () => {
    it("correctly infers NYC neighborhoods from coordinates", () => {
      expect(inferNeighborhood(40.808, -73.964)).toBe("Morningside Heights");
      expect(inferNeighborhood(40.787, -73.975)).toBe("Upper West Side");
      expect(inferNeighborhood(40.708, -73.957)).toBe("Williamsburg");
      expect(inferNeighborhood(40.726, -73.981)).toBe("East Village");
    });

    it("maps categories accurately", () => {
      expect(mapCategory(["coffee"])).toBe("cafe");
      expect(mapCategory(["books"])).toBe("bookstore");
      expect(mapCategory(["music"])).toBe("music");
      expect(mapCategory(["art"])).toBe("public-art");
      expect(mapCategory(["sustainability"])).toBe("garden");
      expect(mapCategory(["history"])).toBe("historic");
    });

    it("transforms raw live place discoveries into frontend Discoveries", () => {
      const rawPlace: RawLiveDiscovery = {
        name: "Book Culture",
        discovery_type: "place",
        categories: ["books"],
        description: "Neighborhood independent bookstore on 112th St.",
        address: "536 W 112th St",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: 40.8053,
        longitude: -73.9654,
        start_time: null,
        end_time: null,
        source: "Live Discovery",
        source_url: "https://www.bookculture.com",
        verified: false,
      };

      const place = liveDiscoveryToPlace(rawPlace);
      expect(place.name).toBe("Book Culture");
      expect(place.category).toBe("bookstore");
      expect(place.source).toBe("live-discovery");
      expect(place.sourceDetail).toContain("Live Web Discovery");
      expect(place.sourceUrl).toBe("https://www.bookculture.com");
      expect(place.address).toBe("536 W 112th St");
      expect(place.borough).toBe("manhattan");
      expect(place.lat).toBe(40.8053);
      expect(place.lng).toBe(-73.9654);
      expect(place.tags).toContain("books");
      expect(place.passportCategory).toBe("bookstore");
    });

    it("transforms raw live event discoveries and formats NYC time", () => {
      const rawEvent: RawLiveDiscovery = {
        name: "Miller Theatre Pop-Up Concert",
        discovery_type: "event",
        categories: ["music"],
        description: "Live chamber music on Columbia campus.",
        address: "2960 Broadway",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: "2026-09-28T18:00:00-04:00",
        end_time: "2026-09-28T20:00:00-04:00",
        source: "Live Discovery",
        source_url: "https://www.millertheatre.com",
        verified: false,
      };

      const place = liveDiscoveryToPlace(rawEvent, { lat: 40.808, lng: -73.964 });
      expect(place.name).toBe("Miller Theatre Pop-Up Concert");
      expect(place.category).toBe("music");
      expect(place.passportCategory).toBe("community-event");
      expect(place.eventStart).toBe("2026-09-28T18:00:00-04:00");
      expect(place.eventEnd).toBe("2026-09-28T20:00:00-04:00");
      expect(place.hours).toContain("Sep 28");
      expect(place.hours).toContain("NYC time");
      // Assigned coordinates near neighborhood center
      expect(place.lat).toBeGreaterThan(40.75);
      expect(place.lat).toBeLessThan(40.85);
    });

    it("parses Edge Function discoveries payload from discoverNearby", async () => {
      const mockDiscovery: RawLiveDiscovery = {
        name: "The Hungarian Pastry Shop",
        discovery_type: "place",
        categories: ["coffee", "food"],
        description: "Classic cafe and bakery near Columbia.",
        address: "1030 Amsterdam Ave",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: 40.8037,
        longitude: -73.9634,
        start_time: null,
        end_time: null,
        source: "Live Discovery",
        source_url: "https://barnard.edu/hungarian-pastry-shop",
      };

      const fetcher = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          neighborhood: "Morningside Heights",
          count: 1,
          discoveries: [mockDiscovery],
        }),
      });
      vi.stubGlobal("fetch", fetcher);

      const result = await discoverNearby(40.808, -73.964, undefined, {
        neighborhood: "Morningside Heights",
        categories: ["coffee"],
      });

      expect(result.places).toHaveLength(1);
      expect(result.places[0].name).toBe("The Hungarian Pastry Shop");
      expect(result.places[0].category).toBe("cafe");
      expect(result.places[0].source).toBe("live-discovery");
    });
  });
});
