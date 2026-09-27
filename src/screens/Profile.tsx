import { useState, type FormEvent } from "react";
import { firstName, formatWhen, greeting, normalizeUsername, usernameFromName } from "../lib/format";
import { readProfilePhoto } from "../lib/photo";
import { passportPercent, passportRows, totalXp } from "../pipeline/agent";
import { boroughName } from "../pipeline/geo";
import { INTERESTS, NEIGHBORHOOD } from "../pipeline/types";
import { BackRow } from "../components/ui";
import { useFeed } from "../state/FeedContext";
import { useFriends } from "../state/FriendsContext";
import { useRamble, useRequiredUser } from "../state/RambleContext";

export function ProfileScreen() {
  const user = useRequiredUser();
  const { back, go, logOut, saveAccount } = useRamble();
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username || usernameFromName(user.name));
  const [email, setEmail] = useState(user.email);
  const [bio, setBio] = useState(user.bio ?? "");
  const [photo, setPhoto] = useState<string | null>(user.photo ?? null);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);
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
  const explored = [...new Set(discovered.map((place) => place.borough))];
  function jumpTo(id: string) {
    const heading = document.getElementById(id);
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }
  const { friends, incomingRequests } = useFriends();
  const initial = firstName(name || user.name).slice(0, 1).toUpperCase();

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setSavedNote(false);
    try {
      setPhoto(await readProfilePhoto(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not use that picture.");
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError("Use at least two characters for your name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("That email doesn't look finished.");
      return;
    }
    const handle = normalizeUsername(username);
    if (!/^[a-z0-9_]{3,16}$/.test(handle)) {
      setError("Usernames are 3–16 letters, numbers, or underscores.");
      return;
    }
    setError(null);
    saveAccount({ name, email, username: handle, bio, photo });
    setSavedNote(true);
  }

  return (
    <section className="page">
      <BackRow onBack={back} />
      <header className="profile-head">
        <div className="avatar" aria-hidden="true">
          {photo ? <img src={photo} alt="" /> : initial}
        </div>
        <div>
          <p className="eyebrow">{greeting(user.name).split(",")[0]}</p>
          <h1>{user.name}</h1>
          <p className="meta-line">@{user.username || usernameFromName(user.name)}</p>
          <p className="meta-line">{user.bio || "Add a short bio so the passport has a voice."}</p>
        </div>
      </header>

      <form className="stack account-form" onSubmit={save}>
        <div className="section-head">
          <h2>Edit profile</h2>
          <p>Change your photo, username, name, and bio. This stays on this device.</p>
        </div>
        <label className="photo-picker">
          <span className="avatar" aria-hidden="true">{photo ? <img src={photo} alt="" /> : initial}</span>
          <span>
            <strong>Change photo</strong>
            <small>Square picture, saved with your account</small>
          </span>
          <input type="file" accept="image/*" onChange={(event) => void onPhoto(event.target.files?.[0])} />
        </label>
        {photo ? (
          <button type="button" className="text-btn" onClick={() => { setPhoto(null); setSavedNote(false); }}>
            Remove picture
          </button>
        ) : null}
        <label className="field">
          Name
          <input value={name} onChange={(event) => { setName(event.target.value); setSavedNote(false); }} autoComplete="name" />
        </label>
        <label className="field">
          Username
          <input value={username} onChange={(event) => { setUsername(event.target.value); setSavedNote(false); }} autoComplete="username" spellCheck={false} />
        </label>
        <label className="field">
          Email
          <input value={email} onChange={(event) => { setEmail(event.target.value); setSavedNote(false); }} autoComplete="email" inputMode="email" />
        </label>
        <label className="field">
          Bio
          <textarea value={bio} onChange={(event) => { setBio(event.target.value); setSavedNote(false); }} rows={3} maxLength={180} placeholder="A line about how you like to walk the city." />
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {savedNote ? <p className="fine" role="status">Saved on this device.</p> : null}
        <button type="submit" className="btn btn-primary btn-block">Save profile</button>
      </form>

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
          <b>{explored.length}</b>
          <span>Boroughs explored</span>
          <small>
            {NEIGHBORHOOD.name} · {percent}%
          </small>
        </button>
        <button type="button" className="stat stat-link" onClick={() => jumpTo("profile-saved")} aria-controls="profile-saved">
          <b>{saved.length}</b>
          <span>Saved places</span>
        </button>
        <button type="button" className="stat stat-link" onClick={() => go({ name: "friends" })}>
          <b>{friends.length}</b>
          <span>Friends</span>
          <small>{incomingRequests.length > 0 ? `${incomingRequests.length} pending request${incomingRequests.length > 1 ? "s" : ""}` : "Community"}</small>
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
        <h2 id="profile-neighborhoods" className="profile-anchor" tabIndex={-1}>Boroughs explored</h2>
      </div>
      <ul className="log-list">
        {explored.map((borough) => (
          <li key={borough}>
            <button type="button" onClick={() => go({ name: "passport" })}>
              <strong>{boroughName(borough)}</strong>
              <small>{percent}% of the city passport · Open passport</small>
            </button>
          </li>
        ))}
      </ul>

      <p className="fine pipeline-note">
        Verified places across Manhattan, Brooklyn, Queens, the Bronx, and Staten Island come from NYC Open Data — markets, public art, community gardens, and libraries, museums, and community centers.
      </p>
      <button type="button" className="btn btn-ghost btn-block" onClick={logOut}>
        Log out
      </button>
    </section>
  );
}
