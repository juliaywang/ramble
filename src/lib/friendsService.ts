import { getSupabaseClient } from "./supabase";
import { passportPercent, passportRows } from "../pipeline/agent";
import type { Discovery, FriendItem, FriendProfile, FriendRequest, InterestId, UserAccount } from "../pipeline/types";

const LOCAL_STORE_KEY = "ramble.friends.mock.v1";

type MockStore = {
  profiles: FriendProfile[];
  friendships: {
    id: string;
    userId: string;
    friendId: string;
    status: "pending" | "accepted" | "declined";
    createdAt: string;
    updatedAt: string;
  }[];
};

const DEFAULT_MOCK_PROFILES: FriendProfile[] = [
  {
    id: "usr_mayawalks",
    username: "mayawalks",
    name: "Maya Chen",
    bio: "Coffee enthusiast & weekend mural hunter in Bushwick and Morningside.",
    photo: null,
    interests: ["coffee", "art", "books", "food"],
    discoveredIds: ["book-culture", "hungarian", "greenmarket", "hex-and-co", "peace-fountain"],
    questsCount: 8,
    passportPercent: 83,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: "usr_marcus_nyc",
    username: "marcus_nyc",
    name: "Marcus Rivera",
    bio: "Community organizer, local historian, and board game lover in Upper Manhattan.",
    photo: null,
    interests: ["history", "gaming", "culture", "volunteering"],
    discoveredIds: ["ford-hall", "greenmarket", "st-john-the-divine", "grant-tomb"],
    questsCount: 5,
    passportPercent: 67,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: "usr_elenarambles",
    username: "elenarambles",
    name: "Elena Rostova",
    bio: "Plant lover, botanical explorer, and community garden caretaker.",
    photo: null,
    interests: ["sustainability", "art", "music", "coffee"],
    discoveredIds: ["book-culture", "greenmarket", "riverside-church", "sakura-park", "morningside-park"],
    questsCount: 12,
    passportPercent: 100,
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: "usr_jordanr",
    username: "jordanr",
    name: "Jordan Reed",
    bio: "Student radio producer and jazz listener roaming Harlem and the Village.",
    photo: null,
    interests: ["music", "coffee", "technology", "food"],
    discoveredIds: ["hungarian", "columbia-radio", "miller-theatre", "greenmarket"],
    questsCount: 4,
    passportPercent: 50,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
];

function getMockStore(): MockStore {
  try {
    const raw = localStorage.getItem(LOCAL_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockStore;
      if (Array.isArray(parsed.profiles) && Array.isArray(parsed.friendships)) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse error and re-initialize
  }

  const initial: MockStore = {
    profiles: [...DEFAULT_MOCK_PROFILES],
    friendships: [
      // Pre-seed a pending request from Maya Chen and an accepted friend Marcus Rivera
      {
        id: "mock_req_maya",
        userId: "usr_mayawalks",
        friendId: "current_user", // Will be mapped to active user id
        status: "pending",
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
    ],
  };
  saveMockStore(initial);
  return initial;
}

function saveMockStore(store: MockStore) {
  try {
    localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(store));
  } catch {
    // Storage quota or private mode failure
  }
}

export function getUserId(user: UserAccount): string {
  return user.id || `usr_${user.username}`;
}

export function getMutualInterests(userA: InterestId[] = [], userB: InterestId[] = []): InterestId[] {
  const setA = new Set(userA);
  return userB.filter((id) => setA.has(id));
}

// ---------------------------------------------------------------------------
// SERVICE METHODS
// ---------------------------------------------------------------------------

export async function syncUserProfile(user: UserAccount, places: Discovery[]): Promise<void> {
  const userId = getUserId(user);
  const completedCount = user.quests.filter((q) => q.status === "completed").length;
  const pct = passportPercent(passportRows(user, places));

  const profilePayload = {
    id: userId,
    username: user.username,
    name: user.name,
    bio: user.bio || "",
    photo: user.photo ?? null,
    interests: user.interests,
    discovered_ids: user.discoveredIds,
    quests_count: completedCount,
    passport_percent: pct,
    updated_at: new Date().toISOString(),
  };

  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.from("profiles").upsert(profilePayload, { onConflict: "id" });
      if (!error) return;
      console.warn("Supabase profile sync warning:", error.message);
    } catch (err) {
      console.warn("Supabase profile sync error, keeping local copy:", err);
    }
  }

  // Also sync to local mock store
  const store = getMockStore();
  const existingIndex = store.profiles.findIndex((p) => p.id === userId);
  const localRecord: FriendProfile = {
    id: userId,
    username: user.username,
    name: user.name,
    bio: user.bio || "",
    photo: user.photo,
    interests: user.interests,
    discoveredIds: user.discoveredIds,
    questsCount: completedCount,
    passportPercent: pct,
  };
  if (existingIndex >= 0) {
    store.profiles[existingIndex] = localRecord;
  } else {
    store.profiles.push(localRecord);
  }

  // Update any initial mock friendship referring to 'current_user'
  store.friendships.forEach((f) => {
    if (f.friendId === "current_user") f.friendId = userId;
    if (f.userId === "current_user") f.userId = userId;
  });

  saveMockStore(store);
}

