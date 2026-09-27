import { beforeEach, describe, expect, it } from "vitest";

// Lightweight mock for Node test environment
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, val),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (idx: number) => Array.from(store.keys())[idx] ?? null,
    get length() {
      return store.size;
    },
  };
}

import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  getFriendProfile,
  getFriends,
  getFriendshipStatus,
  getIncomingRequests,
  getMutualInterests,
  getOutgoingRequests,
  getRecommendedProfiles,
  getUserId,
  removeFriend,
  searchProfiles,
  sendFriendRequest,
  syncUserProfile,
  isUsernameTaken,
} from "./friendsService";
import { clearCustomSupabaseConfig, getSupabaseConfig, saveCustomSupabaseConfig } from "./supabase";
import type { UserAccount } from "../pipeline/types";

describe("friendsService", () => {
  const mockUser: UserAccount = {
    id: "usr_alice",
    name: "Alice Walker",
    email: "alice@example.com",
    username: "alicewalks",
    photo: null,
    bio: "Exploring New York one borough at a time",
    interests: ["coffee", "art", "books"],
    discoveredIds: ["book-culture", "greenmarket"],
    savedIds: [],
    quests: [],
    journey: null,
    createdAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    localStorage.clear();
    await syncUserProfile(mockUser, []);
  });

  it("extracts or derives user id properly", () => {
    expect(getUserId(mockUser)).toBe("usr_alice");
    expect(getUserId({ ...mockUser, id: undefined, username: "bob" })).toBe("usr_bob");
  });

  it("calculates mutual interests accurately", () => {
    const mutual = getMutualInterests(["coffee", "art", "books"], ["art", "gaming", "books", "food"]);
    expect(mutual).toEqual(["art", "books"]);
    expect(getMutualInterests(["coffee"], ["tea" as any])).toEqual([]);
  });

  it("searches profiles by username or name", async () => {
    const results = await searchProfiles("maya", "usr_alice");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.username === "mayawalks")).toBe(true);

    const empty = await searchProfiles("nonexistentxyz", "usr_alice");
    expect(empty).toEqual([]);
  });

  it("ranks recommended profiles by shared interests", async () => {
    const recs = await getRecommendedProfiles(mockUser);
    expect(recs.length).toBeGreaterThan(0);
    // Maya Chen has coffee, art, books - should rank high for Alice
    expect(recs[0].interests.some((i) => mockUser.interests.includes(i))).toBe(true);
  });

  it("fetches single friend profile", async () => {
    const profile = await getFriendProfile("usr_mayawalks");
    expect(profile).not.toBeNull();
    expect(profile?.username).toBe("mayawalks");
    expect(profile?.name).toBe("Maya Chen");
  });

  it("sends friend request and tracks status", async () => {
    const sendRes = await sendFriendRequest("usr_alice", "usr_elenarambles");
    expect(sendRes.success).toBe(true);

    // Cannot friend oneself
    const selfRes = await sendFriendRequest("usr_alice", "usr_alice");
    expect(selfRes.success).toBe(false);

    // Duplicate request should fail
    const dupRes = await sendFriendRequest("usr_alice", "usr_elenarambles");
    expect(dupRes.success).toBe(false);
    expect(dupRes.error).toContain("already pending");

    // Check outgoing requests
    const outgoing = await getOutgoingRequests("usr_alice");
    expect(outgoing.some((r) => r.friendId === "usr_elenarambles")).toBe(true);

    // Check incoming requests for receiver
    const incoming = await getIncomingRequests("usr_elenarambles");
    expect(incoming.some((r) => r.userId === "usr_alice")).toBe(true);

    // Check status
    const status = await getFriendshipStatus("usr_alice", "usr_elenarambles");
    expect(status.state).toBe("pending_sent");
  });

  it("accepts incoming friend request and creates friendship", async () => {
    await sendFriendRequest("usr_marcus_nyc", "usr_alice");
    const incoming = await getIncomingRequests("usr_alice");
    const targetReq = incoming.find((r) => r.userId === "usr_marcus_nyc");
    expect(targetReq).toBeDefined();

    const acceptRes = await acceptFriendRequest(targetReq!.id);
    expect(acceptRes.success).toBe(true);

    // Marcus should now be in Alice's friends
    const aliceFriends = await getFriends("usr_alice");
    expect(aliceFriends.some((f) => f.profile.id === "usr_marcus_nyc")).toBe(true);

    // And Alice should be in Marcus's friends
    const marcusFriends = await getFriends("usr_marcus_nyc");
    expect(marcusFriends.some((f) => f.profile.id === "usr_alice")).toBe(true);

    // Friendship status should now be friends
    const status = await getFriendshipStatus("usr_alice", "usr_marcus_nyc");
    expect(status.state).toBe("friends");
  });

  it("declines incoming friend request", async () => {
    await sendFriendRequest("usr_jordanr", "usr_alice");
    const incoming = await getIncomingRequests("usr_alice");
    const targetReq = incoming.find((r) => r.userId === "usr_jordanr");
    expect(targetReq).toBeDefined();

    const declineRes = await declineFriendRequest(targetReq!.id);
    expect(declineRes.success).toBe(true);

    const after = await getIncomingRequests("usr_alice");
    expect(after.some((r) => r.id === targetReq!.id)).toBe(false);
  });

  it("cancels outgoing friend request", async () => {
    await sendFriendRequest("usr_alice", "usr_jordanr");
    const outgoing = await getOutgoingRequests("usr_alice");
    const req = outgoing.find((r) => r.friendId === "usr_jordanr");
    expect(req).toBeDefined();

    const cancelRes = await cancelFriendRequest(req!.id);
    expect(cancelRes.success).toBe(true);

    const outgoingAfter = await getOutgoingRequests("usr_alice");
    expect(outgoingAfter.some((r) => r.id === req!.id)).toBe(false);
  });

  it("removes friend", async () => {
    await sendFriendRequest("usr_elenarambles", "usr_alice");
    const incoming = await getIncomingRequests("usr_alice");
    const req = incoming.find((r) => r.userId === "usr_elenarambles")!;
    await acceptFriendRequest(req.id);

    const friends = await getFriends("usr_alice");
    const friendship = friends.find((f) => f.profile.id === "usr_elenarambles")!;
    expect(friendship).toBeDefined();

    const removeRes = await removeFriend(friendship.friendshipId);
    expect(removeRes.success).toBe(true);

    const friendsAfter = await getFriends("usr_alice");
    expect(friendsAfter.some((f) => f.profile.id === "usr_elenarambles")).toBe(false);
  });

  it("checks username availability accurately", async () => {
    // Should detect taken usernames from default mock profiles
    expect(await isUsernameTaken("mayawalks")).toBe(true);
    expect(await isUsernameTaken("MayaWalks")).toBe(true);
    expect(await isUsernameTaken("@mayawalks")).toBe(true);
    expect(await isUsernameTaken("marcus_nyc")).toBe(true);

    // Should detect taken username from synced active user
    expect(await isUsernameTaken("alicewalks")).toBe(true);

    // Excluding self should allow user to keep their username
    expect(await isUsernameTaken("alicewalks", "usr_alice")).toBe(false);

    // Should report unused username as available
    expect(await isUsernameTaken("totally_unique_walker")).toBe(false);
    expect(await isUsernameTaken("")).toBe(false);
  });
});

describe("supabase config manager", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to unconfigured or env fallback", () => {
    const config = getSupabaseConfig();
    expect(config.source).toBe("none");
    expect(config.isConfigured).toBe(false);
  });

  it("saves and clears custom config", () => {
    saveCustomSupabaseConfig("https://exampleproject.supabase.co", "sample-anon-key-123");
    const config = getSupabaseConfig();
    expect(config.isConfigured).toBe(true);
    expect(config.source).toBe("custom");
    expect(config.url).toBe("https://exampleproject.supabase.co");

    clearCustomSupabaseConfig();
    const cleared = getSupabaseConfig();
    expect(cleared.isConfigured).toBe(false);
  });

  it("normalizes project IDs into full https supabase URLs", () => {
    saveCustomSupabaseConfig("abcdefghijklm", "sample-anon-key");
    const config = getSupabaseConfig();
    expect(config.url).toBe("https://abcdefghijklm.supabase.co");
  });
});
