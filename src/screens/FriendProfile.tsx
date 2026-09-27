import { useEffect, useState } from "react";
import { BackRow } from "../components/ui";
import { firstName } from "../lib/format";
import {
  getFriendProfile,
  getFriendshipStatus,
  getMutualInterests,
  getUserId,
} from "../lib/friendsService";
import { INTERESTS, type FriendProfile } from "../pipeline/types";
import { useFeed } from "../state/FeedContext";
import { useFriends } from "../state/FriendsContext";
import { useRamble, useRequiredUser } from "../state/RambleContext";

export function FriendProfileScreen({ friendId }: { friendId: string }) {
  const user = useRequiredUser();
  const feed = useFeed();
  const { go, back } = useRamble();
  const { sendRequest, acceptRequest, declineRequest, cancelRequest, removeFriendItem } = useFriends();

  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendshipState, setFriendshipState] = useState<{
    state: "none" | "friends" | "pending_sent" | "pending_received";
    friendshipId?: string;
    requestId?: string;
  }>({ state: "none" });
  const [copiedInvite, setCopiedInvite] = useState(false);

  const currentUserId = getUserId(user);

  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      const [p, s] = await Promise.all([
        getFriendProfile(friendId),
        getFriendshipStatus(currentUserId, friendId),
      ]);
      if (!cancel) {
        setProfile(p);
        setFriendshipState(s);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancel = true;
    };
  }, [friendId, currentUserId]);

  if (loading) {
    return (
      <section className="page">
        <BackRow onBack={back} label="Friends" />
        <p className="lede">Loading explorer profile…</p>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="page">
        <BackRow onBack={back} label="Friends" />
        <p className="empty">Explorer not found.</p>
      </section>
    );
  }

  const initial = firstName(profile.name).slice(0, 1).toUpperCase();
  const mutual = getMutualInterests(user.interests, profile.interests);
  const discoveredPlaces = profile.discoveredIds
    .map((id) => feed.places.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  async function handleAdd() {
    if (!profile) return;
    const res = await sendRequest(profile.id);
    if (res.success) {
      setFriendshipState({ state: "pending_sent" });
    }
  }

  async function handleAccept() {
    if (friendshipState.requestId) {
      const ok = await acceptRequest(friendshipState.requestId);
      if (ok) {
        setFriendshipState({ state: "friends", friendshipId: friendshipState.requestId });
      }
    }
  }

  async function handleDecline() {
    if (friendshipState.requestId) {
      const ok = await declineRequest(friendshipState.requestId);
      if (ok) {
        setFriendshipState({ state: "none" });
      }
    }
  }

  async function handleCancel() {
    if (friendshipState.requestId) {
      const ok = await cancelRequest(friendshipState.requestId);
      if (ok) {
        setFriendshipState({ state: "none" });
      }
    }
  }

  async function handleRemove() {
    if (friendshipState.friendshipId && confirm(`Remove ${profile?.name} from your friends?`)) {
      const ok = await removeFriendItem(friendshipState.friendshipId);
      if (ok) {
        setFriendshipState({ state: "none" });
      }
    }
  }

  function copyRambleInvite(placeName?: string) {
    const text = placeName
      ? `Hey! Let's ramble over to ${placeName} in NYC together! 🗺️ Check it out on Ramble.`
      : `Hey! Let's explore NYC together on Ramble! 🗺️`;
    void navigator.clipboard.writeText(text);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  }

  return (
    <section className="page friend-profile-page">
      <BackRow onBack={back} label="Friends" />

      {/* Friend Header */}
      <header className="profile-head">
        <div className="avatar avatar-lg" aria-hidden="true">
          {profile.photo ? <img src={profile.photo} alt="" /> : initial}
        </div>
        <div>
          <p className="eyebrow">NYC Explorer</p>
          <h1>{profile.name}</h1>
          <p className="meta-line">@{profile.username}</p>
          <p className="meta-line">{profile.bio || "Rambling across the five boroughs."}</p>
        </div>
      </header>

      {/* Friendship Status Button Bar */}
      <div className="friend-status-bar">
        {friendshipState.state === "friends" ? (
          <div className="status-badge-group">
            <span className="badge badge-verified">✓ Friends</span>
            <button type="button" className="text-btn danger-link" onClick={() => void handleRemove()}>
              Remove friend
            </button>
          </div>
        ) : friendshipState.state === "pending_received" ? (
          <div className="status-action-group">
            <button type="button" className="btn btn-primary" onClick={() => void handleAccept()}>
              Accept Request
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void handleDecline()}>
              Decline
            </button>
          </div>
        ) : friendshipState.state === "pending_sent" ? (
          <div className="status-badge-group">
            <span className="badge badge-live">Request sent</span>
            <button type="button" className="text-btn" onClick={() => void handleCancel()}>
              Cancel request
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-clay btn-block" onClick={() => void handleAdd()}>
            + Add Friend
          </button>
        )}
      </div>

      {/* Explorer Stats */}
      <div className="stats">
        <div className="stat">
          <b>{profile.questsCount}</b>
          <span>Quests completed</span>
        </div>
        <div className="stat">
          <b>{profile.discoveredIds.length}</b>
          <span>Places discovered</span>
        </div>
        <div className="stat">
          <b>{profile.passportPercent}%</b>
          <span>Passport progress</span>
        </div>
      </div>

      {/* Mutual Interests */}
      {mutual.length > 0 ? (
        <section className="friend-mutual-section">
          <div className="section-head">
            <h2>Shared Interests</h2>
            <p>Interests you and {firstName(profile.name)} both follow in NYC.</p>
          </div>
          <div className="chips static-chips">
            {mutual.map((id) => {
              const interest = INTERESTS.find((i) => i.id === id);
              return (
                <span key={id} className="chip chip-mutual">
                  {interest?.emoji} {interest?.title}
                </span>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* All Interests */}
      <section>
        <div className="section-head">
          <h2>All Interests</h2>
        </div>
        <div className="chips static-chips">
          {profile.interests.map((id) => {
            const interest = INTERESTS.find((i) => i.id === id);
            return (
              <span key={id} className="chip chip-static">
                {interest?.emoji} {interest?.title}
              </span>
            );
          })}
        </div>
      </section>

      {/* Places Discovered by this Friend */}
      <section>
        <div className="section-head">
          <h2>Places Discovered ({discoveredPlaces.length})</h2>
          <p>Places {firstName(profile.name)} has found. Tap to explore.</p>
        </div>

        {discoveredPlaces.length === 0 ? (
          <p className="empty">No discovered places recorded yet.</p>
        ) : (
          <ul className="log-list">
            {discoveredPlaces.map((place) => (
              <li key={place.id}>
                <button type="button" onClick={() => go({ name: "place", id: place.id })}>
                  <strong>{place.name}</strong>
                  <small>{place.address}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ramble Together Box */}
      <section className="card ramble-together-card">
        <h3>Ramble together</h3>
        <p className="fine">
          Invite {firstName(profile.name)} to walk a neighborhood, visit a mutual favorite place, or tackle a side quest.
        </p>
        <div className="ramble-actions">
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => copyRambleInvite(discoveredPlaces[0]?.name)}
          >
            {copiedInvite ? "✓ Invitation message copied!" : "💬 Share Ramble Invite"}
          </button>
        </div>
      </section>
    </section>
  );
}
