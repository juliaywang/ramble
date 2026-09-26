import { COMMUNITIES } from "./communities";
import { DISCOVERIES } from "./feed";
import { loadOpenDataPlaces, normalizeSnapshot } from "./openData";
import { QUEST_TEMPLATES } from "./quests";
import type { Community, Discovery, QuestTemplate } from "./types";

export type NeighborhoodFeed = {
  places: Discovery[];
  questTemplates: QuestTemplate[];
  communities: Community[];
  /** "live" when at least one SODA dataset responded; otherwise the saved copy. */
  updatedFrom: "live" | "snapshot";
};

/**
 * NYC Open Data rows are normalized, then curated narrative is laid over the
 * places the prototype already knows. Cafés, parks, and live discoveries that
 * are not in these five datasets stay in the feed. Tavily is still the
 * Live Discovery label — that client is the next seam.
 */
export function assembleFeed(openPlaces: Discovery[], updatedFrom: NeighborhoodFeed["updatedFrom"]): NeighborhoodFeed {
  const byId = new Map<string, Discovery>();
  for (const place of openPlaces) byId.set(place.id, withCuratedCopy(place));
  for (const curated of DISCOVERIES) {
    if (!byId.has(curated.id)) byId.set(curated.id, curated);
  }
  const places = [...byId.values()];
  return {
    places,
    questTemplates: places.map(questForPlace),
    communities: COMMUNITIES,
    updatedFrom,
  };
}

function withCuratedCopy(place: Discovery): Discovery {
  const curated = DISCOVERIES.find((item) => item.id === place.id);
  if (!curated) return place;
  return {
    ...place,
    name: curated.name,
    summary: curated.summary,
    about: curated.about,
    tip: curated.tip,
    tags: curated.tags,
    category: curated.category,
    passportCategory: curated.passportCategory,
  };
}

function questForPlace(place: Discovery): QuestTemplate {
  const handcrafted = QUEST_TEMPLATES.find((template) => template.discoveryId === place.id);
  if (handcrafted) return handcrafted;
  const generated = GENERATED[place.category] ?? {
    title: `Stop at ${place.name}`,
    objective: `Go to ${place.name} and stay long enough to learn one thing you could not have learned from the sidewalk.`,
    visitMinutes: 20,
    xp: 35,
  };
  const objective = generated.objective.replaceAll("{name}", place.name);
  return {
    id: `quest-${place.id}`,
    discoveryId: place.id,
    title: generated.title,
    objective,
    visitMinutes: generated.visitMinutes,
    xp: generated.xp,
  };
}

const GENERATED: Partial<Record<Discovery["category"], { title: string; objective: string; visitMinutes: number; xp: number }>> = {
  "farmers-market": {
    title: "One ingredient you can't name",
    objective: "Walk {name} and find one ingredient you have never cooked with. Ask whoever is selling it how they would eat it this week.",
    visitMinutes: 25,
    xp: 40,
  },
  "public-art": {
    title: "One fact from the plaque",
    objective: "Find {name} and read one fact off the plaque before you take a photo.",
    visitMinutes: 20,
    xp: 30,
  },
  garden: {
    title: "See what's growing",
    objective: "Stop at {name} during posted hours and name three things that are growing. If the gate is locked, read the board and note the next open time.",
    visitMinutes: 20,
    xp: 40,
  },
  historic: {
    title: "Read the designation",
    objective: "Walk to {name} and find the landmark plaque or one detail that explains why the building is still here.",
    visitMinutes: 20,
    xp: 35,
  },
  library: {
    title: "Something you didn't search for",
    objective: "Leave {name} with one title you would not have searched for. A staff pick counts.",
    visitMinutes: 25,
    xp: 30,
  },
  museum: {
    title: "One room, slowly",
    objective: "Spend one room at {name} without rushing the next one. Note a single object you want to remember.",
    visitMinutes: 25,
    xp: 45,
  },
  culture: {
    title: "Read the bulletin board",
    objective: "Stop at {name} and read one posted program, class, or meeting. If the door is locked, the board still counts.",
    visitMinutes: 20,
    xp: 35,
  },
};

export function getNeighborhoodFeed(): NeighborhoodFeed {
  return assembleFeed(normalizeSnapshot(), "snapshot");
}

export async function fetchNeighborhoodFeed(): Promise<NeighborhoodFeed> {
  const live = await loadOpenDataPlaces();
  if (live.places.length === 0) return getNeighborhoodFeed();
  return assembleFeed(live.places, live.live ? "live" : "snapshot");
}

export function communityById(id: string) {
  return COMMUNITIES.find((community) => community.id === id);
}
