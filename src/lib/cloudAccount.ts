import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabase";
import { loadPersisted, savePersisted } from "./storage";
import { STARTER_DISCOVERED_IDS, type InterestId, type UserAccount } from "../pipeline/types";

/**
 * Checks whether an error from Supabase / PostgREST indicates that the
 * `account_state` table has not yet been created in the database.
 */
export function isTableMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string; details?: string; hint?: string };
  const code = String(err.code ?? "");
  const message = String(err.message ?? "").toLowerCase();
  const details = String(err.details ?? "").toLowerCase();
  const hint = String(err.hint ?? "").toLowerCase();

  return (
    code === "PGRST205" ||
    code === "42P01" ||
    code === "PGRST106" ||
    code === "PGRST200" ||
    code === "404" ||
    message.includes("schema cache") ||
    message.includes("account_state") ||
    message.includes("does not exist") ||
    message.includes("not found") ||
    details.includes("account_state") ||
    details.includes("schema cache") ||
    details.includes("does not exist") ||
    hint.includes("account_state")
  );
}

export function newCloudAccount(auth: User): UserAccount {
  return {
    id: auth.id,
    email: auth.email ?? "",
    name: (auth.user_metadata?.name as string | undefined) || "Explorer",
    username: `r_${auth.id.replaceAll("-", "").slice(0, 14)}`,
    bio: "",
    photo: null,
    interests: [],
    discoveredIds: [...STARTER_DISCOVERED_IDS],
    savedIds: [],
    quests: [],
    journey: null,
    createdAt: auth.created_at,
  };
}

export async function loadCloudAccount(auth: User): Promise<UserAccount> {
  const client = getSupabaseClient();
  if (!client) {
    return loadPersisted().user ?? newCloudAccount(auth);
  }

  // 1. Try to load from account_state table if it exists in Supabase
  try {
    const { data, error } = await client
      .from("account_state")
      .select("data")
      .eq("user_id", auth.id)
      .maybeSingle();

    if (!error && data?.data) {
      const user: UserAccount = {
        ...newCloudAccount(auth),
        ...data.data,
        id: auth.id,
        email: auth.email ?? (data.data as Partial<UserAccount>).email ?? "",
      };
      savePersisted({ user, session: true });
      return user;
    }

    if (error && !isTableMissingError(error)) {
      console.warn("Could not load from account_state:", error.message);
    }
  } catch (err: unknown) {
    if (!isTableMissingError(err)) {
      console.warn("Exception reading account_state:", err);
    }
  }

  // 2. Fallback: check the public.profiles table (which exists in the standard schema)
  let existingProfile: {
    name?: string;
    username?: string;
    bio?: string;
    photo?: string | null;
    interests?: InterestId[];
    discovered_ids?: string[];
    created_at?: string;
  } | null = null;

  try {
    const { data: profile, error: profileErr } = await client
      .from("profiles")
      .select("*")
      .eq("id", auth.id)
      .maybeSingle();

    if (!profileErr && profile) {
      existingProfile = profile;
    }
  } catch (err) {
    console.warn("Could not query profiles table:", err);
  }

  // 3. Assemble account by merging profile table, local cache, and defaults
  const local = loadPersisted().user;
  const base = newCloudAccount(auth);

  const name =
    existingProfile?.name ||
    (auth.user_metadata?.name as string | undefined) ||
    (local?.name && local.name !== "Explorer" ? local.name : "") ||
    base.name;

  const username =
    existingProfile?.username ||
    (local?.username && !local.username.startsWith("usr_") ? local.username : base.username);

  const bio = existingProfile?.bio ?? local?.bio ?? base.bio;
  const photo = existingProfile?.photo ?? local?.photo ?? base.photo;

  const interests =
    Array.isArray(existingProfile?.interests) && existingProfile.interests.length > 0
      ? (existingProfile.interests as InterestId[])
      : local?.interests && local.interests.length > 0
      ? local.interests
      : base.interests;

  const discoveredIds =
    Array.isArray(existingProfile?.discovered_ids) && existingProfile.discovered_ids.length > 0
      ? (existingProfile.discovered_ids as string[])
      : local?.discoveredIds && local.discoveredIds.length > 0
      ? local.discoveredIds
      : base.discoveredIds;

  const user: UserAccount = {
    ...base,
    ...(local && (local.id === auth.id || !local.id?.startsWith("usr_")) ? local : {}),
    id: auth.id,
    email: auth.email ?? local?.email ?? "",
    name,
    username,
    bio,
    photo,
    interests,
    discoveredIds,
    savedIds: local?.savedIds || [],
    quests: local?.quests || [],
    journey: local?.journey || null,
    createdAt: existingProfile?.created_at || auth.created_at,
  };

  // 4. Save to local storage right away so user session is retained
  savePersisted({ user, session: true });

  // 5. Safely upsert to account_state if the table is available
  try {
    const result = await client.from("account_state").insert({ user_id: auth.id, data: user });
    if (result.error && !isTableMissingError(result.error) && result.error.code !== "23505") {
      console.warn("Could not insert initial account_state:", result.error.message);
    }
  } catch {
    // Ignore missing table error
  }

  // 6. Ensure profile table has current record
  try {
    const completedCount = user.quests.filter((q) => q.status === "completed").length;
    const { error: profileUpsertErr } = await client.from("profiles").upsert(
      {
        id: user.id,
        username: user.username,
        name: user.name,
        bio: user.bio || "",
        photo: user.photo,
        interests: user.interests,
        discovered_ids: user.discoveredIds,
        quests_count: completedCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    // If username is taken by another explorer, fall back to unique UUID handle
    if (profileUpsertErr && profileUpsertErr.code === "23505") {
      user.username = base.username;
      await client.from("profiles").upsert(
        {
          id: user.id,
          username: user.username,
          name: user.name,
          bio: user.bio || "",
          photo: user.photo,
          interests: user.interests,
          discovered_ids: user.discoveredIds,
          quests_count: completedCount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      savePersisted({ user, session: true });
    }
  } catch (err) {
    console.warn("Could not sync profile to Supabase:", err);
  }

  return user;
}

export async function saveCloudAccount(user: UserAccount): Promise<void> {
  // Always persist locally
  savePersisted({ user, session: true });

  const client = getSupabaseClient();
  if (!client || !user.id) return;

  // 1. Sync to profiles table (primary table present in Supabase)
  try {
    const completedCount = user.quests.filter((q) => q.status === "completed").length;
    const { error: profileErr } = await client.from("profiles").upsert(
      {
        id: user.id,
        username: user.username,
        name: user.name,
        bio: user.bio || "",
        photo: user.photo ?? null,
        interests: user.interests,
        discovered_ids: user.discoveredIds,
        quests_count: completedCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (profileErr) {
      console.warn("Could not sync to profiles:", profileErr.message);
    }
  } catch (err) {
    console.warn("Exception syncing to profiles:", err);
  }

  // 2. Try to sync to account_state table if it exists
  try {
    const { error } = await client.from("account_state").upsert({
      user_id: user.id,
      data: user,
      updated_at: new Date().toISOString(),
    });
    if (error && !isTableMissingError(error)) {
      console.warn("Could not sync to account_state:", error.message);
    }
  } catch (err: unknown) {
    if (!isTableMissingError(err)) {
      console.warn("Exception syncing to account_state:", err);
    }
  }
}
