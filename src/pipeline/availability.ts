import type { Discovery } from "./types";

export function availableForQuest(place: Pick<Discovery, "eventStart" | "eventEnd">, now = Date.now()) {
  if (!place.eventEnd) return true;
  return !!place.eventStart && Date.parse(place.eventStart) <= now && Date.parse(place.eventEnd) > now;
}
