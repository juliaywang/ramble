import { Brand } from "../components/Brand";
import { DesignIcon } from "../components/DesignIcon";
import { useState, type FormEvent } from "react";
import { firstName } from "../lib/format";
import { INTERESTS, type InterestId } from "../pipeline/types";
import { useRamble } from "../state/RambleContext";

export function WelcomeScreen() {
  const { user, go, continueSession } = useRamble();
  return (
    <section className="welcome">
      <div className="welcome-main">
        <Brand />
        <div className="welcome-copy">
          <p className="welcome-badge"><DesignIcon name="sparkles" size="sm" /> A new way to explore your city</p>
          <h1>Find the city<br /><span>between</span> the pins.</h1>
          <p className="lede">Ramble turns New York from a map of places into a map of communities, stories, and unexpected adventures.</p>
          <div className="welcome-actions">
            {user ? <button type="button" className="btn btn-primary" onClick={continueSession}>Continue as {firstName(user.name)} <DesignIcon name="arrow" /></button> : null}
            <button type="button" className={user ? "btn btn-ghost" : "btn btn-primary"} onClick={() => go({ name: "signup" })}>Create your account <DesignIcon name="arrow" /></button>
            <p className="fine">{user ? "A new account replaces the one saved on this device." : "Free to explore. No credit card needed."}</p>
          </div>
        </div>
        <p className="fine">Built for curious New Yorkers.</p>
      </div>
      <div className="welcome-art" aria-hidden="true">
        <div className="city-grid" />
        <div className="welcome-preview">
          <div className="preview-place">
            <div className="preview-top"><span className="preview-icon"><DesignIcon name="book" size="lg" /></span><span className="match">98% match</span></div>
            <h2>Book Culture</h2>
            <p className="meta-line">Independent bookstore · 0.2 mi</p>
            <p className="preview-why"><DesignIcon name="sparkles" size="sm" /> Because you love books and neighborhood staples</p>
          </div>
          <div className="preview-quest"><strong><DesignIcon name="dice" /> Side quest</strong><h2>Find a new favorite read</h2><p>+150 XP · 30 min</p></div>
        </div>
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
