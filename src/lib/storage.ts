import { normalizeUsername, usernameFromName } from "./format";
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
    const user = parsed.user
      ? {
          ...parsed.user,
          id: parsed.user.id || `usr_${normalizeUsername(parsed.user.username || "") || "me"}`,
          photo: parsed.user.photo ?? null,
          bio: parsed.user.bio ?? "",
          username: normalizeUsername(parsed.user.username || "") || usernameFromName(parsed.user.name ?? ""),
        }
      : null;
    return { user, session: Boolean(parsed.session && user) };
  } catch {
    return { user: null, session: false };
  }
}

export function savePersisted(data: Persisted) {
  try {
    if (data.user) {
      const accounts = readRecord<UserAccount>(ACCOUNTS_KEY);
      const previous = accounts[data.user.id || `usr_${data.user.username}`];
      if (previous && previous.email !== data.user.email) {
        const credentials = readRecord<Credential>(CREDENTIALS_KEY);
        if (credentials[previous.email] && !credentials[data.user.email]) {
          credentials[data.user.email] = credentials[previous.email];
          delete credentials[previous.email];
          localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
        }
      }
      accounts[data.user.id || `usr_${data.user.username}`] = data.user;
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    }
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Ignore private-mode storage failures in the prototype.
  }
}

const ACCOUNTS_KEY = "ramble.accounts.v1";
const CREDENTIALS_KEY = "ramble.credentials.v1";
type Credential = { salt: string; hash: string };

function readRecord<T>(key: string): Record<string, T> {
  return JSON.parse(localStorage.getItem(key) || "{}") as Record<string, T>;
}

async function passwordHash(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 100000, hash: "SHA-256" }, key, 256);
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Local demo accounts only; no email verification or server authentication. */
export async function authenticateLocal(email: string, password: string, create: boolean): Promise<UserAccount | null> {
  const normalized = email.trim().toLowerCase();
  const accounts = readRecord<UserAccount>(ACCOUNTS_KEY);
  const legacy = loadPersisted().user;
  if (legacy && !accounts[legacy.id || `usr_${legacy.username}`]) accounts[legacy.id || `usr_${legacy.username}`] = legacy;
  const user = Object.values(accounts).find((account) => account.email.toLowerCase() === normalized);
  const credentials = readRecord<Credential>(CREDENTIALS_KEY);
  const credential = credentials[normalized];
  if (!user && !create) throw new Error("No local account with that email. Choose Create account first.");
  if (credential) {
    if (await passwordHash(password, credential.salt) !== credential.hash) throw new Error("That password doesn't match this local account.");
  } else {
    // Older demo accounts had no stored password; first sign-in sets one.
    const salt = crypto.randomUUID();
    credentials[normalized] = { salt, hash: await passwordHash(password, salt) };
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
  }
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  return user ?? null;
}
