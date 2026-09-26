import { useState, type FormEvent } from "react";
import { firstName } from "../lib/format";
import { INTERESTS, type InterestId } from "../pipeline/types";
import { useRamble } from "../state/RambleContext";

export function WelcomeScreen() {
  const { user, go, continueSession } = useRamble();
  return (
    <section className="welcome">
      <Skyline />
      <div className="welcome-copy">
        <p className="eyebrow">Morningside Heights</p>
        <h1 className="wordmark">Ramble</h1>
        <p className="tagline">Turn the city from a map of places into a map of communities.</p>
        <p className="lede">
          A walking companion for the blocks around Columbia — markets, mutual aid, chapels, game cafés, and the people who keep them going.
        </p>
      </div>
      <div className="welcome-actions">
        {user ? (
          <button type="button" className="btn btn-primary btn-block" onClick={continueSession}>
            Continue as {firstName(user.name)}
          </button>
        ) : null}
        <button type="button" className={user ? "btn btn-ghost btn-block" : "btn btn-clay btn-block"} onClick={() => go({ name: "signup" })}>
          Create account
        </button>
        {user ? <p className="fine">A new account replaces the one saved on this device.</p> : null}
      </div>
    </section>
  );
}

export function SignupScreen() {
  const { back, beginSignup, pending } = useRamble();
  const [name, setName] = useState(pending?.name ?? "");
  const [email, setEmail] = useState(pending?.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Add the name you want on the passport.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("That email doesn't look finished.");
      return;
    }
    if (password.length < 6) {
      setError("Use at least 6 characters. It stays on this device, then we discard it.");
      return;
    }
    setError(null);
    beginSignup({ name: trimmed, email: email.trim() });
  }

  return (
    <section className="page auth-page">
      <button type="button" className="back-btn" onClick={back}>
        Back
      </button>
      <p className="eyebrow">Account</p>
      <h1>Make a passport.</h1>
      <p className="lede">
        Your name, interests, and finished quests stay in this browser. The password is checked here and not stored.
      </p>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          What should we call you?
          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Alex" />
        </label>
        <label className="field">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@email.com"
            inputMode="email"
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="At least 6 characters"
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" className="btn btn-primary btn-block">
          Choose interests
        </button>
      </form>
    </section>
  );
}

export function InterestsScreen() {
  const { screen, user, pending, back, finishSignup, saveInterests } = useRamble();
  const editing = screen.name === "interests" && screen.mode === "edit";
  const initial = editing ? user?.interests ?? [] : [];
  const [selected, setSelected] = useState<InterestId[]>(initial);

  function toggle(id: InterestId) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function save() {
    if (selected.length < 3) return;
    if (editing) saveInterests(selected);
    else finishSignup(selected);
  }

  return (
    <section className="page auth-page">
      <button type="button" className="back-btn" onClick={back}>
        Back
      </button>
      <p className="eyebrow">{editing ? "Profile" : pending ? `For ${firstName(pending.name)}` : "Interests"}</p>
      <h1>What should the city show you?</h1>
      <p className="lede">Pick at least three. Recommendations, side quests, and journeys all start from this list.</p>
      <div className="interest-grid">
        {INTERESTS.map((interest) => {
          const on = selected.includes(interest.id);
          return (
            <button
              key={interest.id}
              type="button"
              className="interest"
              aria-pressed={on}
              onClick={() => toggle(interest.id)}
            >
              <span className="interest-emoji" aria-hidden="true">
                {interest.emoji}
              </span>
              <span className="interest-title">{interest.title}</span>
              <span className="interest-blurb">{interest.blurb}</span>
            </button>
          );
        })}
      </div>
      <div className="auth-save">
        <p className="fine">{selected.length} selected · 3 minimum</p>
        <button type="button" className="btn btn-primary btn-block" disabled={selected.length < 3} onClick={save}>
          {editing ? "Save interests" : "Start rambling"}
        </button>
      </div>
    </section>
  );
}

function Skyline() {
  return (
    <svg className="skyline" viewBox="0 0 360 150" aria-hidden="true">
      <path d="M0 118c28-10 48-8 70-2 18 5 30 2 48-6 22-10 40-6 62 2 20 7 36 4 54-4 22-10 40-8 70 2 18 6 32 4 56-2v42H0V118z" fill="#d5e6ea" />
      <path d="M0 128c40 6 70-4 110 2s70 8 110-2 80 4 140-6v28H0v-22z" fill="#c5d9bf" />
      <path d="M18 112V78h16l6 10 6-10h16v34" fill="#e7d7c2" stroke="#1c1915" strokeWidth="1.4" />
      <path d="M24 96h8M40 96h8M24 104h8M40 104h8" stroke="#1c1915" strokeWidth="1.2" />
      <path d="M86 112V64h22v48" fill="#efe6d8" stroke="#1c1915" strokeWidth="1.4" />
      <path d="M92 78h10M92 90h10M92 102h10" stroke="#1c1915" strokeWidth="1.2" />
      <path d="M132 112V88h46v24" fill="#e4cbb0" stroke="#1c1915" strokeWidth="1.4" />
      <circle cx="155" cy="74" r="16" fill="none" stroke="#1c1915" strokeWidth="1.4" />
      <path d="M155 58v-14M147 66h16" stroke="#1c1915" strokeWidth="1.3" />
      <rect x="148" y="96" width="14" height="16" fill="#f7f1e6" stroke="#1c1915" strokeWidth="1.2" />
      <path d="M196 112V70h18v42M220 112V82h28v30" fill="#efe2cf" stroke="#1c1915" strokeWidth="1.4" />
      <path d="M270 112c8-28 14-44 22-44s14 16 22 44" fill="#2f6b50" />
      <circle cx="292" cy="60" r="14" fill="#3d7a5c" />
      <path d="M248 112V90h12v22" fill="#d7c4a4" stroke="#1c1915" strokeWidth="1.2" />
    </svg>
  );
}
