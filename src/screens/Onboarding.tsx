import { getSupabaseClient } from "../lib/supabase";
import { authenticateLocal } from "../lib/storage";
import { isUsernameTaken } from "../lib/friendsService";
import { Brand } from "../components/Brand";
import { DesignIcon } from "../components/DesignIcon";
import { useEffect, useState, type FormEvent } from "react";
import { firstName, normalizeUsername } from "../lib/format";
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
            <button type="button" className={user ? "btn btn-ghost" : "btn btn-primary"} onClick={() => go({ name: "signup" })}>Sign in / Create account <DesignIcon name="arrow" /></button>
            <p className="fine">{user ? "Accounts and progress are saved separately in this browser." : "Free to explore. No credit card needed."}</p>
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
  const { back, beginSignup, pending, loginLocal } = useRamble();
  const [mode, setMode] = useState<"login" | "create">(pending ? "create" : "login");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(pending?.name ?? "");
  const [username, setUsername] = useState(pending?.username ?? "");
  const [usernameEdited, setUsernameEdited] = useState(Boolean(pending?.username));
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [email, setEmail] = useState(pending?.email ?? "");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "create") {
      setUsernameStatus("idle");
      setUsernameMessage(null);
      return;
    }

    const clean = normalizeUsername(username);
    if (!clean) {
      setUsernameStatus("idle");
      setUsernameMessage(null);
      return;
    }

    if (clean.length < 3) {
      setUsernameStatus("invalid");
      setUsernameMessage("Username must be at least 3 characters");
      return;
    }

    if (!/^[a-z0-9_]{3,16}$/.test(clean)) {
      setUsernameStatus("invalid");
      setUsernameMessage("3–16 characters (letters, numbers, underscores)");
      return;
    }

    setUsernameStatus("checking");
    setUsernameMessage("Checking availability…");

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const taken = await isUsernameTaken(clean);
        if (cancelled) return;
        if (taken) {
          setUsernameStatus("taken");
          setUsernameMessage(`@${clean} is already taken`);
        } else {
          setUsernameStatus("available");
          setUsernameMessage(`@${clean} is available`);
        }
      } catch {
        if (!cancelled) {
          setUsernameStatus("idle");
          setUsernameMessage(null);
        }
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    const cleanUsername = normalizeUsername(username);

    if (mode === "create") {
      if (trimmed.length < 2) {
        setError("Add the name you want on the passport.");
        return;
      }
      if (cleanUsername.length < 3) {
        setError("Username must be at least 3 characters.");
        return;
      }
      if (!/^[a-z0-9_]{3,16}$/.test(cleanUsername)) {
        setError("Usernames are 3–16 letters, numbers, or underscores.");
        return;
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("That email doesn't look finished.");
      return;
    }
    if (password.length < 6) {
      setError("Use at least 6 characters.");
      return;
    }
    setError(null);
    setBusy(true);

    try {
      if (mode === "create") {
        const taken = await isUsernameTaken(cleanUsername);
        if (taken) {
          setError(`@${cleanUsername} is already taken. Please choose another username.`);
          setUsernameStatus("taken");
          setUsernameMessage(`@${cleanUsername} is already taken`);
          setBusy(false);
          return;
        }
      }

      const client = getSupabaseClient();
      if (client) {
        const result = mode === "create"
          ? await client.auth.signUp({
              email: email.trim(),
              password,
              options: {
                data: { name: trimmed, username: cleanUsername },
                emailRedirectTo: window.location.origin,
              },
            })
          : await client.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw result.error;
        if (!result.data.session) setNotice("Check your email to confirm your account, then sign in.");
        return;
      }
      const existing = await authenticateLocal(email, password, mode === "create");
      if (existing) {
        loginLocal(existing);
      } else {
        beginSignup({ name: trimmed, email: email.trim(), username: cleanUsername });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not access local account storage.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page auth-page">
      <button type="button" className="back-btn" onClick={back}>
        Back
      </button>
      <p className="eyebrow">Account</p>
      <h1>{mode === "login" ? "Welcome back." : "Make a passport."}</h1>
      <p className="lede">
        {getSupabaseClient() ? "Sign in to restore your friends and progress across devices." : "Use any email for this local demo. Your accounts stay in this browser."}
      </p>
      <div className="chips">
        <button type="button" className="chip" aria-pressed={mode === "login"} disabled={busy} onClick={() => { setMode("login"); setError(null); }}>Sign in</button>
        <button type="button" className="chip" aria-pressed={mode === "create"} disabled={busy} onClick={() => { setMode("create"); setError(null); }}>Create account</button>
      </div>
      <form className="stack" onSubmit={submit}>
        {mode === "create" && (
          <>
            <label className="field">
              What should we call you?
              <input
                value={name}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setName(nextName);
                  if (!usernameEdited) {
                    setUsername(normalizeUsername(nextName));
                  }
                }}
                autoComplete="name"
                placeholder="Alex"
              />
            </label>
            <label className="field">
              Username
              <div className="username-input-wrap">
                <span className="username-prefix" aria-hidden="true">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => {
                    setUsernameEdited(true);
                    setUsername(normalizeUsername(event.target.value));
                  }}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="alex_walks"
                  maxLength={16}
                />
              </div>
              {usernameMessage ? (
                <p className={`field-hint is-${usernameStatus}`} role="status">
                  {usernameStatus === "available" && <DesignIcon name="check" size="sm" />}
                  {usernameStatus === "taken" && <DesignIcon name="x" size="sm" />}
                  {usernameMessage}
                </p>
              ) : (
                <p className="field-hint">Your unique @handle across Ramble (3–16 letters, numbers, underscores)</p>
              )}
            </label>
          </>
        )}
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
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="At least 6 characters"
          />
        </label>
        {notice && <p role="status">{notice}</p>}
        {error ? <p className="form-error">{error}</p> : null}
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={busy || (mode === "create" && (usernameStatus === "taken" || usernameStatus === "checking"))}
        >
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Choose interests"}
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
    <section className="page auth-page interests-page">
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
        <p className="fine" role="status">{selected.length} selected · 3 minimum</p>
        <button type="button" className="btn btn-primary btn-block" disabled={selected.length < 3} onClick={save}>
          {editing ? "Save interests" : "Start rambling"}
        </button>
      </div>
    </section>
  );
}
