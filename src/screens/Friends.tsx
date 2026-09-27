import { useEffect, useMemo, useState } from "react";
import { firstName } from "../lib/format";
import { getMutualInterests, getRecommendedProfiles, getUserId, searchProfiles } from "../lib/friendsService";
import { INTERESTS, type FriendProfile } from "../pipeline/types";
import { useFriends } from "../state/FriendsContext";
import { useRamble, useRequiredUser } from "../state/RambleContext";

export function FriendsScreen({ initialView = "friends" }: { initialView?: "friends" | "requests" | "find" }) {
  const user = useRequiredUser();
  const { go } = useRamble();
  const {
    friends,
    incomingRequests,
    outgoingRequests,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
  } = useFriends();

  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "find">(initialView);
  const [friendFilter, setFriendFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [recommended, setRecommended] = useState<FriendProfile[]>([]);
  const [searching, setSearching] = useState(false);

  const currentUserId = getUserId(user);

  // Load recommendations
  useEffect(() => {
    void getRecommendedProfiles(user).then((res) => {
      setRecommended(res);
    });
  }, [user, friends]);

  // Live search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      void searchProfiles(searchQuery, currentUserId).then((res) => {
        setSearchResults(res);
        setSearching(false);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, currentUserId]);

  const filteredFriends = useMemo(() => {
    const q = friendFilter.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        f.profile.name.toLowerCase().includes(q) ||
        f.profile.username.toLowerCase().includes(q) ||
        f.profile.bio.toLowerCase().includes(q),
    );
  }, [friends, friendFilter]);

  return (
    <section className="page friends-page">
      <header className="page-head">
        <p className="eyebrow">Community</p>
        <h1>Friends</h1>
        <p className="lede">Find fellow explorers, share quests, and ramble together.</p>
      </header>

      {/* Segmented Controls / Navigation */}
      <div className="subnav-tabs" role="tablist" aria-label="Friends navigation">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "friends"}
          className={`subnav-tab ${activeTab === "friends" ? "is-active" : ""}`}
          onClick={() => setActiveTab("friends")}
        >
          My Friends
          <span className="badge-count">{friends.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "requests"}
          className={`subnav-tab ${activeTab === "requests" ? "is-active" : ""}`}
          onClick={() => setActiveTab("requests")}
        >
          Requests
          {incomingRequests.length > 0 ? (
            <span className="badge-count badge-attention">{incomingRequests.length}</span>
          ) : (
            <span className="badge-count">{incomingRequests.length}</span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "find"}
          className={`subnav-tab ${activeTab === "find" ? "is-active" : ""}`}
          onClick={() => setActiveTab("find")}
        >
          Find Explorers
        </button>
      </div>

      {/* TAB 1: FRIENDS LIST */}
      {activeTab === "friends" ? (
        <div className="tab-pane">
          {friends.length > 3 ? (
            <div className="field-search">
              <input
                type="search"
                placeholder="Filter your friends…"
                value={friendFilter}
                onChange={(e) => setFriendFilter(e.target.value)}
                className="search-input"
              />
            </div>
          ) : null}

          {filteredFriends.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-icon" aria-hidden="true">🗺️</div>
              <h3>{friends.length === 0 ? "No friends added yet" : "No friends match your search"}</h3>
              <p>
                {friends.length === 0
                  ? "Explore New York with friends! Search by handle or find recommended ramblers to share discoveries with."
                  : "Try a different search term or handle."}
              </p>
              {friends.length === 0 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setActiveTab("find")}
                >
                  Find Explorers
                </button>
              ) : null}
            </div>
          ) : (
            <div className="friends-list">
              {filteredFriends.map((f) => {
                const mutual = getMutualInterests(user.interests, f.profile.interests);
                const initial = firstName(f.profile.name).slice(0, 1).toUpperCase();
                return (
                  <article key={f.friendshipId} className="card friend-card">
                    <button
                      type="button"
                      className="friend-card-hit"
                      onClick={() => go({ name: "friend-profile", friendId: f.profile.id })}
                    >
                      <div className="avatar friend-avatar">
                        {f.profile.photo ? <img src={f.profile.photo} alt="" /> : initial}
                      </div>
                      <div className="friend-info">
                        <div className="friend-title-row">
                          <h3 className="friend-name">{f.profile.name}</h3>
                          <span className="friend-handle">@{f.profile.username}</span>
                        </div>
                        {f.profile.bio ? <p className="friend-bio">{f.profile.bio}</p> : null}

                        {mutual.length > 0 ? (
                          <div className="mutual-tag-row">
                            <span className="mutual-label">Mutual:</span>
                            {mutual.map((id) => {
                              const item = INTERESTS.find((i) => i.id === id);
                              return (
                                <span key={id} className="chip chip-tiny">
                                  {item?.emoji} {item?.title}
                                </span>
                              );
                            })}
                          </div>
                        ) : null}

                        <div className="friend-stats-meta">
                          <span>{f.profile.discoveredIds.length} places discovered</span>
                          <span>·</span>
                          <span>{f.profile.questsCount} quests</span>
                          <span>·</span>
                          <span>{f.profile.passportPercent}% passport</span>
                        </div>
                      </div>
                    </button>
                    <div className="friend-card-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => go({ name: "friend-profile", friendId: f.profile.id })}
                      >
                        View Profile
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* TAB 2: REQUESTS (INCOMING & OUTGOING) */}
      {activeTab === "requests" ? (
        <div className="tab-pane stack">
          <section>
            <div className="section-head">
              <h2>Incoming Requests</h2>
              <p>People who want to ramble with you.</p>
            </div>

            {incomingRequests.length === 0 ? (
              <p className="empty">No pending friend requests.</p>
            ) : (
              <div className="stack">
                {incomingRequests.map((req) => {
                  const initial = firstName(req.profile.name).slice(0, 1).toUpperCase();
                  const mutual = getMutualInterests(user.interests, req.profile.interests);
                  return (
                    <div key={req.id} className="card friend-card request-card">
                      <div className="friend-card-hit">
                        <div className="avatar friend-avatar">
                          {req.profile.photo ? <img src={req.profile.photo} alt="" /> : initial}
                        </div>
                        <div className="friend-info">
                          <div className="friend-title-row">
                            <h3 className="friend-name">{req.profile.name}</h3>
                            <span className="friend-handle">@{req.profile.username}</span>
                          </div>
                          {req.profile.bio ? <p className="friend-bio">{req.profile.bio}</p> : null}
                          {mutual.length > 0 ? (
                            <div className="mutual-tag-row">
                              <span className="mutual-label">Shared:</span>
                              {mutual.map((id) => (
                                <span key={id} className="chip chip-tiny">
                                  {INTERESTS.find((i) => i.id === id)?.emoji} {INTERESTS.find((i) => i.id === id)?.title}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="request-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => void acceptRequest(req.id)}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => void declineRequest(req.id)}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {outgoingRequests.length > 0 ? (
            <section>
              <div className="section-head">
                <h2>Sent Requests</h2>
                <p>Pending requests awaiting approval.</p>
              </div>
              <div className="stack">
                {outgoingRequests.map((req) => {
                  const initial = firstName(req.profile.name).slice(0, 1).toUpperCase();
                  return (
                    <div key={req.id} className="card friend-card request-card">
                      <div className="friend-card-hit">
                        <div className="avatar friend-avatar">
                          {req.profile.photo ? <img src={req.profile.photo} alt="" /> : initial}
                        </div>
                        <div className="friend-info">
                          <h3 className="friend-name">{req.profile.name}</h3>
                          <span className="friend-handle">@{req.profile.username}</span>
                          <p className="meta-line">Request sent · Waiting for response</p>
                        </div>
                      </div>
                      <div className="request-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => void cancelRequest(req.id)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {/* TAB 3: FIND EXPLORERS */}
      {activeTab === "find" ? (
        <div className="tab-pane stack">
          <div className="field-search">
            <input
              type="search"
              placeholder="Search by @username or name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              autoFocus
            />
          </div>

          {searching ? <p className="meta-line">Searching NYC explorers…</p> : null}

          {searchQuery.trim() ? (
            <section>
              <div className="section-head">
                <h2>Search Results</h2>
                <p>Matching ramblers across New York City.</p>
              </div>

              {searchResults.length === 0 && !searching ? (
                <p className="empty">No explorers found matching &ldquo;{searchQuery}&rdquo;.</p>
              ) : (
                <div className="stack">
                  {searchResults.map((explorer) => (
                    <ExplorerCard
                      key={explorer.id}
                      explorer={explorer}
                      onAdd={() => void sendRequest(explorer.id)}
                      onView={() => go({ name: "friend-profile", friendId: explorer.id })}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section>
              <div className="section-head">
                <h2>Recommended for You</h2>
                <p>Explorers sharing your favorite NYC interests.</p>
              </div>

              <div className="stack">
                {recommended.length === 0 ? (
                  <p className="empty">No recommendations available right now.</p>
                ) : (
                  recommended.map((explorer) => (
                    <ExplorerCard
                      key={explorer.id}
                      explorer={explorer}
                      onAdd={() => void sendRequest(explorer.id)}
                      onView={() => go({ name: "friend-profile", friendId: explorer.id })}
                    />
                  ))
                )}
              </div>
            </section>
          )}
        </div>
      ) : null}
    </section>
  );
}

function ExplorerCard({
  explorer,
  onAdd,
  onView,
}: {
  explorer: FriendProfile;
  onAdd: () => void;
  onView: () => void;
}) {
  const { friends, incomingRequests, outgoingRequests } = useFriends();
  const user = useRequiredUser();
  const mutual = getMutualInterests(user.interests, explorer.interests);
  const initial = firstName(explorer.name).slice(0, 1).toUpperCase();

  const isFriend = friends.some((f) => f.profile.id === explorer.id);
  const hasSentReq = outgoingRequests.some((r) => r.friendId === explorer.id || r.profile.id === explorer.id);
  const hasReceivedReq = incomingRequests.some((r) => r.userId === explorer.id || r.profile.id === explorer.id);

  return (
    <article className="card friend-card">
      <button type="button" className="friend-card-hit" onClick={onView}>
        <div className="avatar friend-avatar">
          {explorer.photo ? <img src={explorer.photo} alt="" /> : initial}
        </div>
        <div className="friend-info">
          <div className="friend-title-row">
            <h3 className="friend-name">{explorer.name}</h3>
            <span className="friend-handle">@{explorer.username}</span>
          </div>
          {explorer.bio ? <p className="friend-bio">{explorer.bio}</p> : null}
          {mutual.length > 0 ? (
            <div className="mutual-tag-row">
              <span className="mutual-label">Mutual:</span>
              {mutual.map((id) => (
                <span key={id} className="chip chip-tiny">
                  {INTERESTS.find((i) => i.id === id)?.emoji} {INTERESTS.find((i) => i.id === id)?.title}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </button>

      <div className="friend-card-actions">
        {isFriend ? (
          <span className="badge badge-verified">✓ Friends</span>
        ) : hasSentReq ? (
          <span className="badge badge-live">Request sent</span>
        ) : hasReceivedReq ? (
          <span className="badge badge-live">Sent you a request</span>
        ) : (
          <button type="button" className="btn btn-sm btn-clay" onClick={onAdd}>
            + Add Friend
          </button>
        )}
      </div>
    </article>
  );
}
