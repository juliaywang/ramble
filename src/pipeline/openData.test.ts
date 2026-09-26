import { describe, expect, it } from "vitest";
import { passportPercent, passportRows } from "./agent";
import { assembleFeed } from "./index";
import { NYC_OPEN_DATA, normalizeSnapshot, stableId } from "./openData";
import { STARTER_DISCOVERED_IDS } from "./types";

const places = normalizeSnapshot();
const feed = assembleFeed(places, "snapshot");

describe("nyc open data snapshot", () => {
  it("draws from all five datasets", () => {
    const details = new Set(places.map((place) => place.sourceDetail));
    expect(details).toEqual(
      new Set([
        "NYC Open Data · Farmers Markets",
        "NYC Open Data · Public art",
        "NYC Open Data · GreenThumb community gardens",
        "NYC Open Data · Individual landmarks",
        "NYC Open Data · Libraries, museums, and community centers",
      ]),
    );
  });

  it("keeps the places the quests and passport already know", () => {
    for (const id of ["greenmarket", "gatehouse", "nypl", "roerich", "cathedral", "grants-tomb", "riverside-church"]) {
      expect(places.some((place) => place.id === id)).toBe(true);
    }
    expect(places.filter((place) => place.id === "grants-tomb")).toHaveLength(1);
  });

  it("does not treat Grant Shade Garden as the tomb", () => {
    const shade = places.find((place) => place.name.toLowerCase().includes("shade"));
    expect(shade?.category).toBe("garden");
    expect(shade?.id).not.toBe("grants-tomb");
  });

  it("keeps both Frederick Douglass works", () => {
    const douglass = places.filter((place) => place.name.toLowerCase().includes("douglass"));
    expect(douglass.length).toBeGreaterThanOrEqual(2);
    expect(new Set(douglass.map((place) => place.id)).size).toBe(douglass.length);
  });

  it("skips the miscellaneous Grant TA USE row", () => {
    expect(places.some((place) => place.address.includes("3170"))).toBe(false);
  });

  it("dedupes the greenmarket down to the newest listing", () => {
    const market = places.find((place) => place.id === "greenmarket");
    expect(market?.hours.toLowerCase()).toContain("thursday");
    expect(market?.address.toLowerCase()).toContain("broadway");
    expect(places.filter((place) => place.category === "farmers-market").length).toBeLessThan(8);
  });
});

describe("assembled neighborhood feed", () => {
  it("mixes open data with live discoveries and a quest for every place", () => {
    expect(feed.places.length).toBeGreaterThanOrEqual(15);
    expect(feed.places.some((place) => place.source === "nyc-open-data")).toBe(true);
    expect(feed.places.some((place) => place.source === "live-discovery")).toBe(true);
    expect(feed.places.some((place) => place.id === "book-culture")).toBe(true);
    expect(feed.questTemplates).toHaveLength(feed.places.length);
    for (const template of feed.questTemplates) {
      expect(feed.places.some((place) => place.id === template.discoveryId)).toBe(true);
    }
    expect(feed.questTemplates.find((template) => template.discoveryId === "greenmarket")?.id).toBe("quest-ingredient");
  });

  it("still opens a new passport at 50%", () => {
    const rows = passportRows({ discoveredIds: [...STARTER_DISCOVERED_IDS] }, feed.places);
    expect(passportPercent(rows)).toBe(50);
  });

  it("names the five city endpoints", () => {
    expect(Object.values(NYC_OPEN_DATA).sort()).toEqual(
      [
        "https://data.cityofnewyork.us/resource/8vwk-6iz2.json",
        "https://data.cityofnewyork.us/resource/2pg3-gcaa.json",
        "https://data.cityofnewyork.us/resource/p78i-pat6.json",
        "https://data.cityofnewyork.us/resource/buis-pvji.json",
        "https://data.cityofnewyork.us/resource/ji82-xba5.json",
      ].sort(),
    );
  });
});

describe("stableId", () => {
  it("matches the known places and leaves the shade garden alone", () => {
    expect(stableId("Columbia Greenmarket")).toBe("greenmarket");
    expect(stableId("Grant Shade Garden- Grant Houses (NYCHA)")).toBeNull();
    expect(stableId("General Ulysses S. Grant Tomb")).toBe("grants-tomb");
    expect(stableId("Grant's Tomb Flagstaff")).toBe("grants-tomb");
  });
});
