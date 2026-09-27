import { describe, expect, it } from "vitest";
import { passportPercent, passportRows } from "./agent";
import { boroughName, CITY_AREAS } from "./geo";
import { assembleFeed } from "./index";
import { NYC_OPEN_DATA, normalizeSnapshot, stableId } from "./openData";
import { STARTER_DISCOVERED_IDS, type BoroughId } from "./types";

const places = normalizeSnapshot();
const feed = assembleFeed(places, "snapshot");

describe("nyc open data snapshot", () => {
  it("draws from the city datasets and leaves landmarks out", () => {
    const details = new Set(places.map((place) => place.sourceDetail));
    expect(details).toEqual(
      new Set([
        "NYC Open Data · Farmers Markets",
        "NYC Open Data · Public art",
        "NYC Open Data · GreenThumb community gardens",
        "NYC Open Data · Libraries, museums, and community centers",
      ]),
    );
    expect(places.some((place) => place.category === "historic")).toBe(false);
    expect(places.some((place) => /landmark/i.test(place.sourceDetail))).toBe(false);
  });

  it("keeps the places the quests and passport already know", () => {
    for (const id of ["greenmarket", "gatehouse", "nypl", "roerich"]) {
      expect(places.some((place) => place.id === id)).toBe(true);
    }
  });

  it("does not treat Grant Shade Garden as the tomb", () => {
    const shade = places.find((place) => place.name.toLowerCase().includes("shade"));
    expect(shade?.category).toBe("garden");
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
    expect(places.filter((place) => place.id === "greenmarket")).toHaveLength(1);
  });

  it("covers Manhattan and the other four boroughs from every dataset", () => {
    const boroughs: BoroughId[] = ["manhattan", "brooklyn", "queens", "bronx", "staten-island"];
    for (const borough of boroughs) {
      const there = places.filter((place) => place.borough === borough);
      expect(there.length, boroughName(borough)).toBeGreaterThan(10);
      expect(new Set(there.map((place) => place.sourceDetail)).size).toBeGreaterThanOrEqual(3);
    }
    expect(places.filter((place) => place.borough === "manhattan").length).toBeGreaterThan(
      places.filter((place) => place.borough === "staten-island").length,
    );
    expect(CITY_AREAS.map((area) => area.id)).toContain("nyc");
  });
});

describe("assembled neighborhood feed", () => {
  it("mixes open data with saved guides and a quest for every place", () => {
    expect(feed.places.length).toBeGreaterThanOrEqual(15);
    expect(feed.places.some((place) => place.source === "nyc-open-data")).toBe(true);
    expect(feed.places.some((place) => place.source === "saved-guide")).toBe(true);
    expect(feed.places.some((place) => place.id === "book-culture")).toBe(true);
    expect(feed.questTemplates).toHaveLength(feed.places.length);
    for (const template of feed.questTemplates) {
      expect(feed.places.some((place) => place.id === template.discoveryId)).toBe(true);
    }
    expect(feed.questTemplates.find((template) => template.discoveryId === "greenmarket")?.id).toBe("quest-ingredient");
    expect(feed.places.some((place) => place.id === "cathedral" || place.id === "grants-tomb")).toBe(false);
  });

  it("still opens a new passport at 50%", () => {
    const rows = passportRows({ discoveredIds: [...STARTER_DISCOVERED_IDS] }, feed.places);
    expect(passportPercent(rows)).toBe(50);
  });

  it("names the city endpoints", () => {
    expect(Object.values(NYC_OPEN_DATA).sort()).toEqual(
      [
        "https://data.cityofnewyork.us/resource/8vwk-6iz2.json",
        "https://data.cityofnewyork.us/resource/2pg3-gcaa.json",
        "https://data.cityofnewyork.us/resource/p78i-pat6.json",
        "https://data.cityofnewyork.us/resource/ji82-xba5.json",
      ].sort(),
    );
  });
});

describe("stableId", () => {
  it("matches the known places and leaves the shade garden alone", () => {
    expect(stableId("Columbia Greenmarket")).toBe("greenmarket");
    expect(stableId("Grant Shade Garden- Grant Houses (NYCHA)")).toBeNull();
    expect(stableId("General Ulysses S. Grant Tomb")).toBeNull();
    expect(stableId("Cathedral Church of St. John the Divine")).toBeNull();
  });
});
