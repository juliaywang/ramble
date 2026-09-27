import type { SavedQuest } from "./types";

export const MILESTONES = [
  { count: 1, xp: 25, title: "First steps" },
  { count: 5, xp: 75, title: "Finding your stride" },
  { count: 10, xp: 150, title: "Regular rambler" },
  { count: 25, xp: 300, title: "City explorer" },
  { count: 50, xp: 600, title: "Local legend" },
  { count: 100, xp: 1200, title: "Hundred adventures" },
] as const;

// Each level costs 50 XP more than the previous one: 150, 200, 250...
export function levelAt(xp: number) {
  const total = Math.max(0, Number.isFinite(xp) ? Math.floor(xp) : 0);
  const completedLevels = Math.floor((Math.sqrt(625 + 4 * total) - 25) / 10);
  const floor = 25 * completedLevels * completedLevels + 125 * completedLevels;
  const required = 150 + completedLevels * 50;
  const level = completedLevels + 1;
  const title = level >= 20 ? "City legend" : level >= 10 ? "Trailblazer" : level >= 5 ? "Explorer" : level >= 3 ? "Wanderer" : "New rambler";
  return { level, title, total, earned: total - floor, required, remaining: required - (total - floor) };
}

export function progression(quests: SavedQuest[]) {
  const seenIds = new Set<string>();
  const places = new Set<string>();
  let total = 0;
  let count = 0;
  const rewards: Record<string, { base: number; destination: number; milestone: number; total: number; levelBefore: number; levelAfter: number }> = {};
  const completed = quests.filter(q => q.status === "completed")
    .sort((a, b) => (a.completedAt ?? a.acceptedAt).localeCompare(b.completedAt ?? b.acceptedAt) || a.id.localeCompare(b.id));
  for (const quest of completed) {
    if (seenIds.has(quest.id)) continue;
    seenIds.add(quest.id);
    count++;
    const base = Number.isFinite(quest.xp) ? Math.max(0, Math.floor(quest.xp)) : 0;
    const destination = places.has(quest.discoveryId) ? 0 : 20;
    places.add(quest.discoveryId);
    const milestone = MILESTONES.find(m => m.count === count)?.xp ?? 0;
    const reward = base + destination + milestone;
    const levelBefore = levelAt(total).level;
    total += reward;
    rewards[quest.id] = { base, destination, milestone, total: reward, levelBefore, levelAfter: levelAt(total).level };
  }
  return { ...levelAt(total), count, destinations: places.size, rewards, nextMilestone: MILESTONES.find(m => m.count > count) };
}
