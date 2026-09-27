import { describe, it, expect, vi, beforeEach } from "vitest";
import { isTableMissingError, loadCloudAccount, newCloudAccount, saveCloudAccount } from "./cloudAccount";
import * as supabaseModule from "./supabase";
import * as storageModule from "./storage";
import type { User } from "@supabase/supabase-js";

const values = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); },
  clear: () => values.clear(),
  key: (index: number) => [...values.keys()][index] ?? null,
  get length() { return values.size; },
} as any;

describe("cloudAccount", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe("isTableMissingError", () => {
    it("detects PGRST205 schema cache missing table error", () => {
      expect(
        isTableMissingError({
          code: "PGRST205",
          message: "Could not find the table 'public.account_state' in the schema cache",
        }),
      ).toBe(true);
    });

    it("detects 42P01 undefined table error", () => {
      expect(
        isTableMissingError({
          code: "42P01",
          message: 'relation "public.account_state" does not exist',
        }),
      ).toBe(true);
    });

    it("returns false for unrelated errors", () => {
      expect(
        isTableMissingError({
          code: "23505",
          message: 'duplicate key value violates unique constraint "profiles_pkey"',
        }),
      ).toBe(false);
      expect(isTableMissingError(null)).toBe(false);
      expect(isTableMissingError(undefined)).toBe(false);
    });
  });

  describe("newCloudAccount", () => {
    it("constructs default explorer account with auth metadata", () => {
      const mockAuth: User = {
        id: "12345678-abcd-ef01-2345-6789abcdef01",
        app_metadata: {},
        user_metadata: { name: "Test Explorer" },
        aud: "authenticated",
        created_at: "2026-09-26T12:00:00.000Z",
        email: "test@example.com",
      };

      const account = newCloudAccount(mockAuth);
      expect(account.id).toBe(mockAuth.id);
      expect(account.name).toBe("Test Explorer");
      expect(account.email).toBe("test@example.com");
      expect(account.username).toBe("r_12345678abcdef");
      expect(account.interests).toEqual([]);
      expect(account.quests).toEqual([]);
    });
  });

  describe("loadCloudAccount with missing account_state table", () => {
    it("falls back to profiles table and localStorage without throwing", async () => {
      const mockAuth: User = {
        id: "usr-fallback-1234",
        app_metadata: {},
        user_metadata: { name: "Alice Wanders" },
        aud: "authenticated",
        created_at: "2026-09-26T12:00:00.000Z",
        email: "alice@example.com",
      };

      // Mock Supabase client where account_state returns PGRST205 but profiles works
      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "account_state") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: null,
                    error: {
                      code: "PGRST205",
                      message: "Could not find the table 'public.account_state' in the schema cache",
                    },
                  }),
                }),
              }),
              insert: async () => ({
                data: null,
                error: {
                  code: "PGRST205",
                  message: "Could not find the table 'public.account_state' in the schema cache",
                },
              }),
            };
          }
          if (table === "profiles") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: mockAuth.id,
                      username: "alicew",
                      name: "Alice Wanders",
                      bio: "Exploring Central Park",
                      photo: null,
                      interests: ["parks", "coffee"],
                      discovered_ids: ["central-park"],
                      quests_count: 3,
                    },
                    error: null,
                  }),
                }),
              }),
              upsert: async () => ({ data: null, error: null }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      };

      vi.spyOn(supabaseModule, "getSupabaseClient").mockReturnValue(mockClient as any);

      const account = await loadCloudAccount(mockAuth);

      expect(account).toBeDefined();
      expect(account.id).toBe(mockAuth.id);
      expect(account.username).toBe("alicew");
      expect(account.name).toBe("Alice Wanders");
      expect(account.bio).toBe("Exploring Central Park");
      expect(account.interests).toEqual(["parks", "coffee"]);

      // Verify persisted in localStorage
      const persisted = storageModule.loadPersisted();
      expect(persisted.user?.id).toBe(mockAuth.id);
      expect(persisted.session).toBe(true);
    });
  });

  describe("saveCloudAccount with missing account_state table", () => {
    it("saves to profiles table and localStorage without throwing", async () => {
      const mockAccount = {
        id: "usr-save-123",
        name: "Bob Traveler",
        email: "bob@example.com",
        username: "bobt",
        photo: null,
        bio: "Walking Brooklyn",
        interests: ["art", "food"] as any,
        discoveredIds: ["dumbo"],
        savedIds: [],
        quests: [],
        journey: null,
        createdAt: "2026-09-26T12:00:00.000Z",
      };

      let profileUpsertCalled = false;
      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "profiles") {
            return {
              upsert: async (payload: any) => {
                profileUpsertCalled = true;
                expect(payload.id).toBe(mockAccount.id);
                expect(payload.username).toBe(mockAccount.username);
                return { data: null, error: null };
              },
            };
          }
          if (table === "account_state") {
            return {
              upsert: async () => ({
                data: null,
                error: {
                  code: "PGRST205",
                  message: "Could not find the table 'public.account_state' in the schema cache",
                },
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      };

      vi.spyOn(supabaseModule, "getSupabaseClient").mockReturnValue(mockClient as any);

      await expect(saveCloudAccount(mockAccount)).resolves.not.toThrow();
      expect(profileUpsertCalled).toBe(true);

      const persisted = storageModule.loadPersisted();
      expect(persisted.user?.id).toBe(mockAccount.id);
    });
  });
});
