import { availableForQuest } from "../pipeline/availability";
import { DesignIcon } from "../components/DesignIcon";
import { useEffect, useMemo, useState } from "react";
import { MapView } from "../components/MapView";
import { PlaceCard, SourceBadge } from "../components/ui";
import { greeting } from "../lib/format";
import { draftForPlace, matchScore, rankCommunities, rankDiscoveries, rollSideQuest } from "../pipeline/agent";
import { placeInArea } from "../pipeline/geo";
import { locationNote, useLocation } from "../state/LocationContext";
import { INTERESTS, type Discovery, type InterestId } from "../pipeline/types";
import { CITY_AREAS, useArea } from "../state/AreaContext";
import { useFeed } from "../state/FeedContext";
import { useRequiredUser, useRamble } from "../state/RambleContext";

const PAGE = 18;

export function ExploreScreen() {
  const user = useRequiredUser();
  const { go, acceptQuest } = useRamble();
  const feed = useFeed();
  const { area, setArea } = useArea();
  const { origin, status, request } = useLocation();
  const [filter, setFilter] = useState<InterestId | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [avoidTemplates, setAvoidTemplates] = useState<string[]>([]);
  const [acceptedToast, setAcceptedToast] = useState<{ title: string; templateId: string } | null>(null);

  useEffect(() => {
    if (!acceptedToast) return;
    const timer = window.setTimeout(() => setAcceptedToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [acceptedToast]);

  const inArea = useMemo(
    () => feed.places.filter((place) => placeInArea(place.borough, area)),
    [feed.places, area],
  );
  const ranked = useMemo(() => {
    if (origin) return rankDiscoveries(user, inArea, origin);
    return inArea
      .map((place) => ({
        ...place,
        match: matchScore(user.interests, place.tags),
        miles: 0,
        minutes: 0,
        why: place.summary,
      }))
      .sort((a, b) => b.match - a.match || a.name.localeCompare(b.name));
  }, [user, inArea, origin]);
  const people = useMemo(() => rankCommunities(user, feed.communities).slice(0, 6), [user, feed.communities]);
  const visible = ranked.filter((place) => filter === "all" || place.tags.includes(filter));
  const page = visible.slice(0, shown);
  const openCount = inArea.filter((place) => place.source === "nyc-open-data").length;
  const liveCount = inArea.filter((place) => place.source === "live-discovery").length;
  const active = user.quests.find((quest) => quest.status === "active");
  const featuredQuest = useMemo(() => {
    if (active) return null;
    return rollSideQuest(user, inArea, feed.questTemplates, avoidTemplates, origin ?? undefined);
  }, [user, inArea, feed.questTemplates, avoidTemplates, origin, active]);

  const handleAcceptQuest = (place: Discovery) => {
    if (!availableForQuest(place)) { go({ name: "place", id: place.id }); return; }
    const draft = draftForPlace(user, place, feed.questTemplates, feed.places, origin ?? undefined);
    acceptQuest(draft, false);
    setAcceptedToast({ title: draft.title, templateId: draft.templateId });
  };

  const chips: { id: InterestId | "all"; label: string }[] = [
    { id: "all", label: "For you" },
    ...user.interests.map((id) => ({
      id,
      label: INTERESTS.find((item) => item.id === id)?.title ?? id,
    })),
  ];

  return (
    <section className="page explore-page">
      <header className="explore-head">
        <h1>{greeting(user.name)}</h1>
        {feed.loading && <p className="fine" role="status">Updating places…</p>}
        {!feed.loading && feed.updatedFrom === "supabase" && <p className="fine">Updated from NYC Open Data</p>}
        {feed.notice && <p className="fine" role="status">{feed.notice}</p>}
        <p className="meta-line">{area.name}</p>
        <p className="lede">
          {openCount} from NYC Open Data · {liveCount} live discoveries
        </p>
      </header>

      {active ? (
        <button type="button" className="quest-chip" onClick={() => go({ name: "quest", id: active.id })}>
          <span aria-hidden="true"><DesignIcon name="dice" size="lg" /></span>
          <span>
            <strong>Quest in progress</strong>
            <small>{active.title}</small>
          </span>
        </button>
      ) : null}

      <div className="chips discovery-filters" role="group" aria-label="Choose a borough">
        {CITY_AREAS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="chip"
            aria-pressed={area.id === option.id}
            onClick={() => {
              setArea(option.id);
              setSelectedId(null);
              setShown(PAGE);
              setAvoidTemplates([]);
            }}
          >
            {option.short}
          </button>
        ))}
      </div>

      <div className="chips discovery-filters" role="group" aria-label="Filter discoveries">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className="chip"
            aria-pressed={filter === chip.id}
            onClick={() => {
              setFilter(chip.id);
              setSelectedId(null);
              setShown(PAGE);
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <MapView
        places={visible}
        area={area}
        you={origin}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onOpen={(id) => go({ name: "place", id })}
        onAcceptQuest={(id) => {
          const place = feed.places.find((p) => p.id === id);
          if (place) handleAcceptQuest(place);
        }}
        onLocate={() => void request()}
      />
      <p className="map-note">
        {feed.updatedFrom === "supabase"
          ? `Synced NYC Open Data across ${area.name}. ${locationNote(status)}`
          : feed.updatedFrom === "live"
          ? `Live pull from NYC Open Data across ${area.name}. ${locationNote(status)}`
          : `Saved copy of NYC Open Data across ${area.name}. ${locationNote(status)}`}
      </p>

      {featuredQuest ? (
        <div className="featured-quest-card">
          <div className="featured-quest-head">
            <div className="featured-quest-badge">
              <DesignIcon name="dice" size="sm" />
              <span>Recommended Quest</span>
            </div>
            <span className="featured-quest-xp">+{featuredQuest.xp} XP</span>
          </div>
          <h3>{featuredQuest.title}</h3>
          <p className="featured-quest-objective">{featuredQuest.objective}</p>
          <p className="featured-quest-why">{featuredQuest.why}</p>
          <div className="featured-quest-actions">
            <button
              type="button"
              className="btn btn-clay"
              onClick={() => {
                acceptQuest(featuredQuest, false);
                setAcceptedToast({ title: featuredQuest.title, templateId: featuredQuest.templateId });
              }}
            >
              <DesignIcon name="dice" size="sm" /> Accept quest · {featuredQuest.visitMinutes} min
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setAvoidTemplates((prev) => [...prev, featuredQuest.templateId])}
            >
              Roll another 🎲
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="sidequest-banner"
          onClick={() => {
            void (async () => {
              if (!origin && !(await request())) return;
              go({ name: "generating-quest", avoid: [] });
            })();
          }}
        >
          <span className="sidequest-mark" aria-hidden="true"><DesignIcon name="dice" size="lg" /></span>
          <span>
            <strong>Give me a side quest</strong>
            <small>A spontaneous stop, written from where you are and what you’ve already done</small>
          </span>
        </button>
      )}

      <div className="section-head">
        <h2>Made for your afternoon</h2>
      </div>
      <div className="stack discovery-grid">
        {visible.length === 0 ? (
          <p className="empty">Nothing tagged with that interest in {area.name}. Choose For you to see the full map.</p>
        ) : (
          page.map((place) => {
            const quest = feed.questTemplates.find((t) => t.discoveryId === place.id);
            const activeQuest = user.quests.find((q) => q.discoveryId === place.id && q.status === "active");
            const isCompleted = user.quests.some((q) => q.discoveryId === place.id && q.status === "completed");
            const questState = activeQuest ? "active" : isCompleted ? "completed" : "available";

            return (
              <PlaceCard
                key={place.id}
                place={place}
                logged={user.discoveredIds.includes(place.id)}
                selected={place.id === selectedId}
                showBorough={area.id === "nyc"}
                awaitingLocation={!origin}
                quest={quest}
                questState={questState}
                activeQuestId={activeQuest?.id}
                onOpen={() => go({ name: "place", id: place.id })}
                onAcceptQuest={quest ? () => handleAcceptQuest(place) : undefined}
                onViewQuest={(questId) => go({ name: "quest", id: questId })}
              />
            );
          })
        )}
      </div>
      {shown < visible.length ? (
        <button type="button" className="btn btn-ghost btn-block" onClick={() => setShown((count) => count + PAGE)}>
          Show more in {area.short} ({visible.length - shown} left)
        </button>
      ) : null}

      <div className="section-head">
        <h2>Find your people</h2>
        <p>Clubs, pantries, gardens, and rooms that match the interests you picked.</p>
      </div>
      <div className="stack community-grid">
        {people.map((community) => (
          <button key={community.id} type="button" className="card people-card" onClick={() => go({ name: "community", id: community.id })}>
            <p className="eyebrow">{community.kind}</p>
            <h3>{community.name}</h3>
            <p className="meta-line">{community.where}</p>
            <p className="why clamp-3">{community.why}</p>
            <span className="match">{community.match}% match</span>
          </button>
        ))}
      </div>
      <p className="fine source-foot">
        <SourceBadge source="nyc-open-data" /> <SourceBadge source="live-discovery" />
      </p>

      {acceptedToast && (
        <aside className="quest-toast" role="status" aria-live="polite">
          <div className="quest-toast-content">
            <span className="quest-toast-mark" aria-hidden="true">
              <DesignIcon name="dice" size="sm" />
            </span>
            <div className="quest-toast-text">
              <strong>Quest accepted!</strong>
              <small>{acceptedToast.title}</small>
            </div>
          </div>
          <div className="quest-toast-actions">
            <button
              type="button"
              className="btn btn-sm btn-clay"
              onClick={() => {
                const quest = user.quests.find((q) => q.templateId === acceptedToast.templateId);
                if (quest) go({ name: "quest", id: quest.id });
                setAcceptedToast(null);
              }}
            >
              View
            </button>
            <button
              type="button"
              className="quest-toast-close"
              aria-label="Dismiss notice"
              onClick={() => setAcceptedToast(null)}
            >
              ✕
            </button>
          </div>
        </aside>
      )}
    </section>
  );
}
