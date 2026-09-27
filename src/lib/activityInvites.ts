import { getSupabaseClient } from "./supabase";
import { getFriends } from "./friendsService";
import { verifyQuestLocation } from "./questLocation";
import type { SavedQuest } from "../pipeline/types";

export type ActivityStop = { quest: SavedQuest; name: string; lat: number; lng: number };
export type ActivityInvite = {
  id: string; sender_id: string; recipient_id: string; sender_name: string; recipient_name: string;
  activity_key: string; title: string; kind: "quest" | "journey"; stops: ActivityStop[];
  status: "pending" | "accepted" | "declined";
  sender_checks: Record<string, string>; recipient_checks: Record<string, string>; created_at: string;
};
const KEY = "ramble.activity-invites.v1";
function local(): ActivityInvite[] { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); }
function save(rows: ActivityInvite[]) { localStorage.setItem(KEY, JSON.stringify(rows)); }
function cloudError(message: string) { return new Error(`Could not update activity invites: ${message}. Check your connection and run supabase_activities.sql if you haven't yet.`); }

export async function listInvites(userId: string): Promise<ActivityInvite[]> {
  const client = getSupabaseClient();
  if (!client) return local().filter(r => r.sender_id === userId || r.recipient_id === userId);
  const { data, error } = await client.from("activity_invites").select("*").order("created_at", { ascending: false });
  if (error) throw cloudError(error.message);
  return data as ActivityInvite[];
}

export async function sendInvite(input: Omit<ActivityInvite, "id" | "status" | "sender_checks" | "recipient_checks" | "created_at">) {
  if (input.sender_id === input.recipient_id) throw new Error("Choose a friend to invite.");
  const friends = await getFriends(input.sender_id);
  if (!friends.some(f => f.profile.id === input.recipient_id)) throw new Error("You can only invite accepted friends.");
  if (!input.stops.length) throw new Error("This activity has no available stops.");
  const row: ActivityInvite = { ...input, id: crypto.randomUUID(), status: "pending", sender_checks: {}, recipient_checks: {}, created_at: new Date().toISOString() };
  const client = getSupabaseClient();
  if (client) {
    const { error } = await client.from("activity_invites").insert(row);
    if (error) throw cloudError(error.message);
  } else {
    const rows = local();
    if (rows.some(r => r.sender_id === row.sender_id && r.activity_key === row.activity_key)) throw new Error("This activity already has an invitation. Open it in Friends.");
    save([...rows, row]);
  }
}

export function updateInvite(row: ActivityInvite, actor: string, action: string, stop?: string, now = new Date().toISOString()): ActivityInvite {
  if (actor !== row.sender_id && actor !== row.recipient_id) throw new Error("This invitation belongs to someone else.");
  if (action === "unaccept") {
    if (actor !== row.recipient_id) throw new Error("Only the invited friend can unaccept this invitation.");
    if (row.status !== "accepted") throw new Error("Only an accepted invitation can be undone.");
    return { ...row, status: "pending" };
  }
  if (action === "accepted") {
    if (actor !== row.recipient_id || (row.status !== "pending" && row.status !== "declined")) throw new Error("This invitation can no longer be answered.");
    return { ...row, status: "accepted" };
  }
  if (action === "declined") {
    if (actor !== row.recipient_id || row.status !== "pending") throw new Error("This invitation can no longer be answered.");
    return { ...row, status: "declined" };
  }
  if (action !== "check" || row.status !== "accepted" || !row.stops.some(s => s.quest.id === stop)) throw new Error("Accept the invitation before checking in.");
  const field = actor === row.sender_id ? "sender_checks" : "recipient_checks";
  if (row[field][stop!]) return row;
  return { ...row, [field]: { ...row[field], [stop!]: now } };
}

export async function actOnInvite(row: ActivityInvite, actor: string, action: string, stop?: ActivityStop) {
  if (action === "check") {
    if (!stop) throw new Error("Choose a stop.");
    await verifyQuestLocation(stop);
  }
  const client = getSupabaseClient();
  if (client) {
    const response = action;
    const { error } = await client.rpc("respond_activity_invite", { invite_id: row.id, response, stop_id: stop?.quest.id ?? null });
    if (error) throw cloudError(error.message);
  } else {
    const rows = local();
    const index = rows.findIndex(r => r.id === row.id);
    if (index < 0) throw new Error("Invitation no longer exists.");
    rows[index] = updateInvite(rows[index], actor, action, stop?.quest.id);
    save(rows);
  }
}

export function activityRewards(rows: ActivityInvite[], actor: string): SavedQuest[] {
  return rows.filter(r => r.sender_id === actor || r.recipient_id === actor).flatMap(row =>
    row.stops.flatMap(stop => {
      const mine = (actor === row.sender_id ? row.sender_checks : row.recipient_checks)[stop.quest.id];
      const theirs = (actor === row.sender_id ? row.recipient_checks : row.sender_checks)[stop.quest.id];
      if (!mine) return [];
      const together = !!theirs && Math.abs(Date.parse(mine) - Date.parse(theirs)) <= 30 * 60 * 1000;
      return [{ ...stop.quest,
        id: actor === row.sender_id ? stop.quest.id : `shared:${row.id}:${stop.quest.id}`,
        status: "completed" as const, completedAt: mine,
        teamBonus: together ? Math.ceil(stop.quest.xp * 0.5) : 0,
      }];
    }),
  );
}
