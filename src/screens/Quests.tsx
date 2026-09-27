import { DesignIcon, categoryIcons, categoryColors } from "../components/DesignIcon";
import { useEffect, useMemo } from "react";
import { BackRow, Generating, OpenInMaps, PlaceMedia, SourceBadge } from "../components/ui";
import { durationLabel, formatWhen } from "../lib/format";
import { motionDelay } from "../lib/motion";
import { passportLabel, passportPercent, passportRows, rollSideQuest, stampIsNew, totalXp } from "../pipeline/agent";
import { distanceMiles, formatDistance, walkMinutes, withinWalk } from "../pipeline/geo";
import { NEIGHBORHOOD } from "../pipeline/types";
import { useLocation } from "../state/LocationContext";
import { useFeed, usePlace } from "../state/FeedContext";
import { useRamble, useRequiredUser } from "../state/RambleContext";

function questLines(start: string) {
  return [
    "Looking at what you’ve already walked…",
    "Checking markets, gardens, and libraries nearby…",
    `Writing a quest within a walk of ${start}…`,
  ];
}

function useWalkPlaces() {
  const feed = useFeed();
  const { origin } = useLocation();
  return useMemo(() => {
    const places = origin ? withinWalk(feed.places, origin) : [];
    const ids = new Set(places.map((place) => place.id));
    return {
      origin,
      places,
      templates: feed.questTemplates.filter((template) => ids.has(template.discoveryId)),
    };
  }, [feed.places, feed.questTemplates, origin]);
}

export function QuestsScreen({ highlightId }: { highlightId?: string }) {
  const user = useRequiredUser();
  const { go } = useRamble();
  const { origin, request } = useLocation();
  const active = user.quests.filter((quest) => quest.status === "active");
  const completed = user.quests
    .filter((quest) => quest.status === "completed")
    .slice()
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  return (
    <section className="page">
      <header className="quest-hero">
        <p className="eyebrow">Side quests</p>
        <h1>Give the neighborhood a next move.</h1>
        <p className="lede">
          A side quest is a spontaneous stop written from NYC places, live discoveries, your interests, and the quests you’ve already finished.
        </p>
        <button
          type="button"
          className="btn btn-clay btn-block"
          onClick={() => {
            void (async () => {
              if (!origin && !(await request())) return;
              go({ name: "generating-quest", avoid: [] });
            })();
          }}
        >
          🎲 Give me a side quest
        </button>
        <p className="fine">{totalXp(user.quests)} exploration XP so far</p>
      </header>

      <div className="section-head">
        <h2>Active</h2>
      </div>
      {active.length === 0 ? (
        <p className="empty">No quest in progress. Roll one and the next hour gets specific.</p>
      ) : (
        <div className="stack">
          {active.map((quest) => (
            <QuestRow key={quest.id} questId={quest.id} highlight={quest.id === highlightId} />
          ))}
        </div>
      )}

      <div className="section-head">
        <h2>Completed</h2>
      </div>
      {completed.length === 0 ? (
        <p className="empty">Finished quests stay with your account and fill the passport.</p>
      ) : (
        <div className="stack">
          {completed.map((quest) => (
            <QuestRow key={quest.id} questId={quest.id} highlight={quest.id === highlightId} />
          ))}
        </div>
      )}
    </section>
  );
}

function QuestRow({ questId, highlight }: { questId: string; highlight: boolean }) {
  const user = useRequiredUser();
  const { go } = useRamble();
  const quest = user.quests.find((item) => item.id === questId);
  const place = usePlace(quest?.discoveryId);
  if (!quest || !place) return null;
  const { origin } = useLocation();
  const minutes = origin ? walkMinutes(distanceMiles(origin, place)) : null;
  return (
    <button
      type="button"
      className={highlight ? "card quest-row is-highlight" : "card quest-row"}
      onClick={() => go({ name: "quest", id: quest.id })}
    >
      <span className="quest-row-mark category-icon" style={{ background: categoryColors[place.category] }} aria-hidden="true">
        <DesignIcon name={categoryIcons[place.category]} />
      </span>
      <span>
        <strong>{quest.title}</strong>
        <small>
          {place.name} · {minutes === null ? "location needed" : `${minutes + quest.visitMinutes} min`} · {quest.xp} XP
          {quest.status === "completed" && quest.completedAt ? ` · ${formatWhen(quest.completedAt)}` : ""}
        </small>
      </span>
      <span className={quest.status === "completed" ? "status done" : "status"}>{quest.status === "completed" ? "Done" : "Active"}</span>
    </button>
  );
}

