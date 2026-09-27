import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase";
import { loadCloudAccount, saveCloudAccount } from "../lib/cloudAccount";
import { verifyQuestLocation } from "../lib/questLocation";
import { useFeed } from "./FeedContext";
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { loadPersisted, savePersisted } from "../lib/storage";
import { usernameFromName } from "../lib/format";
import { STARTER_DISCOVERED_IDS, type InterestId, type JourneyPlan, type QuestDraft, type UserAccount } from "../pipeline/types";
import { type Screen } from "./screens";

type Pending = { name: string; email: string };

type State = {
  user: UserAccount | null;
  session: boolean;
  pending: Pending | null;
  screen: Screen;
  stack: Screen[];
};

type Action =
  | { type: "login"; user: UserAccount }
  | { type: "go"; screen: Screen }
  | { type: "replace"; screen: Screen }
  | { type: "tab"; screen: Screen }
  | { type: "back" }
  | { type: "pending"; pending: Pending }
  | { type: "signup"; name: string; email: string; interests: InterestId[] }
  | { type: "interests"; interests: InterestId[] }
  | { type: "continue" }
  | { type: "logout" }
  | { type: "toggle-save"; id: string }
  | { type: "accept"; draft: QuestDraft; navigate?: boolean }
  | { type: "complete"; id: string; userId: string | undefined }
  | { type: "abandon"; id: string }
  | { type: "journey"; plan: JourneyPlan }
  | { type: "account"; name: string; email: string; username: string; bio: string; photo: string | null };

