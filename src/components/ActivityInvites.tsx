import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { activityRewards, actOnInvite, listInvites, sendInvite, type ActivityInvite, type ActivityStop } from "../lib/activityInvites";
import { getUserId } from "../lib/friendsService";
import { useFriends } from "../state/FriendsContext";
import { useRamble, useRequiredUser } from "../state/RambleContext";

const Context = createContext({ rows: [] as ActivityInvite[], error: "", refresh: async () => {} });
export function ActivityProvider({ children }: { children: ReactNode }) {
  const { user, session, syncActivityQuests } = useRamble();
  const id = session && user ? getUserId(user) : "";
  const [rows, setRows] = useState<ActivityInvite[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setRows([]); setError("");
    if (!id) return;
    const refresh = async () => {
      try {
        const result = await listInvites(id);
        if (live) { setRows(result); setError(""); }
      } catch (e) { if (live) setError((e as Error).message); }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    window.addEventListener("focus", refresh);
    return () => { live = false; clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [id]);
  useEffect(() => {
    if (id) syncActivityQuests(id, activityRewards(rows, id));
  }, [id, rows, syncActivityQuests]);
  const refresh = async () => {
    if (!id) return;
    try { setRows(await listInvites(id)); setError(""); }
    catch (e) { setError((e as Error).message); }
  };
  return <Context.Provider value={{ rows: rows.filter(r => r.sender_id === id || r.recipient_id === id), error, refresh }}>{children}</Context.Provider>;
}
export function useActivityInvites() { return useContext(Context); }

export function InviteFriend({ activityKey, title, kind, stops }: { activityKey: string; title: string; kind: "quest" | "journey"; stops: ActivityStop[] }) {
  const user = useRequiredUser();
  const { friends } = useFriends();
  const { go } = useRamble();
  const { rows, refresh } = useActivityInvites();
  const [friend, setFriend] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const existing = rows.find(r => r.sender_id === getUserId(user) && r.activity_key === activityKey);
  const selected = friends.find(f => f.profile.id === friend)?.profile;
  const bonus = stops.reduce((sum, stop) => sum + Math.ceil(stop.quest.xp * .5), 0);
  return <section className="together-card">
    <div className="together-heading">
      <div className="together-symbol" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="11" r="4" /><path d="M4 26v-3a8 8 0 0 1 16 0v3M22 7a4 4 0 0 1 0 8m2 4a7 7 0 0 1 4 7" />
        </svg>
      </div>
      <div><p className="together-kicker">A little company. More adventure.</p><h2>Better together</h2></div>
    </div>
    <div className="together-reward">
      <span><strong>+50% XP</strong><small>for each of you</small></span>
      <p>Up to <b>{bonus} bonus XP</b> each{kind === "journey" ? " across this route" : " on this quest"}.</p>
    </div>
    {existing ? <div className="together-sent">
      <span className={`together-status is-${existing.status}`}>{existing.status === "accepted" ? "✓ Ready to explore" : existing.status === "pending" ? "Invite sent" : "Invite declined"}</span>
      <p>{existing.status === "accepted" ? `You and ${existing.recipient_name} are in. Let’s go!` : existing.status === "pending" ? `Waiting for ${existing.recipient_name} to join you.` : `${existing.recipient_name} can’t join this time.`}</p>
      <button type="button" className="btn together-cta btn-block" onClick={() => go({ name: "friends" })}>
        {existing.status === "accepted" ? "Open shared adventure" : "View invitation"} <span aria-hidden="true">→</span>
      </button>
    </div> : friends.length ? <>
      <fieldset className="together-picker">
        <legend>Who’s coming with you?</legend>
        <div className="together-friends">
          {friends.map(({ profile }) => <label key={profile.id} className="together-friend">
            <input type="radio" name={`companion-${activityKey}`} value={profile.id} checked={friend === profile.id} disabled={busy} onChange={() => setFriend(profile.id)} />
            <span className="together-friend-body">
              <span className="together-avatar" aria-hidden="true">{profile.photo ? <img src={profile.photo} alt="" /> : profile.name.slice(0, 1).toUpperCase()}</span>
              <span className="together-friend-name"><strong>{profile.name}</strong><small>@{profile.username}</small></span>
              <span className="together-choice" aria-hidden="true">{friend === profile.id ? "✓" : ""}</span>
            </span>
          </label>)}
        </div>
      </fieldset>
      <button type="button" className="btn together-cta btn-block" disabled={!selected || busy || !stops.length} onClick={async () => {
        if (!selected) return;
        setBusy(true); setNote("");
        try {
          await sendInvite({ sender_id: getUserId(user), recipient_id: selected.id, sender_name: user.name,
            recipient_name: selected.name, activity_key: activityKey, title, kind, stops });
          setNote("Invite sent! Open Friends to check in together."); await refresh();
        } catch (e) { setNote((e as Error).message); }
        finally { setBusy(false); }
      }}>{busy ? "Sending invite…" : selected ? `Invite ${selected.name.split(" ")[0]}` : "Choose a friend to invite"}{selected && !busy && <span aria-hidden="true">→</span>}</button>
    </> : <div className="together-empty">
      <strong>Every adventure starts with a friend.</strong>
      <p>Add someone to your friends list, then invite them along.</p>
      <button type="button" className="btn together-cta btn-block" onClick={() => go({ name: "friends", view: "find" })}>Find friends <span aria-hidden="true">→</span></button>
    </div>}
    <p className="together-footnote">Check in at the same stop within 30 minutes of each other to unlock the bonus.</p>
    {note && <p className="together-note" role="status">{note}</p>}
  </section>;
}

export function ActivityInbox() {
  const user = useRequiredUser();
  const id = getUserId(user);
  const { rows, error, refresh } = useActivityInvites();
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  async function act(row: ActivityInvite, action: string, stop?: ActivityStop) {
    setBusy(row.id); setNote("");
    try { await actOnInvite(row, id, action, stop); await refresh(); }
    catch (e) { setNote((e as Error).message); }
    finally { setBusy(""); }
  }
  return <section className="activity-inbox">
    <div className="section-head"><h2>Activity invites</h2><button className="text-btn" onClick={() => void refresh()}>Refresh</button></div>
    {error && <p role="alert">{error}</p>}
    {note && <p role="status">{note}</p>}
    {!rows.length && !error && <p className="fine">Invite friends from an active quest or a journey.</p>}
    {rows.map(row => {
      const sender = row.sender_id === id;
      const mine = sender ? row.sender_checks : row.recipient_checks;
      const other = sender ? row.recipient_checks : row.sender_checks;
      return <article className="level-progress" key={row.id}>
        <p className="eyebrow">{row.kind} · {row.status}</p><h3>{row.title}</h3>
        <p>With {sender ? row.recipient_name : row.sender_name}</p>
        {row.status === "pending" && (!sender ? <div className="stack">
          <button disabled={!!busy} className="btn btn-primary" onClick={() => void act(row, "accepted")}>Join</button>
          <button disabled={!!busy} className="btn btn-ghost" onClick={() => void act(row, "declined")}>Decline</button>
        </div> : <p className="fine">Waiting for your friend to join.</p>)}
        {row.status === "accepted" && <>
          <p className="fine">Check in within 200 feet of each stop. Both check-ins must be within 30 minutes for the bonus.</p>
          {row.stops.map(stop => {
            const reward = activityRewards([row], id).find(q => q.discoveryId === stop.quest.discoveryId);
            return <div className="shared-stop" key={stop.quest.id}>
              <strong>{stop.name}</strong><p className="fine">{stop.quest.objective}</p>
              <a className="text-btn" href={`https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`} target="_blank" rel="noreferrer">Open in Maps</a>
              <p className="fine">{stop.quest.xp} base XP + {Math.ceil(stop.quest.xp * .5)} together bonus</p>
              {mine[stop.quest.id] ? <p role="status">{reward?.teamBonus ? `Completed together! +${reward.teamBonus} bonus XP each.` : other[stop.quest.id] ? "Completed. Check-ins were too far apart for the bonus." : "Your XP is earned. Waiting for your friend's check-in for the bonus."}</p> :
                <button disabled={!!busy} className="btn btn-primary btn-block" onClick={() => void act(row, "check", stop)}>{busy === row.id ? "Checking location…" : "I finished · Check in"}</button>}
            </div>;
          })}
        </>}
      </article>;
    })}
  </section>;
}