export function GeneratingQuestScreen() {
  const { screen, replace, user } = useRamble();
  const { origin, places, templates } = useWalkPlaces();
  useEffect(() => {
    if (!user || !origin || screen.name !== "generating-quest") return;
    const { avoid } = screen;
    const draft = rollSideQuest(user, places, templates, avoid, origin);
    const handle = window.setTimeout(() => {
      replace(draft ? { name: "quest-offer", draft, avoid } : { name: "quest-empty" });
    }, motionDelay(1500));
    return () => window.clearTimeout(handle);
  }, [origin, places, replace, screen, templates, user]);

  return <Generating mark="🎲" lines={origin ? questLines(origin.label) : ["Finding where you are…"]} />;
}

export function QuestOfferScreen() {
  const { screen, go, replace, acceptQuest, back } = useRamble();
  const draft = screen.name === "quest-offer" ? screen.draft : undefined;
  const place = usePlace(draft?.discoveryId);
  if (screen.name !== "quest-offer" || !draft || !place) return null;
  const { avoid } = screen;
  const { origin } = useLocation();
  const walk = origin ? walkMinutes(distanceMiles(origin, place)) : null;
  const total = (walk ?? 0) + draft.visitMinutes;

  return (
    <section className="page page-dock">
      <BackRow onBack={back} label="Back" />
      <p className="eyebrow">Side quest</p>
      <h1>{draft.title}</h1>
      <p className="objective">{draft.objective}</p>
      <button type="button" className="card dest-card" onClick={() => go({ name: "place", id: place.id })}>
        <PlaceMedia place={place} />
        <div>
          <p className="eyebrow">Destination</p>
          <strong>{place.name}</strong>
          <small>{place.address}</small>
          <SourceBadge source={place.source} />
        </div>
      </button>
      <div className="meta-tiles">
        <div>
          <b>{origin ? formatDistance(distanceMiles(origin, place)) : "—"}</b>
          <span>{walk === null ? "location needed" : `${walk} min walk`}</span>
        </div>
        <div>
          <b>{durationLabel(total)}</b>
          <span>door to door</span>
        </div>
        <div>
          <b>{draft.xp}</b>
          <span>XP</span>
        </div>
      </div>
      <section className="why-panel">
        <h2>Why this quest</h2>
        <p>{draft.why}</p>
      </section>
      <div className="dock">
        <OpenInMaps place={place} />
        <button type="button" className="btn btn-clay btn-block" onClick={() => acceptQuest(draft)}>
          Accept quest
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => replace({ name: "generating-quest", avoid: [...avoid, draft.templateId] })}
        >
          Roll another
        </button>
      </div>
    </section>
  );
}