function init(): State {
  const saved = getSupabaseClient() ? { user: null, session: false } : loadPersisted();
  return {
    user: saved.user,
    session: saved.session,
    pending: null,
    screen: saved.session && saved.user ? { name: "explore" } : { name: "welcome" },
    stack: [],
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "login":
      return { ...state, user: action.user, session: true, pending: null, stack: [], screen: action.user.interests.length < 3 ? { name: "interests", mode: "edit" } : { name: "explore" } };
    case "go":
      return { ...state, stack: [...state.stack, state.screen], screen: action.screen };
    case "replace":
      return { ...state, screen: action.screen };
    case "tab":
      return { ...state, stack: [], screen: action.screen };
    case "back": {
      const stack = [...state.stack];
      const screen = stack.pop() ?? (state.session ? { name: "explore" as const } : { name: "welcome" as const });
      return { ...state, stack, screen };
    }
    case "pending":
      return { ...state, pending: action.pending, stack: [...state.stack, state.screen], screen: { name: "interests", mode: "onboarding" } };
    case "signup": {
      if (action.interests.length < 3) return state;
      const username = usernameFromName(action.name);
      const user: UserAccount = {
        id: `usr_${username}_${Date.now().toString(36)}`,
        name: action.name.trim(),
        email: action.email.trim().toLowerCase(),
        username,
        photo: null,
        bio: "",
        interests: action.interests,
        discoveredIds: [...STARTER_DISCOVERED_IDS],
        savedIds: [],
        quests: [],
        journey: null,
        createdAt: new Date().toISOString(),
      };
      return { ...state, user, session: true, pending: null, stack: [], screen: { name: "explore" } };
    }
    case "interests":
      if (!state.user || action.interests.length < 3) return state;
      return {
        ...state,
        user: { ...state.user, interests: action.interests },
        stack: state.stack.slice(0, -1),
        screen: state.stack.at(-1) ?? { name: "profile" },
      };
    case "continue":
      if (!state.user) return state;
      return { ...state, session: true, stack: [], screen: { name: "explore" } };
    case "logout":
      return { ...state, user: getSupabaseClient() ? null : state.user, session: false, stack: [], screen: { name: "welcome" }, pending: null };
    case "toggle-save": {
      if (!state.user) return state;
      const saved = new Set(state.user.savedIds);
      if (saved.has(action.id)) saved.delete(action.id);
      else saved.add(action.id);
      return { ...state, user: { ...state.user, savedIds: [...saved] } };
    }
    case "accept": {
      if (!state.user) return state;
      const shouldNavigate = action.navigate ?? true;
      if (state.user.quests.some((quest) => quest.templateId === action.draft.templateId && quest.status !== "completed")) {
        const existing = state.user.quests.find((quest) => quest.templateId === action.draft.templateId);
        if (!shouldNavigate) return state;
        return existing
          ? { ...state, stack: [...state.stack, state.screen], screen: { name: "quest", id: existing.id } }
          : state;
      }
      const quest = {
        ...action.draft,
        id: `q_${action.draft.templateId}_${Date.now()}`,
        status: "active" as const,
        acceptedAt: new Date().toISOString(),
      };
      return {
        ...state,
        user: { ...state.user, quests: [quest, ...state.user.quests] },
        stack: shouldNavigate ? [...state.stack, state.screen] : state.stack,
        screen: shouldNavigate ? { name: "quest", id: quest.id } : state.screen,
      };
    }
    case "complete": {
      if (!state.session || !state.user || state.user.id !== action.userId || !state.user.quests.some((quest) => quest.id === action.id && quest.status === "active")) return state;
      const quests = state.user.quests.map((quest) =>
        quest.id === action.id
          ? { ...quest, status: "completed" as const, completedAt: new Date().toISOString() }
          : quest,
      );
      const quest = quests.find((item) => item.id === action.id);
      const discovered = new Set(state.user.discoveredIds);
      if (quest) discovered.add(quest.discoveryId);
      return {
        ...state,
        user: { ...state.user, quests, discoveredIds: [...discovered] },
        stack: [...state.stack, { name: "quest", id: action.id }],
        screen: { name: "quest-complete", questId: action.id },
      };
    }
    case "abandon": {
      if (!state.user) return state;
      const stack = [...state.stack];
      const screen = stack.pop() ?? { name: "quests" as const };
      return {
        ...state,
        user: { ...state.user, quests: state.user.quests.filter((quest) => quest.id !== action.id) },
        stack,
        screen,
      };
    }
    case "account": {
      if (!state.user) return state;
      const name = action.name.trim();
      const email = action.email.trim().toLowerCase();
      const username = action.username.trim().toLowerCase();
      if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return state;
      if (!/^[a-z0-9_]{3,16}$/.test(username)) return state;
      return {
        ...state,
        user: { ...state.user, name, email, username, bio: action.bio.trim(), photo: action.photo },
      };
    }
    case "journey":
      if (!state.user) return state;
      return {
        ...state,
        user: { ...state.user, journey: action.plan },
        stack: [],
        screen: { name: "journey" },
      };
    default:
      return state;
  }
}

type Api = {
  cloudMode: boolean;
  authLoading: boolean;
  syncError: string | null;
  retrySync: () => void;
  user: UserAccount | null;
  session: boolean;
  pending: Pending | null;
  screen: Screen;
  go: (screen: Screen) => void;
  replace: (screen: Screen) => void;
  tab: (screen: Screen) => void;
  back: () => void;
  loginLocal: (user: UserAccount) => void;
  beginSignup: (pending: Pending) => void;
  finishSignup: (interests: InterestId[]) => void;
  saveInterests: (interests: InterestId[]) => void;
  continueSession: () => void;
  logOut: () => void;
  toggleSave: (id: string) => void;
  acceptQuest: (draft: QuestDraft, navigate?: boolean) => void;
  completeQuest: (id: string) => Promise<void>;
  abandonQuest: (id: string) => void;
  saveJourney: (plan: JourneyPlan) => void;
  saveAccount: (account: { name: string; email: string; username: string; bio: string; photo: string | null }) => void;
};

const RambleContext = createContext<Api | null>(null);

