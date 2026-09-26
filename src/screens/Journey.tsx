import { useEffect, useState } from "react";
import { Generating, SourceBadge } from "../components/ui";
import { motionDelay } from "../lib/motion";
import { buildJourney, categoryLabel } from "../pipeline/agent";
import { CATEGORIES, type JourneyDuration } from "../pipeline/types";
import { useFeed } from "../state/FeedContext";
import { useRamble, useRequiredUser } from "../state/RambleContext";

const LENGTHS: { id: JourneyDuration; label: string; hint: string }[] = [
  { id: 45, label: "45 min", hint: "Between classes" },
  { id: 90, label: "90 min", hint: "A long lunch" },
  { id: 180, label: "3 hours", hint: "An afternoon" },
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
  const [duration, setDuration] = useState<JourneyDuration>(user.journey?.duration ?? 90);
  const plan = user.journey;

  return (
    <section className="page">
      <p className="eyebrow">AI journey</p>
      <h1>Build a route, not a list.</h1>
      <p className="lede">
        Tell Ramble how long you have. It threads a few nearby stops — verified places and live discoveries — into one walk from College Walk.
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
            <li className="route-start">Start · College Walk</li>
            {plan.stops.map((stop, index) => {
              const place = feed.places.find((item) => item.id === stop.discoveryId);
              if (!place) return null;
              const meta = CATEGORIES[place.category];
              return (
                <li key={stop.discoveryId}>
                  <div className="leg">{stop.walkMinutes} min walk</div>
                  <button type="button" className="card stop-card" onClick={() => go({ name: "place", id: place.id })}>
                    <span className="stop-index">{index + 1}</span>
                    <span className="stop-emoji" aria-hidden="true">
                      {meta.emoji}
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
  useEffect(() => {
    if (!user || screen.name !== "generating-journey") return;
    const { duration, avoid } = screen;
    const plan = buildJourney(user, feed.places, duration, avoid);
    const handle = window.setTimeout(() => saveJourney(plan), motionDelay(1400));
    return () => window.clearTimeout(handle);
  }, [feed.places, saveJourney, screen, user]);

  return <Generating mark="✨" lines={LINES} />;
}
