import { LevelProgress } from "../components/LevelProgress";
import { STARTER_DISCOVERED_IDS, type PassportCategoryId } from "../pipeline/types";
import { useFeed } from "../state/FeedContext";
import { useRamble, useRequiredUser } from "../state/RambleContext";

export function PassportScreen({ highlight: _highlight }: { highlight?: PassportCategoryId }) {
  const user = useRequiredUser();
  const { go } = useRamble();
  const feed = useFeed();
  const logged = feed.places.filter((place) => user.discoveredIds.includes(place.id));

  return (
    <section className="page">
      <p className="eyebrow">Neighborhood passport</p>
      <h1>What you’ve actually walked.</h1>
      <LevelProgress quests={user.quests} details />
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
