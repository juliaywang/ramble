import type { BoroughId } from "./geo";

export type { BoroughId };

export const INTERESTS = [
  { id: "food", title: "Food", emoji: "🍜", blurb: "Markets, kitchens, late slices" },
  { id: "art", title: "Art", emoji: "🎨", blurb: "Murals, sculpture, small museums" },
  { id: "books", title: "Books", emoji: "📚", blurb: "Stacks, shops, quiet rooms" },
  { id: "gaming", title: "Gaming", emoji: "🎲", blurb: "Board games and open tables" },
  { id: "culture", title: "Culture", emoji: "🏛️", blurb: "Rooms with a point of view" },
  { id: "volunteering", title: "Volunteering", emoji: "🤝", blurb: "Shifts, mutual aid, showing up" },
  { id: "history", title: "History", emoji: "📜", blurb: "Stones, plaques, old stories" },
  { id: "coffee", title: "Coffee", emoji: "☕", blurb: "Independent cafés, long tables" },
  { id: "sustainability", title: "Sustainability", emoji: "🌱", blurb: "Gardens, markets, low waste" },
  { id: "music", title: "Music", emoji: "🎵", blurb: "Chapels, stages, student radio" },
  { id: "technology", title: "Technology", emoji: "💡", blurb: "Workshops, radio, making" },
] as const;

export type InterestId = (typeof INTERESTS)[number]["id"];

export const CATEGORIES = {
  bookstore: { label: "Bookstore", emoji: "📚", tint: "#efe2cf", ink: "#6b4a2e" },
  "farmers-market": { label: "Farmers market", emoji: "🥕", tint: "#e4f0d8", ink: "#2f5a28" },
  "food-donation": { label: "Food donation", emoji: "❤️", tint: "#fde4dc", ink: "#8d3a32" },
  cafe: { label: "Café", emoji: "☕", tint: "#f3e6d4", ink: "#6a4630" },
  gaming: { label: "Gaming", emoji: "🎲", tint: "#ece4f6", ink: "#4c3d78" },
  library: { label: "Library", emoji: "📖", tint: "#e4ebf4", ink: "#2c4668" },
  "public-art": { label: "Public art", emoji: "🎨", tint: "#f8e6f0", ink: "#7a3a62" },
  historic: { label: "Historic site", emoji: "🏛️", tint: "#eee6d6", ink: "#5c4a32" },
  park: { label: "Park", emoji: "🌳", tint: "#e3f0e4", ink: "#24523a" },
  garden: { label: "Community garden", emoji: "🌱", tint: "#e5f3df", ink: "#2d5a30" },
  museum: { label: "Museum", emoji: "🖼️", tint: "#f6ead8", ink: "#6d4c28" },
  music: { label: "Music", emoji: "🎵", tint: "#e7e4f8", ink: "#43386e" },
  culture: { label: "Cultural institution", emoji: "🕊️", tint: "#e6eef2", ink: "#2e4a58" },
  food: { label: "Local food", emoji: "🍜", tint: "#fdecd8", ink: "#7a4520" },
  market: { label: "Local market", emoji: "🧺", tint: "#f7ead6", ink: "#6d4a22" },
} as const;

export type CategoryId = keyof typeof CATEGORIES;

export const PASSPORT_CATEGORIES = [
  { id: "bookstore", label: "Bookstore" },
  { id: "cafe", label: "Café" },
  { id: "farmers-market", label: "Farmers Market" },
  { id: "cultural", label: "Cultural Organization" },
  { id: "historic", label: "Historic Site" },
  { id: "community-event", label: "Community Event" },
] as const;

export type PassportCategoryId = (typeof PASSPORT_CATEGORIES)[number]["id"];

export type DataSource = "nyc-open-data" | "live-discovery";

/**
 * Normalized place. NYC Open Data rows and Tavily results both land here
 * before the agent ranks them. `sourceDetail` names the dataset or query
 * a future adapter would have used.
 */
export type Discovery = {
  id: string;
  name: string;
  category: CategoryId;
  source: DataSource;
  sourceDetail: string;
  borough: BoroughId;
  lat: number;
  lng: number;
  address: string;
  hours: string;
  summary: string;
  about: string;
  tip: string;
  tags: InterestId[];
  passportCategory: PassportCategoryId | null;
};

export type Community = {
  id: string;
  name: string;
  kind: string;
  where: string;
  tags: InterestId[];
  pitch: string;
  about: string;
  discoveryId?: string;
};

export type QuestTemplate = {
  id: string;
  discoveryId: string;
  title: string;
  objective: string;
  visitMinutes: number;
  xp: number;
};

export type QuestDraft = {
  templateId: string;
  discoveryId: string;
  title: string;
  objective: string;
  visitMinutes: number;
  xp: number;
  why: string;
};

export type SavedQuest = QuestDraft & {
  teamBonus?: number;
  id: string;
  status: "active" | "completed";
  acceptedAt: string;
  completedAt?: string;
};

export type JourneyStop = {
  discoveryId: string;
  walkMinutes: number;
  dwellMinutes: number;
  why: string;
};

export type JourneyDuration = 30 | 60 | 90 | 120;

export type JourneyPlan = {
  duration: JourneyDuration;
  title: string;
  kicker: string;
  intro: string;
  totalMinutes: number;
  stops: JourneyStop[];
  signature: string;
  repeated: boolean;
  builtAt: string;
  startLabel?: string;
};

export type UserAccount = {
  id?: string;
  name: string;
  email: string;
  username: string;
  photo: string | null;
  bio: string;
  interests: InterestId[];
  discoveredIds: string[];
  savedIds: string[];
  quests: SavedQuest[];
  journey: JourneyPlan | null;
  createdAt: string;
};

export type FriendProfile = {
  id: string;
  username: string;
  name: string;
  bio: string;
  photo: string | null;
  interests: InterestId[];
  discoveredIds: string[];
  questsCount: number;
  passportPercent: number;
  createdAt?: string;
};

export type FriendshipStatus = "pending" | "accepted" | "declined";

export type FriendRequest = {
  id: string;
  userId: string;
  friendId: string;
  status: FriendshipStatus;
  createdAt: string;
  profile: FriendProfile;
};

export type FriendItem = {
  friendshipId: string;
  profile: FriendProfile;
  since: string;
};


export type RankedDiscovery = Discovery & {
  match: number;
  miles: number;
  minutes: number;
  why: string;
};

export type RankedCommunity = Community & {
  match: number;
  why: string;
};

export type PassportRow = {
  id: PassportCategoryId;
  label: string;
  done: boolean;
  placeName: string | null;
};

export const NEIGHBORHOOD = {
  id: "new-york-city",
  name: "New York City",
  city: "New York",
};

/** Places already in a new passport so the book opens at 50%, not zero. */
export const STARTER_DISCOVERED_IDS = ["book-culture", "hungarian", "greenmarket"] as const;

export const SOURCE_LABEL: Record<DataSource, string> = {
  "nyc-open-data": "Verified NYC Data",
  "live-discovery": "Live Discovery",
};
