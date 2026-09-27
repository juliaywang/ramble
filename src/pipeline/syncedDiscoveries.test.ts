import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSyncedDiscoveries, preservePlaceIds, syncedPlace, type SyncedRow } from "./syncedDiscoveries";
import { getSupabaseClient } from "../lib/supabase";
import { availableForQuest } from "./availability";
vi.mock("../lib/supabase", () => ({ getSupabaseClient: vi.fn() }));
const base: SyncedRow = { source: "NYC Restaurants", external_id: "123", name: "Corner Cafe", discovery_type: "place", categories: ["food", "coffee"], description: "<p>Coffee &amp; pastries</p>", address: "12 Main St", neighborhood: null, borough: "Manhattan", latitude: "40.8", longitude: "-73.96", start_time: null, end_time: null, source_url: "https://example.org", last_synced_at: null };
afterEach(() => vi.resetAllMocks());
describe("synced discovery adapter", () => {
  it("maps sources into frontend categories and usable numeric coordinates", () => {
    expect(syncedPlace(base)).toMatchObject({ category: "cafe", tags: ["food", "coffee"], lat: 40.8, lng: -73.96, source: "nyc-open-data", summary: "Coffee & pastries", passportCategory: "cafe" });
    for (const [source, category] of [["NYC Libraries", "library"], ["NYC Public Art", "public-art"], ["NYC GreenThumb Gardens", "garden"], ["NYC Farmers Markets", "farmers-market"], ["NYC POPS", "park"], ["NYC Cultural Organizations", "culture"]]) {
      expect(syncedPlace({ ...base, source })?.category).toBe(category);
    }
  });
  it("keeps database identity stable and separates sources", () => {
    expect(syncedPlace({ ...base, name: "Renamed" })?.id).toBe(syncedPlace(base)?.id);
    expect(syncedPlace({ ...base, source: "NYC Libraries" })?.id).not.toBe(syncedPlace(base)?.id);
  });
  it("excludes missing coordinates, NULL names and unsafe links", () => {
    expect(syncedPlace({ ...base, latitude: null })).toBeNull();
    expect(syncedPlace({ ...base, latitude: "NULL" })).toBeNull();
    expect(syncedPlace({ ...base, latitude: 0 })).toBeNull();
    expect(syncedPlace({ ...base, name: "NULL" })).toBeNull();
    expect(syncedPlace({ ...base, source_url: "javascript:alert(1)" })?.sourceUrl).toBeUndefined();
  });
  it("shows upcoming events but only allows quest check-in during their scheduled time", () => {
    const row = { ...base, source: "NYC Parks", discovery_type: "event", start_time: "2026-10-01T14:00:00Z", end_time: "2026-10-01T16:00:00Z" };
    const before = Date.parse("2026-10-01T13:00:00Z");
    const event = syncedPlace(row, before)!;
    expect(event.passportCategory).toBe("community-event");
    expect(availableForQuest(event, before)).toBe(false);
    expect(availableForQuest(event, before + 2 * 3600000)).toBe(true);
    expect(syncedPlace(row, before + 3 * 3600000)).toBeNull();
  });
  it("preserves legacy IDs only for nearby matching places, never events", () => {
    const place = syncedPlace(base)!;
    const legacy = { ...place, id: "existing-cafe" };
    expect(preservePlaceIds([place], [legacy])[0].id).toBe(legacy.id);
    expect(preservePlaceIds([{ ...place, lat: 40.7 }], [legacy])[0].id).toBe(place.id);
    expect(preservePlaceIds([{ ...place, eventEnd: "2026-10-01" }], [legacy])[0].id).toBe(place.id);
  });
  it("loads beyond Supabase's first 1,000 rows", async () => {
    const range = vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, i) => ({ ...base, external_id: String(i) })), error: null }).mockResolvedValueOnce({ data: [{ ...base, external_id: "1000" }], error: null });
    const query = { select: vi.fn(), in: vi.fn(), order: vi.fn(), range };
    query.select.mockReturnValue(query); query.in.mockReturnValue(query); query.order.mockReturnValue(query);
    vi.mocked(getSupabaseClient).mockReturnValue({ from: () => query } as never);
    expect((await loadSyncedDiscoveries())?.places).toHaveLength(1001);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
  it("surfaces permission failures rather than reporting success", async () => {
    const query = { select: vi.fn(), in: vi.fn(), order: vi.fn(), range: vi.fn().mockResolvedValue({ data: null, error: { message: "Permission denied" } }) };
    query.select.mockReturnValue(query); query.in.mockReturnValue(query); query.order.mockReturnValue(query);
    vi.mocked(getSupabaseClient).mockReturnValue({ from: () => query } as never);
    await expect(loadSyncedDiscoveries()).rejects.toThrow("Permission denied");
  });
});
