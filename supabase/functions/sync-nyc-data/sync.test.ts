import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanNYCValue, deterministicId, fetchSocrata, upsertDiscoveries, type SupabaseClient } from "./helpers.ts";
import { communityGarden, culturalOrganization, farmersMarket, library, pops, restaurant, restaurantDiscoveries, RESTAURANT_QUERY } from "./places.ts";

afterEach(() => vi.unstubAllGlobals());
const coords = { latitude: "40.75", longitude: "-73.98" };
const base = { camis: "123", dba: "NEIGHBORHOOD CAFE", boro: "Manhattan", building: "12", street: "WEST 30 STREET", zipcode: "10001", cuisine_description: "Coffee/Tea", ...coords };

describe("dataset-specific mappings", () => {
  it("cleans missing values and keeps deterministic identities stable", () => {
    expect(cleanNYCValue(" NULL ")).toBeNull();
    expect(cleanNYCValue("  ")).toBeNull();
    expect(deterministicId("x", [" A   B ", "12 St"])).toBe(deterministicId("x", ["a b", "12 st"]));
    expect(deterministicId("x", ["a-b", "c"])).not.toBe(deterministicId("x", ["a", "b-c"]));
  });
  it("maps GreenThumb field names, IDs and borough codes", () => {
    expect(communityGarden({ gardenname: "Garden", parksid: "XGT095", borough: "X", lat: "40.9", lon: "-73.86" })).toMatchObject({ external_id: "XGT095", borough: "Bronx", latitude: 40.9, categories: ["sustainability", "culture"], start_time: null, end_time: null });
    expect(communityGarden({ gardenname: "Garden", lat: "NULL", lon: "-73.86" })).toBeNull();
  });
  it("keeps address-only cultural organizations without inventing coordinates", () => {
    const row = culturalOrganization({ organization_name: "Music and Arts Center", address: "12 Main St", borough: "Queens", discipline: "Music" });
    expect(row).toMatchObject({ latitude: null, longitude: null, categories: ["culture", "art", "music"] });
    expect(culturalOrganization({ organization_name: "No address", borough: "Queens" })).toBeNull();
  });
  it("reads library GeoJSON in longitude/latitude order and does not use BIN as a branch ID", () => {
    const row = { name: "Library", system: "NYPL", bin: "123", housenum: "203", streetname: "W 115 St", borocode: "1", the_geom: { type: "Point", coordinates: [-73.95, 40.8] } };
    expect(library(row)).toMatchObject({ latitude: 40.8, longitude: -73.95, borough: "Manhattan", categories: ["books", "culture", "technology"] });
    expect(library(row)?.external_id).not.toBe(library({ ...row, name: "Another branch" })?.external_id);
  });
  it("keeps farmers market identity stable across annual refreshes", () => {
    const row = { marketname: "Market", streetaddress: "Main St", borough: "Brooklyn", ...coords };
    expect(farmersMarket({ ...row, year: "2025" })?.external_id).toBe(farmersMarket({ ...row, year: "2026" })?.external_id);
    expect(farmersMarket(row)).toMatchObject({ categories: ["food", "sustainability"], start_time: null, end_time: null });
  });
  it("uses POPS number and derives a useful name when the building name is NULL", () => {
    expect(pops({ pops_number: "M001", building_name: "NULL", address_number: "12", street_name: "MAIN ST", ...coords })).toMatchObject({ external_id: "M001", name: "Public space at 12 MAIN ST", categories: ["culture"] });
  });
  it("keeps one latest useful restaurant tuple per CAMIS without inspection violations", () => {
    const rows = restaurantDiscoveries([
      { ...base, dba: "Old name", latest_inspection_date: "2024-01-01" },
      { ...base, latest_inspection_date: "2026-01-01", violation_description: "Do not import" },
      { ...base, dba: "NULL", latest_inspection_date: "2026-02-01" },
      { ...base, latest_inspection_date: "2026-01-01" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ external_id: "123", name: base.dba, address: "12 WEST 30 STREET, 10001", categories: ["food", "coffee"] });
    expect(JSON.stringify(rows)).not.toContain("Do not import");
    expect(restaurant({ ...base, dba: "Pizza", cuisine_description: "Pizza", latitude: "0" })).toBeNull();
    expect(restaurant({ ...base, dba: "Pizza", cuisine_description: "Pizza" })?.categories).toEqual(["food"]);
    expect(restaurant({ ...base, dba: "Corner Café", cuisine_description: "French" })?.categories).toEqual(["food", "coffee"]);
    expect(RESTAURANT_QUERY.$group).toContain("camis");
    expect(RESTAURANT_QUERY.$select).not.toContain("violation");
  });
});

describe("shared transport helpers", () => {
  it("paginates with deterministic ordering, including a final empty page", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [{ id: 1 }, { id: 2 }] }).mockResolvedValueOnce({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchSocrata("example", "Test source", {}, 2)).toHaveLength(2);
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get("$offset")).toBe("2");
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("$order")).toBe(":id");
  });
  it("identifies failed sources and does not treat an error as an empty dataset", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, statusText: "Rate limited" }));
    await expect(fetchSocrata("dataset", "Libraries")).rejects.toThrow("Libraries API (dataset), offset 0: HTTP 429");
  });
  it("deduplicates globally before batching upserts and skips empty requests", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn(() => ({ upsert })) } as unknown as SupabaseClient;
    const row = restaurant(base)!;
    const rows = Array.from({ length: 501 }, (_, i) => ({ ...row, external_id: String(i) }));
    expect(await upsertDiscoveries(client, "Restaurants", [...rows, rows[0]])).toBe(501);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[0][0]).toHaveLength(500);
    expect(upsert.mock.calls[1][0]).toHaveLength(1);
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: "source,external_id" });
    await upsertDiscoveries(client, "Restaurants", []);
    expect(upsert).toHaveBeenCalledTimes(2);
  });
});
