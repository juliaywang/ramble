import { beforeEach, describe, expect, it, vi } from "vitest";
import { actOnInvite, activityRewards, listInvites, sendInvite, updateInvite, type ActivityInvite } from "./activityInvites";
import { verifyQuestLocation } from "./questLocation";
import { progression } from "../pipeline/progression";

vi.mock("./supabase", () => ({ getSupabaseClient: () => null }));
vi.mock("./friendsService", () => ({ getFriends: async () => [{ profile: { id: "bob" } }] }));
vi.mock("./questLocation", () => ({ verifyQuestLocation: vi.fn(async () => {}) }));
const values = new Map<string, string>();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); },
  removeItem: key => { values.delete(key); }, clear: () => values.clear(),
  key: index => [...values.keys()][index] ?? null, get length() { return values.size; },
};
function invite(): ActivityInvite {
  return { id: "invite", sender_id: "alice", recipient_id: "bob", sender_name: "Alice", recipient_name: "Bob",
    activity_key: "quest1", title: "Walk", kind: "quest", status: "pending", sender_checks: {}, recipient_checks: {},
    created_at: "2026-01-01T00:00:00Z", stops: [{ name: "Park", lat: 40.8, lng: -73.9,
      quest: { id: "quest1", templateId: "park", title: "Walk", objective: "Explore", why: "", discoveryId: "park",
        xp: 40, visitMinutes: 20, status: "active", acceptedAt: "2026-01-01T00:00:00Z" } }] };
}
beforeEach(() => { values.clear(); vi.clearAllMocks(); });

describe("shared activity rewards", () => {
  it("only lets the recipient answer and participants check in after acceptance", () => {
    expect(() => updateInvite(invite(), "alice", "accepted")).toThrow();
    expect(() => updateInvite(invite(), "eve", "accepted")).toThrow();
    expect(() => updateInvite(invite(), "alice", "check", "quest1")).toThrow();
    expect(activityRewards([invite()], "alice")).toEqual([]);
  });
  it("gives each person their own base XP, then the together bonus", () => {
    let row = updateInvite(invite(), "bob", "accepted");
    row = updateInvite(row, "alice", "check", "quest1", "2026-01-01T10:00:00Z");
    expect(activityRewards([row], "alice")[0].teamBonus).toBe(0);
    expect(activityRewards([row], "bob")).toEqual([]);
    row = updateInvite(row, "bob", "check", "quest1", "2026-01-01T10:30:00Z");
    expect(activityRewards([row], "alice")[0]).toMatchObject({ id: "quest1", teamBonus: 20 });
    expect(activityRewards([row], "bob")[0]).toMatchObject({ id: "shared:invite:quest1", teamBonus: 20 });
    expect(activityRewards([row], "eve")).toEqual([]);
    expect(progression(activityRewards([row], "alice")).total).toBe(105);
  });
  it("does not award bonuses outside the window or reset check-in timestamps on retry", () => {
    let row = updateInvite(invite(), "bob", "accepted");
    row = updateInvite(row, "alice", "check", "quest1", "2026-01-01T10:00:00Z");
    row = updateInvite(row, "alice", "check", "quest1", "2026-01-01T11:00:00Z");
    row = updateInvite(row, "bob", "check", "quest1", "2026-01-01T10:30:01Z");
    expect(row.sender_checks.quest1).toBe("2026-01-01T10:00:00Z");
    expect(activityRewards([row], "alice")[0].teamBonus).toBe(0);
  });
  it("requires check-ins at every journey stop independently", () => {
    let row = invite(); row.kind = "journey";
    row.stops.push({ ...row.stops[0], quest: { ...row.stops[0].quest, id: "quest2", discoveryId: "cafe" } });
    row = updateInvite(row, "bob", "accepted");
    row = updateInvite(row, "alice", "check", "quest1");
    row = updateInvite(row, "bob", "check", "quest1");
    expect(activityRewards([row], "alice")).toHaveLength(1);
    expect(() => updateInvite(row, "alice", "check", "unknown")).toThrow();
  });
  it("persists invitations between local accounts and prevents duplicate invitations", async () => {
    const input = invite();
    await sendInvite(input);
    expect(await listInvites("eve")).toEqual([]);
    const [row] = await listInvites("bob");
    await actOnInvite(row, "bob", "accepted");
    const [joined] = await listInvites("alice");
    await actOnInvite(joined, "alice", "check", joined.stops[0]);
    expect(verifyQuestLocation).toHaveBeenCalledOnce();
    expect(activityRewards(await listInvites("alice"), "alice")).toHaveLength(1);
    await expect(sendInvite(input)).rejects.toThrow("already");
    await expect(sendInvite({ ...input, recipient_id: "eve" })).rejects.toThrow("accepted friends");
  });
  it("does not save a check-in when location verification fails", async () => {
    await sendInvite(invite());
    const [row] = await listInvites("bob");
    await actOnInvite(row, "bob", "accepted");
    vi.mocked(verifyQuestLocation).mockRejectedValueOnce(new Error("Too far away"));
    await expect(actOnInvite(row, "alice", "check", row.stops[0])).rejects.toThrow("Too far");
    expect(activityRewards(await listInvites("alice"), "alice")).toEqual([]);
  });
});
