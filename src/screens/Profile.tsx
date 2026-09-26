import { firstName, formatWhen, greeting } from "../lib/format";
import { passportPercent, passportRows, totalXp } from "../pipeline/agent";
import { INTERESTS, NEIGHBORHOOD } from "../pipeline/types";
import { useFeed } from "../state/FeedContext";
import { useRamble, useRequiredUser } from "../state/RambleContext";

export function ProfileScreen() {
  const user = useRequiredUser();
  const { go, logOut } = useRamble();
  const feed = useFeed();
  const completed = user.quests
    .filter((quest) => quest.status === "completed")
    .slice()
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const saved = user.savedIds
    .map((id) => feed.places.find((place) => place.id === id))
    .filter((place) => place !== undefined);
  const percent = passportPercent(passportRows(user, feed.places));
  const discovered = feed.places.filter((place) => user.discoveredIds.includes(place.id));
  function jumpTo(id: string) {
    const heading = document.getElementById(id);
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }
  const initial = firstName(user.name).slice(0, 1).toUpperCase();

  return (
    <section className="page">
      <header className="profile-head">
        <div className="avatar" aria-hidden="true">
          {initial}
        </div>
        <div>
          <p className="eyebrow">{greeting(user.name).split(",")[0]}</p>
          <h1>{user.name}</h1>
          <p className="meta-line">{user.email}</p>
        </div>
      </header>

      <div className="stats">
        <button type="button" className="stat stat-link" onClick={() => jumpTo("profile-quests")} aria-controls="profile-quests">
          <b>{completed.length}</b>
          <span>Quests completed</span>
          <small>{totalXp(user.quests)} XP</small>
        </button>
        <button type="button" className="stat stat-link" onClick={() => jumpTo("profile-discovered")} aria-controls="profile-discovered">
          <b>{user.discoveredIds.length}</b>
          <span>Places discovered</span>
        </button>
        <button type="button" className="stat stat-link" onClick={() => jumpTo("profile-neighborhoods")} aria-controls="profile-neighborhoods">
          <b>1</b>
          <span>Neighborhoods explored</span>
          <small>
            {NEIGHBORHOOD.name} · {percent}%
          </small>
        </button>
        <button type="button" className="stat stat-link" onClick={() => jumpTo("profile-saved")} aria-controls="profile-saved">
          <b>{saved.length}</b>
          <span>Saved places</span>
        </button>
      </div>

      <div className="section-head row-head">
        <h2>Interests</h2>
        <button type="button" className="text-btn" onClick={() => go({ name: "interests", mode: "edit" })}>
          Edit
        </button>
      </div>
      <div className="chips static-chips">
        {user.interests.map((id) => {
          const interest = INTERESTS.find((item) => item.id === id);
          return (
            <span key={id} className="chip chip-static">
              {interest?.emoji} {interest?.title}
            </span>
          );
        })}
      </div>

      <div className="section-head">
        <h2 id="profile-saved" className="profile-anchor" tabIndex={-1}>Saved places</h2>
      </div>
      {saved.length === 0 ? (
        <p className="empty">Save a place from its page and it will wait here.</p>
      ) : (
        <ul className="log-list">
          {saved.map((place) => (
            <li key={place.id}>
              <button type="button" onClick={() => go({ name: "place", id: place.id })}>
                <strong>{place.name}</strong>
                <small>{place.address}</small>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="section-head">
        <h2 id="profile-quests" className="profile-anchor" tabIndex={-1}>Quests completed</h2>
      </div>
      {completed.length === 0 ? (
        <p className="empty">Completed side quests will show up here, still tied to this account.</p>
      ) : (
        <ul className="log-list">
          {completed.map((quest) => (
            <li key={quest.id}>
              <button type="button" onClick={() => go({ name: "quest", id: quest.id })}>
                <strong>{quest.title}</strong>
                <small>
                  {quest.completedAt ? formatWhen(quest.completedAt) : "Completed"} · {quest.xp} XP
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="section-head">
        <h2 id="profile-discovered" className="profile-anchor" tabIndex={-1}>Places discovered</h2>
      </div>
      {discovered.length ? (
        <ul className="log-list">
          {discovered.map((place) => (
            <li key={place.id}>
              <button type="button" onClick={() => go({ name: "place", id: place.id })}>
                <strong>{place.name}</strong><small>{place.address}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="empty">Your discovered places will appear here.</p>}

      <div className="section-head">
        <h2 id="profile-neighborhoods" className="profile-anchor" tabIndex={-1}>Neighborhoods explored</h2>
      </div>
      <ul className="log-list">
        <li><button type="button" onClick={() => go({ name: "passport" })}>
          <strong>{NEIGHBORHOOD.name}</strong><small>{percent}% explored · Open passport</small>
        </button></li>
      </ul>

      <p className="fine pipeline-note">
        {NEIGHBORHOOD.name}. Verified places come from five NYC Open Data feeds — markets, public art, community gardens, landmarks, and libraries, museums, and community centers. Live Discovery is still the saved stand-in for a later search.
      </p>
      <button type="button" className="btn btn-ghost btn-block" onClick={logOut}>
        Log out
      </button>
    </section>
  );
}