export async function getFriends(currentUserId: string): Promise<FriendItem[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("friendships")
        .select(`
          id,
          user_id,
          friend_id,
          status,
          created_at,
          user:profiles!friendships_user_id_fkey(*),
          friend:profiles!friendships_friend_id_fkey(*)
        `)
        .eq("status", "accepted")
        .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`);

      if (!error && Array.isArray(data)) {
        return data
          .map((row: any) => {
            const isUser = row.user_id === currentUserId;
            const otherRaw = isUser ? row.friend : row.user;
            if (!otherRaw) return null;
            const profile: FriendProfile = {
              id: otherRaw.id,
              username: otherRaw.username,
              name: otherRaw.name,
              bio: otherRaw.bio || "",
              photo: otherRaw.photo ?? null,
              interests: otherRaw.interests ?? [],
              discoveredIds: otherRaw.discovered_ids ?? [],
              questsCount: otherRaw.quests_count ?? 0,
              passportPercent: otherRaw.passport_percent ?? 0,
              createdAt: otherRaw.created_at,
            };
            return {
              friendshipId: row.id,
              profile,
              since: row.created_at,
            };
          })
          .filter((item): item is FriendItem => Boolean(item));
      }
    } catch (err) {
      console.warn("Failed to fetch friends from Supabase, using mock store:", err);
    }
  }

  // Mock store fallback
  const store = getMockStore();
  const accepted = store.friendships.filter(
    (f) => f.status === "accepted" && (f.userId === currentUserId || f.friendId === currentUserId),
  );

  return accepted.map((f) => {
    const otherId = f.userId === currentUserId ? f.friendId : f.userId;
    const profile = store.profiles.find((p) => p.id === otherId) ?? {
      id: otherId,
      username: otherId.replace(/^usr_/, ""),
      name: otherId.replace(/^usr_/, ""),
      bio: "",
      photo: null,
      interests: [],
      discoveredIds: [],
      questsCount: 0,
      passportPercent: 0,
    };
    return {
      friendshipId: f.id,
      profile,
      since: f.createdAt,
    };
  });
}

export async function getIncomingRequests(currentUserId: string): Promise<FriendRequest[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("friendships")
        .select(`
          id,
          user_id,
          friend_id,
          status,
          created_at,
          sender:profiles!friendships_user_id_fkey(*)
        `)
        .eq("friend_id", currentUserId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        const list: FriendRequest[] = [];
        for (const row of data) {
          const senderRaw = (row as any).sender;
          if (!senderRaw) continue;
          const profile: FriendProfile = {
            id: senderRaw.id,
            username: senderRaw.username,
            name: senderRaw.name,
            bio: senderRaw.bio || "",
            photo: senderRaw.photo ?? null,
            interests: senderRaw.interests ?? [],
            discoveredIds: senderRaw.discovered_ids ?? [],
            questsCount: senderRaw.quests_count ?? 0,
            passportPercent: senderRaw.passport_percent ?? 0,
          };
          list.push({
            id: row.id,
            userId: row.user_id,
            friendId: row.friend_id,
            status: "pending",
            createdAt: row.created_at,
            profile,
          });
        }
        return list;
      }
    } catch (err) {
      console.warn("Failed to fetch incoming requests from Supabase, using mock store:", err);
    }
  }

  // Mock store fallback
  const store = getMockStore();
  const pending = store.friendships.filter(
    (f) => (f.friendId === currentUserId || f.friendId === "current_user") && f.status === "pending",
  );

  const mockList: FriendRequest[] = [];
  for (const f of pending) {
    const profile = store.profiles.find((p) => p.id === f.userId) ?? {
      id: f.userId,
      username: f.userId.replace(/^usr_/, ""),
      name: f.userId.replace(/^usr_/, ""),
      bio: "",
      photo: null,
      interests: [],
      discoveredIds: [],
      questsCount: 0,
      passportPercent: 0,
    };
    mockList.push({
      id: f.id,
      userId: f.userId,
      friendId: currentUserId,
      status: "pending",
      createdAt: f.createdAt,
      profile,
    });
  }
  return mockList;
}

export async function getOutgoingRequests(currentUserId: string): Promise<FriendRequest[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("friendships")
        .select(`
          id,
          user_id,
          friend_id,
          status,
          created_at,
          receiver:profiles!friendships_friend_id_fkey(*)
        `)
        .eq("user_id", currentUserId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        const list: FriendRequest[] = [];
        for (const row of data) {
          const receiverRaw = (row as any).receiver;
          if (!receiverRaw) continue;
          const profile: FriendProfile = {
            id: receiverRaw.id,
            username: receiverRaw.username,
            name: receiverRaw.name,
            bio: receiverRaw.bio || "",
            photo: receiverRaw.photo ?? null,
            interests: receiverRaw.interests ?? [],
            discoveredIds: receiverRaw.discovered_ids ?? [],
            questsCount: receiverRaw.quests_count ?? 0,
            passportPercent: receiverRaw.passport_percent ?? 0,
          };
          list.push({
            id: row.id,
            userId: row.user_id,
            friendId: row.friend_id,
            status: "pending",
            createdAt: row.created_at,
            profile,
          });
        }
        return list;
      }
    } catch (err) {
      console.warn("Failed to fetch outgoing requests from Supabase, using mock store:", err);
    }
  }

  // Mock store fallback
  const store = getMockStore();
  const pending = store.friendships.filter((f) => f.userId === currentUserId && f.status === "pending");

  const mockList: FriendRequest[] = [];
  for (const f of pending) {
    const profile = store.profiles.find((p) => p.id === f.friendId) ?? {
      id: f.friendId,
      username: f.friendId.replace(/^usr_/, ""),
      name: f.friendId.replace(/^usr_/, ""),
      bio: "",
      photo: null,
      interests: [],
      discoveredIds: [],
      questsCount: 0,
      passportPercent: 0,
    };
    mockList.push({
      id: f.id,
      userId: currentUserId,
      friendId: f.friendId,
      status: "pending",
      createdAt: f.createdAt,
      profile,
    });
  }
  return mockList;
}

export async function searchProfiles(query: string, currentUserId: string): Promise<FriendProfile[]> {
  const clean = query.trim().toLowerCase().replace(/^@/, "");
  if (!clean) return [];

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .neq("id", currentUserId)
        .or(`username.ilike.%${clean}%,name.ilike.%${clean}%`)
        .limit(20);

      if (!error && Array.isArray(data)) {
        return data.map((raw: any) => ({
          id: raw.id,
          username: raw.username,
          name: raw.name,
          bio: raw.bio || "",
          photo: raw.photo ?? null,
          interests: raw.interests ?? [],
          discoveredIds: raw.discovered_ids ?? [],
          questsCount: raw.quests_count ?? 0,
          passportPercent: raw.passport_percent ?? 0,
        }));
      }
    } catch (err) {
      console.warn("Supabase search error, falling back to mock:", err);
    }
  }

  // Mock search
  const store = getMockStore();
  return store.profiles.filter(
    (p) =>
      p.id !== currentUserId &&
      (p.username.toLowerCase().includes(clean) ||
        p.name.toLowerCase().includes(clean) ||
        p.bio.toLowerCase().includes(clean)),
  );
}

export async function getRecommendedProfiles(currentUser: UserAccount): Promise<FriendProfile[]> {
  const currentUserId = getUserId(currentUser);
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .neq("id", currentUserId)
        .limit(10);

      if (!error && Array.isArray(data)) {
        const list: FriendProfile[] = data.map((raw: any) => ({
          id: raw.id,
          username: raw.username,
          name: raw.name,
          bio: raw.bio || "",
          photo: raw.photo ?? null,
          interests: raw.interests ?? [],
          discoveredIds: raw.discovered_ids ?? [],
          questsCount: raw.quests_count ?? 0,
          passportPercent: raw.passport_percent ?? 0,
        }));

        // Rank by shared interests count
        return list.sort((a, b) => {
          const matchA = getMutualInterests(currentUser.interests, a.interests).length;
          const matchB = getMutualInterests(currentUser.interests, b.interests).length;
          return matchB - matchA;
        });
      }
    } catch (err) {
      console.warn("Supabase recommendations error, falling back to mock:", err);
    }
  }

  // Mock recommendations
  const store = getMockStore();
  const others = store.profiles.filter((p) => p.id !== currentUserId && p.username !== currentUser.username);
  return others.sort((a, b) => {
    const matchA = getMutualInterests(currentUser.interests, a.interests).length;
    const matchB = getMutualInterests(currentUser.interests, b.interests).length;
    return matchB - matchA;
  });
}

export async function getFriendProfile(profileId: string): Promise<FriendProfile | null> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client.from("profiles").select("*").eq("id", profileId).single();
      if (!error && data) {
        return {
          id: data.id,
          username: data.username,
          name: data.name,
          bio: data.bio || "",
          photo: data.photo ?? null,
          interests: data.interests ?? [],
          discoveredIds: data.discovered_ids ?? [],
          questsCount: data.quests_count ?? 0,
          passportPercent: data.passport_percent ?? 0,
          createdAt: data.created_at,
        };
      }
    } catch {
      // Fall through to mock
    }
  }

  const store = getMockStore();
  return store.profiles.find((p) => p.id === profileId) ?? null;
}

export async function sendFriendRequest(
  fromUserId: string,
  toUserId: string,
): Promise<{ success: boolean; error?: string }> {
  if (fromUserId === toUserId) {
    return { success: false, error: "You cannot add yourself as a friend." };
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      // Check if existing friendship row exists
      const { data: existing } = await client
        .from("friendships")
        .select("id, status")
        .or(
          `and(user_id.eq.${fromUserId},friend_id.eq.${toUserId}),and(user_id.eq.${toUserId},friend_id.eq.${fromUserId})`,
        )
        .maybeSingle();

      if (existing) {
        if (existing.status === "accepted") {
          return { success: false, error: "You are already friends!" };
        }
        if (existing.status === "pending") {
          return { success: false, error: "A friend request is already pending." };
        }
        // If declined, update to pending
        const { error } = await client
          .from("friendships")
          .update({
            user_id: fromUserId,
            friend_id: toUserId,
            status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (!error) return { success: true };
      } else {
        const { error } = await client.from("friendships").insert({
          user_id: fromUserId,
          friend_id: toUserId,
          status: "pending",
        });
        if (!error) return { success: true };
        console.warn("Supabase insert request warning:", error.message);
      }
    } catch (err) {
      console.warn("Supabase sendRequest error, falling back to mock store:", err);
    }
  }

  // Mock store
  const store = getMockStore();
  const existingIdx = store.friendships.findIndex(
    (f) =>
      (f.userId === fromUserId && f.friendId === toUserId) ||
      (f.userId === toUserId && f.friendId === fromUserId),
  );

  if (existingIdx >= 0) {
    const existing = store.friendships[existingIdx];
    if (existing.status === "accepted") {
      return { success: false, error: "You are already friends!" };
    }
    if (existing.status === "pending") {
      return { success: false, error: "A friend request is already pending." };
    }
    store.friendships[existingIdx] = {
      ...existing,
      userId: fromUserId,
      friendId: toUserId,
      status: "pending",
      updatedAt: new Date().toISOString(),
    };
  } else {
    store.friendships.push({
      id: `mock_req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: fromUserId,
      friendId: toUserId,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  saveMockStore(store);
  return { success: true };
}

