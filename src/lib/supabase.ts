import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const CONFIG_KEY = "ramble.supabase.config";

export type SupabaseConfig = {
  url: string;
  anonKey: string;
  isConfigured: boolean;
  source: "env" | "custom" | "none";
};

let cachedClient: SupabaseClient | null = null;
let lastClientKey = "";

export function normalizeSupabaseUrl(input: string): string {
  let val = input.trim();
  if (!val) return "";
  if (!val.startsWith("http://") && !val.startsWith("https://")) {
    if (val.includes(".")) {
      val = `https://${val}`;
    } else {
      // User entered just their project ID like "abcdefghijklm"
      val = `https://${val}.supabase.co`;
    }
  }
  return val.replace(/\/+$/, "");
}

export function getSupabaseConfig(): SupabaseConfig {
  if (import.meta.env.MODE !== "test") {
    const url = import.meta.env.VITE_SUPABASE_URL?.trim();
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
    if (url && anonKey && !url.includes("your-project")) return { url: normalizeSupabaseUrl(url), anonKey, isConfigured: true, source: "env" };
  }
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { url?: string; anonKey?: string; disabled?: boolean };
      if (parsed.disabled) {
        return {
          url: "",
          anonKey: "",
          isConfigured: false,
          source: "custom",
        };
      }
      if (parsed.url && parsed.anonKey) {
        return {
          url: normalizeSupabaseUrl(parsed.url),
          anonKey: parsed.anonKey.trim(),
          isConfigured: true,
          source: "custom",
        };
      }
    }
  } catch {
    // Ignore localStorage parse errors
  }

  // During automated tests, avoid contacting external servers
  if (import.meta.env.MODE === "test") {
    return {
      url: "",
      anonKey: "",
      isConfigured: false,
      source: "none",
    };
  }

  return { url: "", anonKey: "", isConfigured: false, source: "none" };
}

export function saveCustomSupabaseConfig(urlOrProjectId: string, anonKey: string): void {
  const cleanUrl = normalizeSupabaseUrl(urlOrProjectId);
  const cleanKey = anonKey.trim();
  if (!cleanUrl || !cleanKey) {
    clearCustomSupabaseConfig();
    return;
  }
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ url: cleanUrl, anonKey: cleanKey, disabled: false }));
  cachedClient = null;
  lastClientKey = "";
}

export function clearCustomSupabaseConfig(): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ disabled: true }));
  cachedClient = null;
  lastClientKey = "";
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.isConfigured || !config.url || !config.anonKey) {
    return null;
  }

  const clientKey = `${config.url}::${config.anonKey}`;
  if (cachedClient && lastClientKey === clientKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    lastClientKey = clientKey;
    return cachedClient;
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
    return null;
  }
}

export async function testSupabaseConnection(): Promise<{
  ok: boolean;
  message: string;
  tablesExist?: boolean;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      ok: false,
      message: "Supabase is not configured yet. Provide a project URL and anon public key.",
      tablesExist: false,
    };
  }

  try {
    const { data, error } = await client.from("profiles").select("id").limit(1);
    if (error) {
      if (error.code === "42P01" || error.message.toLowerCase().includes("relation") || error.message.includes("does not exist")) {
        return {
          ok: false,
          message: "Connected to Supabase, but the 'profiles' table is missing. Run the schema in supabase/schema.sql.",
          tablesExist: false,
        };
      }
      return {
        ok: false,
        message: error.message || "Failed to communicate with Supabase database.",
      };
    }

    return {
      ok: true,
      message: `Successfully connected to Supabase! (${data?.length ?? 0} existing profile records detected)`,
      tablesExist: true,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error contacting Supabase.",
    };
  }
}
