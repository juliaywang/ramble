import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverNearby, liveQuery, mergeLivePlaces, osmDiscovery } from "./liveDiscovery";
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
});
