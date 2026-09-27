import type { CategoryId } from "../pipeline/types";
import type { ReactNode } from "react";

export type IconName =
  | "arrow"
  | "book"
  | "briefcase"
  | "building"
  | "calendar"
  | "check"
  | "chevron"
  | "clock"
  | "coffee"
  | "compass"
  | "dice"
  | "heart"
  | "home"
  | "leaf"
  | "locate"
  | "map"
  | "music"
  | "palette"
  | "pin"
  | "route"
  | "search"
  | "sparkles"
  | "star"
  | "user"
  | "users"
  | "x";

const iconPaths: Record<IconName, ReactNode> = {
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
  building: <><path d="M4 21h16M6 21V7l6-4 6 4v14M9 10h1M14 10h1M9 14h1M14 14h1M10 21v-3h4v3" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  coffee: <><path d="M4 8h13v6a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V8Z" /><path d="M17 10h1a3 3 0 0 1 0 6h-2M7 4h8" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
  dice: <><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r=".75" fill="currentColor" /><circle cx="16" cy="8" r=".75" fill="currentColor" /><circle cx="12" cy="12" r=".75" fill="currentColor" /><circle cx="8" cy="16" r=".75" fill="currentColor" /><circle cx="16" cy="16" r=".75" fill="currentColor" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10M9 21v-6h6v6" /></>,
  leaf: <><path d="M20 4c-8 0-14 3-14 9a5 5 0 0 0 5 5c6 0 9-6 9-14Z" /><path d="M4 21c2-5 6-9 12-12" /></>,
  locate: <polygon points="3 11 22 2 13 21 11 13 3 11" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></>,
  music: <><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></>,
  palette: <>
    <path d="M12 3C6.5 3 3 6.8 3 12a9 9 0 0 0 9 9h1.2a2.3 2.3 0 0 0 1.7-3.8 1.6 1.6 0 0 1 1.2-2.7H18c2 0 3-1.6 3-3.5C21 6.5 17 3 12 3Z" />
    <circle cx="7" cy="10" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="10.5" cy="6.8" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="15.2" cy="7" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="18" cy="10.5" r="1.25" fill="currentColor" stroke="none" />
    <ellipse cx="8.5" cy="15.5" rx="1.5" ry="2" transform="rotate(-30 8.5 15.5)" />
  </>,
  pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  route: <><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h3a3 3 0 0 0 3-3v-1a3 3 0 0 0-3-3h-1a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  sparkles: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14ZM19 13l.7 1.3L21 15l-1.3.7L19 17l-.7-1.3L17 15l1.3-.7L19 13Z" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 4a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5" /></>,
  x: <path d="m6 6 12 12M18 6 6 18" />,
};

export function DesignIcon({ name, size = "md", filled = false }: { name: IconName; size?: "sm" | "md" | "lg"; filled?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width={size === "sm" ? 16 : size === "lg" ? 28 : 20}
      height={size === "sm" ? 16 : size === "lg" ? 28 : 20}
      fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  );
}


export const categoryIcons: Record<string, IconName> = {
  bookstore: "book", "farmers-market": "leaf", "food-donation": "heart",
  cafe: "coffee", gaming: "dice", library: "book", "public-art": "palette",
  historic: "building", park: "leaf", garden: "leaf", museum: "palette",
  music: "music", culture: "building", food: "coffee", market: "leaf",
};

// Shared across map pins, discovery cards, and quest destinations.
export const categoryColors: Record<CategoryId, string> = {
  bookstore: "#94642f", library: "#94642f",
  "farmers-market": "#b45b32", food: "#b45b32", market: "#b45b32",
  cafe: "#805044", gaming: "#5266a8",
  "public-art": "#bf4845", museum: "#bf4845",
  historic: "#397f91", culture: "#397f91",
  park: "#4d7a59", garden: "#4d7a59",
  music: "#7953a3", "food-donation": "#ad4854",
};
