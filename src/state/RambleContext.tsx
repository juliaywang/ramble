import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { loadPersisted, savePersisted } from "../lib/storage";
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
  | { type: "accept"; draft: QuestDraft }
  | { type: "complete"; id: string }
  | { type: "abandon"; id: string }
  | { type: "journey"; plan: JourneyPlan }
  | { type: "account"; name: string; email: string; bio: string; photo: string | null };

function init(): State {
  const saved = loadPersisted();
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
      const user: UserAccount = {
        name: action.name.trim(),
        email: action.email.trim().toLowerCase(),
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
      return { ...state, session: false, stack: [], screen: { name: "welcome" }, pending: null };
    case "toggle-save": {
      if (!state.user) return state;
      const saved = new Set(state.user.savedIds);
      if (saved.has(action.id)) saved.delete(action.id);
      else saved.add(action.id);
      return { ...state, user: { ...state.user, savedIds: [...saved] } };
    }
    case "accept": {
      if (!state.user) return state;
      if (state.user.quests.some((quest) => quest.templateId === action.draft.templateId && quest.status !== "completed")) {
        const existing = state.user.quests.find((quest) => quest.templateId === action.draft.templateId);
        return existing
          ? { ...state, screen: { name: "quest", id: existing.id } }
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
        screen: { name: "quest", id: quest.id },
      };
    }
    case "complete": {
      if (!state.user) return state;
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
      if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return state;
      return {
        ...state,
        user: { ...state.user, name, email, bio: action.bio.trim(), photo: action.photo },
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
  user: UserAccount | null;
  session: boolean;
  pending: Pending | null;
  screen: Screen;
  go: (screen: Screen) => void;
  replace: (screen: Screen) => void;
  tab: (screen: Screen) => void;
  back: () => void;
  beginSignup: (pending: Pending) => void;
  finishSignup: (interests: InterestId[]) => void;
  saveInterests: (interests: InterestId[]) => void;
  continueSession: () => void;
  logOut: () => void;
  toggleSave: (id: string) => void;
  acceptQuest: (draft: QuestDraft) => void;
  completeQuest: (id: string) => void;
  abandonQuest: (id: string) => void;
  saveJourney: (plan: JourneyPlan) => void;
  saveAccount: (account: { name: string; email: string; bio: string; photo: string | null }) => void;
};

const RambleContext = createContext<Api | null>(null);

export function RambleProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  useEffect(() => {
    savePersisted({ user: state.user, session: state.session });
  }, [state.user, state.session]);

  const api = useMemo<Api>(
    () => ({
      user: state.user,
      session: state.session,
      pending: state.pending,
      screen: state.screen,
      go: (screen) => dispatch({ type: "go", screen }),
      replace: (screen) => dispatch({ type: "replace", screen }),
      tab: (screen) => dispatch({ type: "tab", screen }),
      back: () => dispatch({ type: "back" }),
      beginSignup: (pending) => dispatch({ type: "pending", pending }),
      finishSignup: (interests) =>
        dispatch({
          type: "signup",
          name: state.pending?.name ?? "Explorer",
          email: state.pending?.email ?? "",
          interests,
        }),
      saveInterests: (interests) => dispatch({ type: "interests", interests }),
      continueSession: () => dispatch({ type: "continue" }),
      logOut: () => dispatch({ type: "logout" }),
      toggleSave: (id) => dispatch({ type: "toggle-save", id }),
      acceptQuest: (draft) => dispatch({ type: "accept", draft }),
      completeQuest: (id) => dispatch({ type: "complete", id }),
      abandonQuest: (id) => dispatch({ type: "abandon", id }),
      saveJourney: (plan) => dispatch({ type: "journey", plan }),
      saveAccount: (account) => dispatch({ type: "account", ...account }),
    }),
    [state.pending, state.screen, state.session, state.user],
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
