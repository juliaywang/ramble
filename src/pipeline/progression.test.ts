import { describe, expect, it } from "vitest";
import { levelAt, progression } from "./progression";
import { totalXp } from "./agent";
import type { SavedQuest } from "./types";

function quest(id: number, discoveryId = String(id)): SavedQuest {
  return { id: String(id), discoveryId, templateId: String(id), title: "Walk", objective: "Explore",
    visitMinutes: 15, xp: 40, why: "", status: "completed",
    acceptedAt: "2026-01-01T00:00:00Z", completedAt: new Date(Date.UTC(2026, 0, id)).toISOString() };
}

describe("XP progression", () => {
  it("uses increasing level thresholds without resetting total XP", () => {
    expect(levelAt(0)).toMatchObject({ level: 1, remaining: 150 });
    expect(levelAt(149)).toMatchObject({ level: 1, remaining: 1 });
    expect(levelAt(150)).toMatchObject({ level: 2, earned: 0, required: 200 });
    expect(levelAt(350)).toMatchObject({ level: 3, required: 250 });
    expect(levelAt(600)).toMatchObject({ level: 4, earned: 0 });
    expect(levelAt(-10).level).toBe(1);
  });
  it("credits existing quests and excludes active quests", () => {
    const quests = [quest(1), { ...quest(2), status: "active" as const }];
    expect(progression(quests).total).toBe(85);
    expect(totalXp(quests)).toBe(85);
  });
  it("awards destinations and milestones only once and ignores duplicate IDs", () => {
    const quests = Array.from({ length: 5 }, (_, i) => quest(i + 1, "same-place"));
    const p = progression([...quests, quests[0]]);
    expect(p.total).toBe(200 + 20 + 25 + 75);
    expect(p.rewards["5"]).toMatchObject({ base: 40, destination: 0, milestone: 75 });
    expect(p.nextMilestone?.count).toBe(10);
  });
  it("keeps historical reward breakdown stable regardless of array order", () => {
    const quests = [quest(1), quest(2), quest(3)];
    expect(progression(quests)).toEqual(progression([...quests].reverse()));
    expect(progression(quests).rewards["3"]).toMatchObject({ levelBefore: 1, levelAfter: 2 });
  });
});
