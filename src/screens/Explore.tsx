import { DesignIcon } from "../components/DesignIcon";
import { useMemo, useState } from "react";
import { MapView } from "../components/MapView";
import { PlaceCard, SourceBadge } from "../components/ui";
import { greeting } from "../lib/format";
import { rankCommunities, rankDiscoveries } from "../pipeline/agent";
import { placeInArea } from "../pipeline/geo";
import { INTERESTS, type InterestId } from "../pipeline/types";
import { CITY_AREAS, useArea } from "../state/AreaContext";
import { useFeed } from "../state/FeedContext";
import { useRequiredUser, useRamble } from "../state/RambleContext";

const PAGE = 18;

export function ExploreScreen() {
  const user = useRequiredUser();
  const { go } = useRamble();
  const feed = useFeed();
  const { area, setArea } = useArea();
  const [filter, setFilter] = useState<InterestId | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const inArea = useMemo(
    () => feed.places.filter((place) => placeInArea(place.borough, area)),
    [feed.places, area],
  );
  const ranked = useMemo(() => rankDiscoveries(user, inArea, area.anchor), [user, inArea, area.anchor]);
  const people = useMemo(() => rankCommunities(user, feed.communities).slice(0, 6), [user, feed.communities]);
  const visible = ranked.filter((place) => filter === "all" || place.tags.includes(filter));
  const page = visible.slice(0, shown);
  const openCount = inArea.filter((place) => place.source === "nyc-open-data").length;
  const liveCount = inArea.filter((place) => place.source === "live-discovery").length;
  const active = user.quests.find((quest) => quest.status === "active");
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
        selectedId={selectedId}
        onSelect={setSelectedId}
        onOpen={(id) => go({ name: "place", id })}
      />
      <p className="map-note">
        {feed.updatedFrom === "live"
          ? `Live pull from NYC Open Data across ${area.name}. Walks start at ${area.anchor.label}.`
          : `Saved copy of NYC Open Data across ${area.name}. Walks start at ${area.anchor.label}.`}
      </p>

      <button type="button" className="sidequest-banner" onClick={() => go({ name: "generating-quest", avoid: [] })}>
        <span className="sidequest-mark" aria-hidden="true"><DesignIcon name="dice" size="lg" /></span>
        <span>
          <strong>Give me a side quest</strong>
          <small>A spontaneous stop, written from where you are and what you’ve already done</small>
        </span>
      </button>

      <div className="section-head">
        <h2>Made for your afternoon</h2>
      </div>
      <div className="stack discovery-grid">
        {visible.length === 0 ? (
          <p className="empty">Nothing tagged with that interest in {area.name}. Choose For you to see the full map.</p>
        ) : (
          page.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              logged={user.discoveredIds.includes(place.id)}
              selected={place.id === selectedId}
              showBorough={area.id === "nyc"}
              onOpen={() => go({ name: "place", id: place.id })}
            />
          ))
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
    </section>
  );
}
