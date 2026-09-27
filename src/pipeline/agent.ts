import { availableForQuest } from "./availability";
import { progression } from "./progression";
import { ANCHOR, distanceMiles, walkMinutes, type WalkStart } from "./geo";
import {
  CATEGORIES,
  INTERESTS,
  PASSPORT_CATEGORIES,
  type Community,
  type Discovery,
  type InterestId,
  type JourneyDuration,
  type JourneyPlan,
  type PassportCategoryId,
  type PassportRow,
  type QuestDraft,
  type QuestTemplate,
  type RankedCommunity,
  type RankedDiscovery,
  type UserAccount,
} from "./types";

type Person = Pick<UserAccount, "interests" | "discoveredIds" | "quests">;

const JOURNEY_TITLES: Record<JourneyDuration, string> = {
  30: "A quick ramble",
  60: "An hour around the neighborhood",
  90: "The long lunch",
  120: "An afternoon route",
};

function interestTitle(id: InterestId) {
  return INTERESTS.find((item) => item.id === id)?.title.toLowerCase() ?? id;
}

export function listPhrase(items: string[]) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function categoryLabel(place: Discovery) {
  return CATEGORIES[place.category].label;
}

export function passportLabel(id: PassportCategoryId) {
  return PASSPORT_CATEGORIES.find((row) => row.id === id)?.label ?? id;
}

export function overlap(interests: InterestId[], tags: InterestId[]) {
  return tags.filter((tag) => interests.includes(tag));
}

/** 58–98. Shared interests raise the match. A visitor with none still gets a fair baseline. */
export function matchScore(interests: InterestId[], tags: InterestId[]) {
  const hits = overlap(interests, tags).length;
  if (interests.length === 0) return 70;
  return Math.min(98, 58 + hits * 14 + (hits > 0 ? 4 : 0));
}

export function explainPlace(person: Person, place: Discovery, origin: WalkStart = ANCHOR): string {
  const hits = overlap(person.interests, place.tags).map(interestTitle);
  const minutes = walkMinutes(distanceMiles(origin, place));
  const located = `${place.summary} It's ${minutes} minutes from ${origin.label}.`;
  if (hits.length === 0) return located;
  return `Because you picked ${listPhrase(hits)}. ${located}`;
}

export function explainQuest(person: Person, place: Discovery, places: Discovery[], origin: WalkStart = ANCHOR): string {
  const hits = overlap(person.interests, place.tags).map(interestTitle);
  const minutes = walkMinutes(distanceMiles(origin, place));
  const gap =
    place.passportCategory !== null && !isCategoryStamped(person, place.passportCategory, places);
  const interestLine = hits.length
    ? `It fits ${listPhrase(hits)}.`
    : "It's a useful walk even a step outside the interests you picked.";
  const gapLine = gap
    ? `Your passport still needs ${passportLabel(place.passportCategory!)}.`
    : "You've started this kind of place already — this one goes deeper.";
  const source = place.source === "nyc-open-data" ? "Verified NYC data" : "A live discovery";
  return `${source}, ${minutes} minutes from ${origin.label}. ${interestLine} ${gapLine}`;
}

export function draftForPlace(
  person: Person,
  place: Discovery,
  templates: QuestTemplate[],
  places: Discovery[],
  origin: WalkStart = ANCHOR,
): QuestDraft {
  const template = templates.find((t) => t.discoveryId === place.id) ?? {
    id: `quest-${place.id}`,
    discoveryId: place.id,
    title: `Stop at ${place.name}`,
    objective: `Visit ${place.name} and learn one thing you could not have learned from the sidewalk.`,
    visitMinutes: 20,
    xp: 35,
  };
  return {
    templateId: template.id,
    discoveryId: place.id,
    title: template.title,
    objective: template.objective,
    visitMinutes: template.visitMinutes,
    xp: template.xp,
    why: explainQuest(person, place, places, origin),
  };
}


export function rankDiscoveries(person: Person, places: Discovery[], origin: WalkStart = ANCHOR): RankedDiscovery[] {
  const scored = places.map((place) => {
    const miles = distanceMiles(origin, place);
    const minutes = walkMinutes(miles);
    const match = matchScore(person.interests, place.tags);
    const discoveredBonus = person.discoveredIds.includes(place.id) ? 0 : 6;
    return {
      ranked: {
        ...place,
        match,
        miles,
        minutes,
        why: explainPlace(person, place, origin),
      } satisfies RankedDiscovery,
      sort: match + discoveredBonus - minutes * 0.25,
    };
  });
  scored.sort((a, b) => b.sort - a.sort || a.ranked.name.localeCompare(b.ranked.name));
  return scored.map((item) => item.ranked);
}

