import type { UserAccount } from "../pipeline/types";

const KEY = "ramble.v1";

export type Persisted = {
  user: UserAccount | null;
  session: boolean;
};

export function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { user: null, session: false };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    const user = parsed.user ? { ...parsed.user, photo: parsed.user.photo ?? null, bio: parsed.user.bio ?? "" } : null;
    return { user, session: Boolean(parsed.session && user) };
  } catch {
    return { user: null, session: false };
  }
}

export function savePersisted(data: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Ignore private-mode storage failures in the prototype.
  }
}