export function RambleProvider({ children }: { children: ReactNode }) {
  const feed = useFeed();
  const [state, dispatch] = useReducer(reducer, undefined, init);

  const client = getSupabaseClient();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(client));
  const [syncError, setSyncError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const loadedId = useRef<string | null>(null);
  const saves = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setAuthUser((current) => current?.id === session?.user.id && current?.email === session?.user.email ? current : session?.user ?? null);
      if (!session) { loadedId.current = null; dispatch({ type: "logout" }); setAuthLoading(false); }
    });
    return () => data.subscription.unsubscribe();
  }, [client]);

  useEffect(() => {
    if (!authUser || !client || loadedId.current === authUser.id) return;
    let cancelled = false;
    setAuthLoading(true);
    setSyncError(null);
    void loadCloudAccount(authUser).then((user) => {
      if (cancelled) return;
      loadedId.current = user.id!;
      dispatch({ type: "login", user });
    }).catch((error: Error) => { if (!cancelled) setSyncError(error.message); })
      .finally(() => { if (!cancelled) setAuthLoading(false); });
    return () => { cancelled = true; };
  }, [authUser, client, retry]);

  useEffect(() => {
    if (!client) { savePersisted({ user: state.user, session: state.session }); return; }
    const user = state.user;
    if (!state.session || !user || user.id !== authUser?.id || loadedId.current !== user.id) return;
    // Serialize snapshots so a slow earlier request cannot overwrite later progress.
    saves.current = saves.current.catch(() => {}).then(() => saveCloudAccount(user));
    void saves.current.then(() => setSyncError(null)).catch((error: Error) => setSyncError(`Progress hasn't synced: ${error.message}`));
  }, [state.user, state.session, client, authUser?.id, retry]);

  const api = useMemo<Api>(
    () => ({
      cloudMode: Boolean(client),
      authLoading, syncError, retrySync: () => setRetry((value) => value + 1),
      user: state.user,
      session: state.session,
      pending: state.pending,
      screen: state.screen,
      go: (screen) => dispatch({ type: "go", screen }),
      replace: (screen) => dispatch({ type: "replace", screen }),
      tab: (screen) => dispatch({ type: "tab", screen }),
      back: () => dispatch({ type: "back" }),
      loginLocal: (user) => { if (!client) dispatch({ type: "login", user }); },
      beginSignup: (pending) => dispatch({ type: "pending", pending }),
      finishSignup: (interests) =>
        dispatch({
          type: "signup",
          name: state.pending?.name ?? "Explorer",
          email: state.pending?.email ?? "",
          interests,
        }),
      saveInterests: (interests) => dispatch({ type: "interests", interests }),
      continueSession: () => { if (!client) dispatch({ type: "continue" }); },
      logOut: () => {
        if (!client) { dispatch({ type: "logout" }); return; }
        void saves.current.then(async () => {
          const { error } = await client.auth.signOut();
          if (error) throw error;
          dispatch({ type: "logout" });
        }).catch((error: Error) => setSyncError(`Couldn't sign out: ${error.message}`));
      },
      toggleSave: (id) => dispatch({ type: "toggle-save", id }),
      acceptQuest: (draft, navigate = true) => dispatch({ type: "accept", draft, navigate }),
      completeQuest: async (id) => {
        const quest = state.user?.quests.find((item) => item.id === id && item.status === "active");
        const destination = feed.places.find((place) => place.id === quest?.discoveryId);
        if (!state.session || !quest || !destination) throw new Error("This quest is no longer available to complete.");
        await verifyQuestLocation(destination);
        dispatch({ type: "complete", id, userId: state.user?.id });
      },
      abandonQuest: (id) => dispatch({ type: "abandon", id }),
      saveJourney: (plan) => dispatch({ type: "journey", plan }),
      saveAccount: (account) => dispatch({ type: "account", ...account, email: client ? state.user?.email ?? account.email : account.email }),
    }),
    [state.pending, state.screen, state.session, state.user, feed.places, client, authLoading, syncError],
  );

  return <RambleContext.Provider value={api}>{children}</RambleContext.Provider>;
}

export function useRamble() {
  const ctx = useContext(RambleContext);
  if (!ctx) throw new Error("useRamble must be used inside RambleProvider");
  return ctx;
}

export function useRequiredUser() {
  const ctx = useRamble();
  if (!ctx.user) throw new Error("Expected an account");
  return ctx.user;
}