export function explainCommunity(person: Person, community: Community): string {
  const hits = overlap(person.interests, community.tags).map(interestTitle);
  if (hits.length === 0) {
    return `Nearby, even if it sits outside the interests you picked. ${community.pitch}`;
  }
  return `Because you picked ${listPhrase(hits)}. ${community.pitch}`;
}

export function rankCommunities(person: Person, communities: Community[]): RankedCommunity[] {
  return communities
    .map((community) => ({
      ...community,
      match: matchScore(person.interests, community.tags),
      why: explainCommunity(person, community),
    }))
    .sort((a, b) => b.match - a.match || a.name.localeCompare(b.name));
}

export function isCategoryStamped(
  person: Pick<Person, "discoveredIds">,
  category: PassportCategoryId,
  places: Discovery[],
) {
  return person.discoveredIds.some(
    (id) => places.find((place) => place.id === id)?.passportCategory === category,
  );
}

export function passportRows(person: Pick<Person, "discoveredIds">, places: Discovery[]): PassportRow[] {
  return PASSPORT_CATEGORIES.map((category) => {
    const place = places.find(
      (item) => item.passportCategory === category.id && person.discoveredIds.includes(item.id),
    );
    return {
      id: category.id,
      label: category.label,
      done: Boolean(place),
      placeName: place?.name ?? null,
    };
  });
}

export function passportPercent(rows: PassportRow[]) {
  if (rows.length === 0) return 0;
  return Math.round((rows.filter((row) => row.done).length / rows.length) * 100);
}

export function stampIsNew(
  person: Pick<Person, "discoveredIds">,
  category: PassportCategoryId,
  discoveryId: string,
  places: Discovery[],
) {
  const ids = person.discoveredIds.filter(
    (id) => places.find((place) => place.id === id)?.passportCategory === category,
  );
  return ids.length === 1 && ids[0] === discoveryId;
}

function takenTemplateIds(person: Person, avoid: string[]) {
  const taken = new Set(avoid);
  for (const quest of person.quests) {
    if (quest.status === "active" || quest.status === "completed") taken.add(quest.templateId);
  }
  return taken;
}

/**
 * Picks a nearby quest the account has not accepted.
 * Unstamped passport categories outrank a perfect interest match on a
 * category already in the book, so a finished quest moves exploration forward.
 */
export function rollSideQuest(
  person: Person,
  places: Discovery[],
  templates: QuestTemplate[],
  avoidTemplateIds: string[] = [],
  origin: WalkStart = ANCHOR,
): QuestDraft | null {
  const taken = takenTemplateIds(person, avoidTemplateIds);
  const byId = new Map(places.map(place => [place.id, place]));
  const stamped = new Set(person.discoveredIds.map(id => byId.get(id)?.passportCategory));
  const scored = templates
    .filter((template) => !taken.has(template.id))
    .flatMap((template) => {
      const place = byId.get(template.discoveryId);
      if (!place || !availableForQuest(place)) return [];
      const hits = overlap(person.interests, place.tags).length;
      const minutes = walkMinutes(distanceMiles(origin, place));
      const gap =
        place.passportCategory !== null && !stamped.has(place.passportCategory);
      const fresh = person.discoveredIds.includes(place.id) ? 0 : 8;
      const score = 36 + hits * 14 + (gap ? 42 : 0) + fresh - minutes * 0.45;
      return [{ template, place, score }];
    })
    .sort((a, b) => b.score - a.score || a.template.id.localeCompare(b.template.id));

  const best = scored[0];
  if (!best) return null;
  return {
    templateId: best.template.id,
    discoveryId: best.place.id,
    title: best.template.title,
    objective: best.template.objective,
    visitMinutes: best.template.visitMinutes,
    xp: best.template.xp,
    why: explainQuest(person, best.place, places, origin),
  };
}

function journeyScore(person: Person, place: Discovery, stamped: Set<PassportCategoryId | null | undefined>, origin: WalkStart) {
  const hits = overlap(person.interests, place.tags).length;
  const minutes = walkMinutes(distanceMiles(origin, place));
  const gap =
    place.passportCategory !== null && !stamped.has(place.passportCategory);
  const fresh = person.discoveredIds.includes(place.id) ? 0 : 8;
  return 24 + hits * 16 + (gap ? 10 : 0) + fresh - minutes * 0.4;
}

