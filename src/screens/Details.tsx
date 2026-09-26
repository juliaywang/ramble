import { BackRow, OpenInMaps, PlaceMedia, SourceBadge } from "../components/ui";
import { distanceMiles, formatDistance, walkMinutes } from "../pipeline/geo";
import { useLocation } from "../state/LocationContext";
import { categoryLabel, explainCommunity, explainPlace, matchScore } from "../pipeline/agent";
import { communityById } from "../pipeline/index";
import { CATEGORIES } from "../pipeline/types";
import { usePlace } from "../state/FeedContext";
import { useRamble, useRequiredUser } from "../state/RambleContext";

export function PlaceScreen({ id }: { id: string }) {
  const user = useRequiredUser();
  const { back, go, toggleSave } = useRamble();
  const { origin, request } = useLocation();
  const place = usePlace(id);
  if (!place) {
    return (
      <section className="page">
        <BackRow onBack={back} />
        <p>That place isn’t on this map.</p>
      </section>
    );
  }
  const miles = origin ? distanceMiles(origin, place) : null;
  const minutes = miles === null ? null : walkMinutes(miles);
  const match = matchScore(user.interests, place.tags);
  const saved = user.savedIds.includes(place.id);
  const meta = CATEGORIES[place.category];

  return (
    <section className="page page-dock">
      <BackRow onBack={back} label="Explore" />
      <PlaceMedia place={place} tall />
      <div className="detail-title">
        <p className="eyebrow">{meta.label}</p>
        <div className="title-row">
          <h1>{place.name}</h1>
          <button
            type="button"
            className={saved ? "heart is-on" : "heart"}
            aria-pressed={saved}
            aria-label={saved ? "Remove from saved places" : "Save place"}
            onClick={() => toggleSave(place.id)}
          >
            {saved ? "Saved" : "Save"}
          </button>
        </div>
        <p className="meta-line">
          {miles === null ? "Turn on location for walking distance" : `${formatDistance(miles)} · ${minutes} min walk`} · {match}% match
        </p>
        <div className="badge-row">
          <SourceBadge source={place.source} />
          <span className="logged">{place.sourceDetail}</span>
        </div>
      </div>
      <section className="why-panel">
        <h2>Why Ramble recommended it</h2>
        <p>{origin ? explainPlace(user, place, origin) : place.summary}</p>
      </section>
      <dl className="facts">
        <div>
          <dt>Address</dt>
          <dd>{place.address}</dd>
        </div>
        <div>
          <dt>Hours</dt>
          <dd>{place.hours}</dd>
        </div>
        <div>
          <dt>From</dt>
          <dd>
            {origin ? `${origin.label}, ${origin.detail}` : "Your location, once it’s on"}
          </dd>
        </div>
      </dl>
      <div className="prose">
        {place.about.split("\n\n").map((paragraph) => (
          <p key={paragraph.slice(0, 24)}>{paragraph}</p>
        ))}
        <p className="tip">{place.tip}</p>
      </div>
      <div className="dock">
        <OpenInMaps place={place} />
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
      </div>
    </section>
  );
}

export function CommunityScreen({ id }: { id: string }) {
  const user = useRequiredUser();
  const { back, go } = useRamble();
  const community = communityById(id);
  const place = usePlace(community?.discoveryId);
  if (!community) {
    return (
      <section className="page">
        <BackRow onBack={back} />
        <p>That community isn’t in this prototype.</p>
      </section>
    );
  }
  const match = matchScore(user.interests, community.tags);

  return (
    <section className="page">
      <BackRow onBack={back} label="Explore" />
      <p className="eyebrow">{community.kind}</p>
      <h1>{community.name}</h1>
      <p className="meta-line">{community.where}</p>
      <span className="match">{match}% match</span>
      <section className="why-panel">
        <h2>Why they might be your people</h2>
        <p>{explainCommunity(user, community)}</p>
      </section>
      <div className="prose">
        <p>{community.about}</p>
      </div>
      {place ? (
        <button type="button" className="card link-card" onClick={() => go({ name: "place", id: place.id })}>
          <span className="eyebrow">On the map</span>
          <strong>{place.name}</strong>
          <small>{categoryLabel(place)}</small>
        </button>
      ) : null}
    </section>
  );
}
