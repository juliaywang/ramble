import { LevelProgress } from "../components/LevelProgress";
import { passportPercent, passportRows } from "../pipeline/agent";
import { NEIGHBORHOOD, STARTER_DISCOVERED_IDS, type PassportCategoryId } from "../pipeline/types";
import { useFeed } from "../state/FeedContext";
import { useRamble, useRequiredUser } from "../state/RambleContext";

export function PassportScreen({ highlight }: { highlight?: PassportCategoryId }) {
  const user = useRequiredUser();
  const { go } = useRamble();
  const feed = useFeed();
  const rows = passportRows(user, feed.places);
  const percent = passportPercent(rows);
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - percent / 100);
  const logged = feed.places.filter((place) => user.discoveredIds.includes(place.id));

  return (
    <section className="page">
      <p className="eyebrow">Neighborhood passport</p>
      <h1>What you’ve actually walked.</h1>
      <LevelProgress quests={user.quests} details />
      <article className="booklet">
        <div className="booklet-head">
          <div>
            <p className="eyebrow">{NEIGHBORHOOD.name}</p>
            <p className="percent">{percent}% explored</p>
            <p className="fine">
              {rows.filter((row) => row.done).length} of {rows.length} kinds of places
            </p>
          </div>
          <svg className="ring" viewBox="0 0 72 72" aria-hidden="true">
            <circle cx="36" cy="36" r={radius} className="ring-track" />
            <circle
              cx="36"
              cy="36"
              r={radius}
              className="ring-value"
              strokeDasharray={circ}
              strokeDashoffset={offset}
            />
          </svg>
        </div>
        <ul className="checks">
          {rows.map((row) => {
            const isNew = row.id === highlight && row.done;
            return (
              <li key={row.id} className={["check", row.done ? "done" : "", isNew ? "is-new" : ""].filter(Boolean).join(" ")}>
                <span className="check-mark">{row.done ? "✓" : ""}</span>
                <span>
                  <strong>{row.label}</strong>
                  <small>{row.placeName ?? "Not yet"}</small>
                </span>
              </li>
            );
          })}
        </ul>
      </article>
      <p className="lede">
        Bookstore, Café, and Farmers Market start stamped, so the book opens at 50% instead of a blank page. A finished quest fills the next line.
      </p>
      <div className="section-head">
        <h2>Places in your log</h2>
      </div>
      <ul className="log-list">
        {logged.map((place) => {
          const starter = (STARTER_DISCOVERED_IDS as readonly string[]).includes(place.id);
          const fromQuest = user.quests.some((quest) => quest.status === "completed" && quest.discoveryId === place.id);
          return (
            <li key={place.id}>
              <button type="button" onClick={() => go({ name: "place", id: place.id })}>
                <strong>{place.name}</strong>
                <small>{fromQuest ? "From a completed quest" : starter ? "From an earlier walk" : "Logged"}</small>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
