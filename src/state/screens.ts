import type { JourneyDuration, PassportCategoryId, QuestDraft } from "../pipeline/types";

export type TabName = "explore" | "quests" | "journey" | "passport";

export type Screen =
  | { name: "welcome" }
  | { name: "signup" }
  | { name: "interests"; mode: "onboarding" | "edit" }
  | { name: "explore" }
  | { name: "place"; id: string }
  | { name: "community"; id: string }
  | { name: "quests"; highlightId?: string }
  | { name: "generating-quest"; avoid: string[] }
  | { name: "quest-offer"; draft: QuestDraft; avoid: string[] }
  | { name: "quest"; id: string }
  | { name: "quest-complete"; questId: string }
  | { name: "quest-empty" }
  | { name: "journey" }
  | { name: "generating-journey"; duration: JourneyDuration; avoid?: string }
  | { name: "passport"; highlight?: PassportCategoryId }
  | { name: "profile" }
  | { name: "settings" }
  | { name: "info" };

export function isTab(screen: Screen): screen is { name: TabName } {
  return (
    screen.name === "explore" ||
    screen.name === "quests" ||
    screen.name === "journey" ||
    screen.name === "passport"
  );
}

export function tabOf(screen: Screen): TabName | null {
  if (screen.name === "explore" || screen.name === "place" || screen.name === "community") return "explore";
  if (
    screen.name === "quests" ||
    screen.name === "generating-quest" ||
    screen.name === "quest-offer" ||
    screen.name === "quest" ||
    screen.name === "quest-complete" ||
    screen.name === "quest-empty"
  ) {
    return "quests";
  }
  if (screen.name === "journey" || screen.name === "generating-journey") return "journey";
  if (screen.name === "passport") return "passport";
  return null;
}

export function screenKey(screen: Screen) {
  switch (screen.name) {
    case "place":
    case "community":
    case "quest":
      return `${screen.name}:${screen.id}`;
    case "quest-complete":
      return `done:${screen.questId}`;
    case "quest-offer":
      return `offer:${screen.draft.templateId}:${screen.avoid.join(",")}`;
    case "generating-quest":
      return `genq:${screen.avoid.join(",")}`;
    case "generating-journey":
      return `genj:${screen.duration}:${screen.avoid ?? ""}`;
    case "interests":
      return `interests:${screen.mode}`;
    case "quests":
      return `quests:${screen.highlightId ?? ""}`;
    case "passport":
      return `passport:${screen.highlight ?? ""}`;
    default:
      return screen.name;
  }
}
