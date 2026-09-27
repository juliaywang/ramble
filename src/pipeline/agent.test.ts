import { describe, expect, it } from "vitest";
import {
  buildJourney,
  draftForPlace,
  matchScore,
  passportPercent,
  passportRows,
  rollSideQuest,
} from "./agent";
import { DISCOVERIES } from "./feed";
import { ANCHOR, distanceMiles, withinWalk } from "./geo";
import { assembleFeed } from "./index";
import { normalizeSnapshot } from "./openData";
import { QUEST_TEMPLATES } from "./quests";
import { STARTER_DISCOVERED_IDS, type InterestId, type UserAccount } from "./types";

function person(interests: InterestId[], discoveredIds: string[] = [...STARTER_DISCOVERED_IDS]): Pick<
  UserAccount,
  "interests" | "discoveredIds" | "quests"
> {
  return { interests, discoveredIds, quests: [] };
}

describe("neighborhood feed", () => {
  it("loads a Morningside Heights fixture large enough to explore", () => {
    const feed = assembleFeed(normalizeSnapshot(), "snapshot");
    expect(feed.places.length).toBeGreaterThanOrEqual(15);
    expect(feed.questTemplates.length).toBe(feed.places.length);
    for (const template of feed.questTemplates) {
      expect(feed.places.some((place) => place.id === template.discoveryId)).toBe(true);
    }
    const sources = new Set(feed.places.map((place) => place.source));
    expect(sources.has("nyc-open-data")).toBe(true);
    expect(sources.has("live-discovery")).toBe(true);
  });
});

describe("passport", () => {
  it("opens a new account at 50% with bookstore, café, and farmers market", () => {
    const rows = passportRows(person(["books", "coffee", "food"]), DISCOVERIES);
    expect(passportPercent(rows)).toBe(50);
    expect(rows.filter((row) => row.done).map((row) => row.id).sort()).toEqual([
      "bookstore",
      "cafe",
      "farmers-market",
    ]);
  });
});

describe("side quests", () => {
  it("sends a food-and-books account toward a passport gap", () => {
    const draft = rollSideQuest(person(["food", "coffee", "books"]), DISCOVERIES, QUEST_TEMPLATES);
    expect(draft).not.toBeNull();
    const place = DISCOVERIES.find((item) => item.id === draft?.discoveryId);
    expect(["cultural", "historic", "community-event"]).toContain(place?.passportCategory);
  });

  it("does not repeat a completed quest", () => {
    const first = rollSideQuest(person(["art", "history"]), DISCOVERIES, QUEST_TEMPLATES);
    expect(first).not.toBeNull();
    const again = rollSideQuest(
      {
        interests: ["art", "history"],
        discoveredIds: [...STARTER_DISCOVERED_IDS],
        quests: [
          {
            ...first!,
            id: "q1",
            status: "completed",
            acceptedAt: "2026-09-26T12:00:00.000Z",
            completedAt: "2026-09-26T13:00:00.000Z",
          },
        ],
      },
      DISCOVERIES,
      QUEST_TEMPLATES,
    );
    expect(again?.templateId).not.toBe(first?.templateId);
  });

  it("ranks a shared interest above a miss", () => {
    expect(matchScore(["art"], ["art", "history"])).toBeGreaterThan(matchScore(["food"], ["art", "history"]));
  });

  it("builds a tailored quest draft for any place", () => {
    const place = DISCOVERIES.find((p) => p.id === "hungarian")!;
    const draft = draftForPlace(person(["coffee", "books"]), place, QUEST_TEMPLATES, DISCOVERIES);
    expect(draft.discoveryId).toBe("hungarian");
    expect(draft.title).toBeTruthy();
    expect(draft.objective).toBeTruthy();
    expect(draft.xp).toBeGreaterThan(0);
    expect(draft.why).toContain("coffee");
  });
});

describe("journeys", () => {
  it("builds a three-stop walk for 90 minutes", () => {
    const plan = buildJourney(
      person(["books", "food", "art"]),
      DISCOVERIES,
      90,
      undefined,
      "2026-09-26T15:00:00.000Z",
    );
    expect(plan.stops).toHaveLength(3);
    const categories = plan.stops.map(
      (stop) => DISCOVERIES.find((place) => place.id === stop.discoveryId)?.category,
    );
    expect(new Set(categories).size).toBe(3);
    expect(plan.totalMinutes).toBeGreaterThan(70);
    expect(plan.totalMinutes).toBeLessThan(120);
    expect(plan.kicker).toContain("→");
  });

  it("can roll a different route", () => {
    const first = buildJourney(person(["art", "music", "history"]), DISCOVERIES, 90, undefined, "t");
    const second = buildJourney(person(["art", "music", "history"]), DISCOVERIES, 90, first.signature, "t");
    expect(second.signature).not.toBe(first.signature);
  });
});

describe("distances", () => {
  it("puts Sakura Park farther from College Walk than the greenmarket", () => {
    const market = DISCOVERIES.find((place) => place.id === "greenmarket");
    const park = DISCOVERIES.find((place) => place.id === "sakura");
    expect(market && park).toBeTruthy();
    expect(distanceMiles(ANCHOR, park!)).toBeGreaterThan(distanceMiles(ANCHOR, market!));
  });

  it("keeps a walk inside a short radius of the start", () => {
    const near = withinWalk(DISCOVERIES, ANCHOR);
    expect(near.length).toBeGreaterThanOrEqual(4);
    const farthest = Math.max(...near.map((place) => distanceMiles(ANCHOR, place)));
    const tight = DISCOVERIES.filter((place) => distanceMiles(ANCHOR, place) <= 1.25);
    expect(farthest).toBeLessThanOrEqual(tight.length >= 4 ? 1.25 : 5);
  });
});