export function QuestDetailScreen({ id }: { id: string }) {
  const user = useRequiredUser();
  const { back, completeQuest, abandonQuest } = useRamble();
  const quest = user.quests.find((item) => item.id === id);
  const place = usePlace(quest?.discoveryId);
  if (!quest || !place) {
    return (
      <section className="page">
        <BackRow onBack={back} />
        <p>That quest isn’t on this account.</p>
      </section>
    );
  }
  const { origin } = useLocation();
  const walk = origin ? walkMinutes(distanceMiles(origin, place)) : null;
  const done = quest.status === "completed";

  return (
    <section className={done ? "page" : "page page-dock"}>
      <BackRow onBack={back} label="Quests" />
      <p className="eyebrow">{done ? "Completed" : "Active quest"}</p>
      <h1>{quest.title}</h1>
      <p className="objective">{quest.objective}</p>
      <div className="card dest-card static">
        <PlaceMedia place={place} />
        <div>
          <strong>{place.name}</strong>
          <small>
            {origin ? `${formatDistance(distanceMiles(origin, place))} · ${walk} min walk · ` : ""}
            {quest.visitMinutes} min there
          </small>
          <SourceBadge source={place.source} />
        </div>
      </div>
      <section className="why-panel">
        <h2>Why this quest</h2>
        <p>{quest.why}</p>
      </section>
      <p className="fine">
        {quest.xp} XP · accepted {formatWhen(quest.acceptedAt)}
        {quest.completedAt ? ` · finished ${formatWhen(quest.completedAt)}` : ""}
      </p>
      {done ? <OpenInMaps place={place} /> : (
        <div className="dock">
          <OpenInMaps place={place} />
          <button type="button" className="btn btn-primary btn-block" onClick={() => completeQuest(quest.id)}>
            Complete quest
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => abandonQuest(quest.id)}>
            Abandon
          </button>
        </div>
      )}
    </section>
  );
}

export function QuestCompleteScreen({ questId }: { questId: string }) {
  const user = useRequiredUser();
  const { tab } = useRamble();
  const feed = useFeed();
  const quest = user.quests.find((item) => item.id === questId);
  const place = usePlace(quest?.discoveryId);
  if (!quest || !place) return null;
  const rows = passportRows(user, feed.places);
  const after = passportPercent(rows);
  const gained =
    place.passportCategory !== null && stampIsNew(user, place.passportCategory, place.id, feed.places);
  const previousIds = gained ? user.discoveredIds.filter((id) => id !== place.id) : user.discoveredIds;
  const before = passportPercent(passportRows({ discoveredIds: previousIds }, feed.places));

  return (
    <section className="page complete-page">
      <div className="seal" aria-hidden="true">
        Explored
      </div>
      <p className="eyebrow">Logged</p>
      <h1>{quest.title}</h1>
      <p className="lede">
        {gained && place.passportCategory
          ? `${passportLabel(place.passportCategory)} just got a stamp.`
          : `${place.name} is in your log. This stop doesn’t open a new passport line, and it still counts.`}
      </p>
      <article className="booklet booklet-compact">
        <div>
          <p className="eyebrow">{NEIGHBORHOOD.name}</p>
          <p className="percent">{after}% explored</p>
          {before !== after ? <p className="fine">Was {before}%</p> : null}
        </div>
        <ul className="checks">
          {rows.map((row) => (
            <li key={row.id} className={row.done ? "check done" : "check"}>
              <span className="check-mark">{row.done ? "✓" : ""}</span>
              <span>
                <strong>{row.label}</strong>
                <small>{row.placeName ?? "Not yet"}</small>
              </span>
            </li>
          ))}
        </ul>
      </article>
      <p className="fine">+{quest.xp} XP · {totalXp(user.quests)} total · {user.discoveredIds.length} places discovered</p>
      <div className="stack">
        <button type="button" className="btn btn-primary btn-block" onClick={() => tab({ name: "journey" })}>
          ✨ Build my journey
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => tab({ name: "quests", highlightId: quest.id })}>
          See completed quests
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => tab({ name: "passport", highlight: place.passportCategory ?? undefined })}
        >
          Open passport
        </button>
      </div>
    </section>
  );
}

export function QuestEmptyScreen() {
  const { tab } = useRamble();
  return (
    <section className="page">
      <p className="eyebrow">Side quests</p>
      <h1>You’ve walked the quests in this slice of the city.</h1>
      <p className="lede">Every quest within a walk of your location is active or already finished.</p>
      <button type="button" className="btn btn-primary btn-block" onClick={() => tab({ name: "quests" })}>
        Back to quests
      </button>
    </section>
  );
}