export async function acceptFriendRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client
        .from("friendships")
        .update({
          status: "accepted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (!error) return { success: true };
      console.warn("Supabase accept warning:", error.message);
    } catch (err) {
      console.warn("Supabase accept error, using mock:", err);
    }
  }

  const store = getMockStore();
  const match = store.friendships.find((f) => f.id === requestId);
  if (match) {
    match.status = "accepted";
    match.updatedAt = new Date().toISOString();
    saveMockStore(store);
    return { success: true };
  }

  return { success: false, error: "Request not found" };
}

export async function declineFriendRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client
        .from("friendships")
        .update({
          status: "declined",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (!error) return { success: true };
    } catch (err) {
      console.warn("Supabase decline error, using mock:", err);
    }
  }

  const store = getMockStore();
  const match = store.friendships.find((f) => f.id === requestId);
  if (match) {
    match.status = "declined";
    match.updatedAt = new Date().toISOString();
    saveMockStore(store);
    return { success: true };
  }

  return { success: false, error: "Request not found" };
}

export async function cancelFriendRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.from("friendships").delete().eq("id", requestId);
      if (!error) return { success: true };
    } catch (err) {
      console.warn("Supabase cancel error, using mock:", err);
    }
  }

  const store = getMockStore();
  store.friendships = store.friendships.filter((f) => f.id !== requestId);
  saveMockStore(store);
  return { success: true };
}

