import { DesignIcon, categoryIcons, categoryColors } from "../components/DesignIcon";
import { useEffect, useMemo, useState } from "react";
import { Generating, SourceBadge, OpenInMaps } from "../components/ui";
import { motionDelay } from "../lib/motion";
import { buildJourney, categoryLabel } from "../pipeline/agent";
import { placeInArea, withinWalk } from "../pipeline/geo";
import { type JourneyDuration } from "../pipeline/types";
import { useArea } from "../state/AreaContext";
import { useLocation } from "../state/LocationContext";
import { useFeed } from "../state/FeedContext";
import { useRamble, useRequiredUser } from "../state/RambleContext";

const LENGTHS: { id: JourneyDuration; label: string; hint: string }[] = [
  { id: 30, label: "30 mins", hint: "A quick break" },
  { id: 60, label: "1 hour", hint: "Between classes" },
  { id: 90, label: "90 mins", hint: "A long lunch" },
  { id: 120, label: "2 hours", hint: "An afternoon" },
];

const LINES = [
  "Tracing streets that actually connect…",
  "Mixing a verified place with something live…",
  "Leaving room to stay, not just to pass through…",
];

export function JourneyScreen() {
  const user = useRequiredUser();
  const { go } = useRamble();
  const feed = useFeed();
  const { origin } = useLocation();
  const [duration, setDuration] = useState<JourneyDuration>(LENGTHS.find((option) => option.id === user.journey?.duration)?.id ?? 90);
  const plan = user.journey;

  return (
    <section className="page">
      <p className="eyebrow">AI journey</p>
      <h1>Build a route, not a list.</h1>
      <p className="lede">
        Tell Ramble how long you have. It threads a few nearby stops — verified places and live discoveries — into one walk from {origin.label}.
      </p>
      <div className="time-grid" role="radiogroup" aria-label="How much time you have">
        {LENGTHS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="time-card"
            role="radio"
            aria-checked={duration === option.id}
            onClick={() => setDuration(option.id)}
          >
            <strong>{option.label}</strong>
            <span>{option.hint}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() =>
          go({
            name: "generating-journey",
            duration,
            avoid: plan && plan.duration === duration ? plan.signature : undefined,
          })
        }
      >
        ✨ Build my journey
      </button>

      {plan ? (
        <article className="journey-result">
          <p className="eyebrow">{plan.title}</p>
          <h2>{plan.kicker}</h2>
          <p>{plan.intro}</p>
          {plan.repeated ? <p className="fine">This is still the strongest route for that amount of time.</p> : null}
          <ol className="route">
            <li className="route-start">Start · {plan.startLabel ?? origin.label}</li>
            {plan.stops.map((stop, index) => {
              const place = feed.places.find((item) => item.id === stop.discoveryId);
              if (!place) return null;
              return (
                <li key={stop.discoveryId}>
                  <div className="leg">{stop.walkMinutes} min walk</div>
                  <div className="card journey-stop">
                  <button type="button" className="stop-card" onClick={() => go({ name: "place", id: place.id })}>
                    <span className="stop-index">{index + 1}</span>
                    <span className="stop-emoji category-icon" style={{ background: categoryColors[place.category] }} aria-hidden="true">
                      <DesignIcon name={categoryIcons[place.category]} />
                    </span>
                    <span>
                      <strong>{place.name}</strong>
                      <small>
                        {categoryLabel(place)} · {stop.dwellMinutes} min here
                      </small>
                      <small className="why">{stop.why}</small>
                      <SourceBadge source={place.source} />
                    </span>
                  </button>
                  <div className="place-card-actions"><OpenInMaps place={place} /></div>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="fine">About {plan.totalMinutes} minutes. Side quests are what fill the passport — a journey is the route.</p>
        </article>
      ) : (
        <p className="empty">No route yet. Ninety minutes is a good first one: enough for three stops, not a march.</p>
      )}
    </section>
  );
}

export function GeneratingJourneyScreen() {
  const { screen, user, saveJourney } = useRamble();
  const feed = useFeed();
  const { area } = useArea();
  const { origin, usingGps } = useLocation();
  const places = useMemo(() => {
    const inBorough = feed.places.filter((place) => placeInArea(place.borough, area));
    return usingGps ? withinWalk(feed.places, origin) : inBorough;
  }, [area, feed.places, origin, usingGps]);
  useEffect(() => {
    if (!user || screen.name !== "generating-journey") return;
    const { duration, avoid } = screen;
    const plan = buildJourney(user, places, duration, avoid, undefined, origin);
    const handle = window.setTimeout(() => saveJourney(plan), motionDelay(1400));
    return () => window.clearTimeout(handle);
  }, [origin, places, saveJourney, screen, user]);

  return <Generating mark="✨" lines={LINES} />;
}
