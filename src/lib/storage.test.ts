import { beforeEach, expect, it } from "vitest";
import { authenticateLocal, savePersisted } from "./storage";
import { syncUserProfile, sendFriendRequest, getIncomingRequests, acceptFriendRequest, getFriends } from "./friendsService";
import type { UserAccount } from "../pipeline/types";

const values = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => { values.set(key, value); },
  removeItem: (key) => { values.delete(key); },
  clear: () => values.clear(),
  key: (index) => [...values.keys()][index] ?? null,
  get length() { return values.size; },
};
beforeEach(() => localStorage.clear());
function account(id: string): UserAccount {
  return { id, name: id, email: `${id}@fake.test`, username: id, photo: null, bio: "", interests: ["coffee", "art", "books"], discoveredIds: [], savedIds: [], quests: [], journey: null, createdAt: "2026-01-01" };
}
it("restores separate accounts, stable friend identities, and saved progress after logout", async () => {
  const alice = account("alice");
  const bob = account("bob");
  await authenticateLocal(alice.email, "fake-pass", true);
  alice.savedIds = ["book-culture"];
  savePersisted({ user: alice, session: true });
  await syncUserProfile(alice, []);
  await authenticateLocal(bob.email, "other-pass", true);
  savePersisted({ user: bob, session: true });
  await syncUserProfile(bob, []);
  expect((await sendFriendRequest("alice", "bob")).success).toBe(true);
  const requests = await getIncomingRequests("bob");
  await acceptFriendRequest(requests[0]!.id);
  savePersisted({ user: bob, session: false });
  const restored = await authenticateLocal(" ALICE@FAKE.TEST ", "fake-pass", false);
  expect(restored?.id).toBe("alice");
  expect(restored?.savedIds).toEqual(["book-culture"]);
  expect((await getFriends(restored!.id!)).map((friend) => friend.profile.id)).toContain("bob");
  expect((await authenticateLocal(bob.email, "other-pass", false))?.savedIds).toEqual([]);
  await expect(authenticateLocal(alice.email, "wrong-pass", false)).rejects.toThrow("doesn't match");
});
it("preserves legacy account data when setting its first local password", async () => {
  const old = account("legacy");
  localStorage.setItem("ramble.v1", JSON.stringify({ user: old, session: false }));
  expect(await authenticateLocal(old.email, "new-pass", false)).toEqual(old);
  await expect(authenticateLocal("missing@fake.test", "new-pass", false)).rejects.toThrow("No local account");
  expect(localStorage.getItem("ramble.credentials.v1")).not.toContain("new-pass");
});
