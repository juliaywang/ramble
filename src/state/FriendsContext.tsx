import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
  getUserId,
  removeFriend,
  sendFriendRequest,
  syncUserProfile,
} from "../lib/friendsService";
import {
  clearCustomSupabaseConfig,
  getSupabaseConfig,
  saveCustomSupabaseConfig,
  testSupabaseConnection,
  type SupabaseConfig,
} from "../lib/supabase";
import type { FriendItem, FriendRequest } from "../pipeline/types";
import { useFeed } from "./FeedContext";
import { useRamble } from "./RambleContext";

type FriendsContextType = {
  friends: FriendItem[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  loading: boolean;
  error: string | null;
  supabaseConfig: SupabaseConfig;
  refresh: () => Promise<void>;
  sendRequest: (toUserId: string) => Promise<{ success: boolean; error?: string }>;
  acceptRequest: (requestId: string) => Promise<boolean>;
  declineRequest: (requestId: string) => Promise<boolean>;
  cancelRequest: (requestId: string) => Promise<boolean>;
  removeFriendItem: (friendshipId: string) => Promise<boolean>;
  saveSupabaseConfig: (url: string, key: string) => Promise<{ ok: boolean; message: string }>;
  clearSupabaseConfig: () => void;
  testConnection: () => Promise<{ ok: boolean; message: string; tablesExist?: boolean }>;
};

const FriendsContext = createContext<FriendsContextType | null>(null);

export function FriendsProvider({ children }: { children: ReactNode }) {
  const { user } = useRamble();
  const feed = useFeed();
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(getSupabaseConfig);

  const refresh = useCallback(async () => {
    if (!user) {
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      return;
    }

    const userId = getUserId(user);
    setLoading(true);
    try {
      // Sync user profile first so other explorers can see latest stats
      await syncUserProfile(user, feed.places);

      const [fList, inList, outList] = await Promise.all([
        getFriends(userId),
        getIncomingRequests(userId),
        getOutgoingRequests(userId),
      ]);
      setFriends(fList);
      setIncomingRequests(inList);
      setOutgoingRequests(outList);
      setError(null);
    } catch (err) {
      console.error("Friends refresh error:", err);
      setError("Could not load friends update");
    } finally {
      setLoading(false);
    }
  }, [user, feed.places]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSendRequest = async (toUserId: string) => {
    if (!user) return { success: false, error: "Not logged in" };
    const res = await sendFriendRequest(getUserId(user), toUserId);
    if (res.success) {
      await refresh();
    }
    return res;
  };

  const handleAcceptRequest = async (requestId: string) => {
    const res = await acceptFriendRequest(requestId);
    if (res.success) {
      await refresh();
      return true;
    }
    return false;
  };

  const handleDeclineRequest = async (requestId: string) => {
    const res = await declineFriendRequest(requestId);
    if (res.success) {
      await refresh();
      return true;
    }
    return false;
  };

  const handleCancelRequest = async (requestId: string) => {
    const res = await cancelFriendRequest(requestId);
    if (res.success) {
      await refresh();
      return true;
    }
    return false;
  };

  const handleRemoveFriend = async (friendshipId: string) => {
    const res = await removeFriend(friendshipId);
    if (res.success) {
      await refresh();
      return true;
    }
    return false;
  };

  const handleSaveConfig = async (url: string, key: string) => {
    saveCustomSupabaseConfig(url, key);
    const newConfig = getSupabaseConfig();
    setSupabaseConfig(newConfig);
    const testRes = await testSupabaseConnection();
    await refresh();
    return testRes;
  };

  const handleClearConfig = () => {
    clearCustomSupabaseConfig();
    setSupabaseConfig(getSupabaseConfig());
    void refresh();
  };

  return (
    <FriendsContext.Provider
      value={{
        friends,
        incomingRequests,
        outgoingRequests,
        loading,
        error,
        supabaseConfig,
        refresh,
        sendRequest: handleSendRequest,
        acceptRequest: handleAcceptRequest,
        declineRequest: handleDeclineRequest,
        cancelRequest: handleCancelRequest,
        removeFriendItem: handleRemoveFriend,
        saveSupabaseConfig: handleSaveConfig,
        clearSupabaseConfig: handleClearConfig,
        testConnection: testSupabaseConnection,
      }}
    >
      {children}
    </FriendsContext.Provider>
  );
}

export function useFriends() {
  const ctx = useContext(FriendsContext);
  if (!ctx) {
    throw new Error("useFriends must be used within a FriendsProvider");
  }
  return ctx;
}