function chooseStops(ranked: Discovery[], stopCount: number, origin: WalkStart) {
  const picked: Discovery[] = [];
  const used = new Set<string>();
  const first = ranked[0];
  if (first) {
    picked.push(first);
    used.add(first.category);
  }
  for (const place of ranked) {
    if (picked.length >= stopCount) break;
    if (used.has(place.category) || picked.some((item) => item.id === place.id)) continue;
    picked.push(place);
    used.add(place.category);
  }
  for (const place of ranked) {
    if (picked.length >= stopCount) break;
    if (picked.some((item) => item.id === place.id)) continue;
    picked.push(place);
  }
  return orderByWalk(picked, origin);
}

/**
 * Threads a walkable multi-stop route. Category changes matter more than
 * stacking three versions of the same interest.
 */
export function buildJourney(
  person: Person,
  places: Discovery[],
  duration: JourneyDuration,
  avoidSignature?: string,
  builtAt = new Date().toISOString(),
  origin: WalkStart = ANCHOR,
): JourneyPlan {
  const stopCount = duration === 30 ? 1 : duration === 60 ? 2 : duration === 90 ? 3 : 4;
  const byId = new Map(places.map(place => [place.id, place]));
  const stamped = new Set(person.discoveredIds.map(id => byId.get(id)?.passportCategory));
  const scores = new Map(places.map(place => [place.id, journeyScore(person, place, stamped, origin)]));
  const ranked = places.filter(place => availableForQuest(place)).sort(
    (a, b) => scores.get(b.id)! - scores.get(a.id)! || a.id.localeCompare(b.id),
  );

  let ordered = chooseStops(ranked, stopCount, origin);
  let signature = ordered.map((place) => place.id).join(">");
  let repeated = false;
  if (avoidSignature && signature === avoidSignature && ranked[0]) {
    const alt = chooseStops(
      ranked.filter((place) => place.id !== ranked[0]?.id),
      stopCount,
      origin,
    );
    const altSignature = alt.map((place) => place.id).join(">");
    if (altSignature && altSignature !== signature) {
      ordered = alt;
      signature = altSignature;
    } else {
      repeated = true;
    }
  }

  const walks: number[] = [];
  let cursor: { lat: number; lng: number } = origin;
  for (const place of ordered) {
    walks.push(walkMinutes(distanceMiles(cursor, place)));
    cursor = place;
  }
  const walkSum = walks.reduce((sum, minutes) => sum + minutes, 0);
  const remaining = Math.max(ordered.length * 10, duration - walkSum);
  const dwellEach = Math.min(40, Math.max(10, Math.round(remaining / Math.max(1, ordered.length))));

  const stops = ordered.map((place, index) => {
    const hits = overlap(person.interests, place.tags).map(interestTitle);
    const why = hits.length
      ? `${categoryLabel(place)}. Matches ${listPhrase(hits)}.`
      : `${categoryLabel(place)}. A change of pace on the route.`;
    return {
      discoveryId: place.id,
      walkMinutes: walks[index] ?? 0,
      dwellMinutes: dwellEach,
      why,
    };
  });

  const totalMinutes = stops.reduce((sum, stop) => sum + stop.walkMinutes + stop.dwellMinutes, 0);
  const kicker = ordered.map((place) => categoryLabel(place)).join(" → ");
  const interestNames = listPhrase(
    [...new Set(ordered.flatMap((place) => overlap(person.interests, place.tags)))].map(interestTitle),
  );
  const intro = interestNames
    ? `Built around ${interestNames}, using verified NYC places and live discoveries within a short walk of ${origin.label}. About ${totalMinutes} minutes with the stops included.`
    : `A walk threaded from ${origin.label} through nearby verified places and live discoveries. About ${totalMinutes} minutes with the stops included.`;

  return {
    duration,
    title: JOURNEY_TITLES[duration],
    kicker: kicker || "A turn through the neighborhood",
    intro,
    totalMinutes,
    stops,
    signature,
    repeated,
    builtAt,
    startLabel: origin.label,
  };
}

function orderByWalk(places: Discovery[], origin: WalkStart) {
  const remaining = [...places];
  const ordered: Discovery[] = [];
  let cursor: { lat: number; lng: number } = origin;
  while (remaining.length) {
    remaining.sort(
      (a, b) => distanceMiles(cursor, a) - distanceMiles(cursor, b) || a.id.localeCompare(b.id),
    );
    const next = remaining.shift();
    if (!next) break;
    ordered.push(next);
    cursor = next;
  }
  return ordered;
}

export function totalXp(quests: UserAccount["quests"]) {
  return progression(quests).total;
}