export async function removeFriend(friendshipId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.from("friendships").delete().eq("id", friendshipId);
      if (!error) return { success: true };
    } catch (err) {
      console.warn("Supabase delete error, using mock:", err);
    }
  }

  const store = getMockStore();
  store.friendships = store.friendships.filter((f) => f.id !== friendshipId);
  saveMockStore(store);
  return { success: true };
}

export async function getFriendshipStatus(
  currentUserId: string,
  targetUserId: string,
): Promise<{
  state: "none" | "friends" | "pending_sent" | "pending_received";
  friendshipId?: string;
  requestId?: string;
}> {
  if (currentUserId === targetUserId) {
    return { state: "none" };
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data } = await client
        .from("friendships")
        .select("id, user_id, friend_id, status")
        .or(
          `and(user_id.eq.${currentUserId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${currentUserId})`,
        )
        .maybeSingle();

      if (data) {
        if (data.status === "accepted") {
          return { state: "friends", friendshipId: data.id };
        }
        if (data.status === "pending") {
          if (data.user_id === currentUserId) {
            return { state: "pending_sent", requestId: data.id };
          } else {
            return { state: "pending_received", requestId: data.id };
          }
        }
      }
    } catch {
      // Fall through to mock
    }
  }

  const store = getMockStore();
  const match = store.friendships.find(
    (f) =>
      (f.userId === currentUserId && f.friendId === targetUserId) ||
      (f.userId === targetUserId && f.friendId === currentUserId),
  );

  if (!match) return { state: "none" };
  if (match.status === "accepted") return { state: "friends", friendshipId: match.id };
  if (match.status === "pending") {
    if (match.userId === currentUserId) {
      return { state: "pending_sent", requestId: match.id };
    } else {
      return { state: "pending_received", requestId: match.id };
    }
  }

  return { state: "none" };
}
