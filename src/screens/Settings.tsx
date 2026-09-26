import { BackRow } from "../components/ui";
import { locationNote, useLocation } from "../state/LocationContext";
import { useRamble } from "../state/RambleContext";

export function SettingsScreen() {
  const { back, go } = useRamble();
  const { status, origin, request } = useLocation();

  return (
    <section className="page">
      <BackRow onBack={back} />
      <p className="eyebrow">Settings</p>
      <h1>How Ramble walks with you.</h1>
      <p className="lede">{locationNote(status)}</p>

      <div className="section-head">
        <h2>Location</h2>
      </div>
      <div className="card settings-card">
        <p>
          <strong>{origin ? "Using your current location" : "Waiting for your location"}</strong>
        </p>
        <p className="meta-line">{origin ? origin.detail : "Walks start where you are. They do not start at a landmark."}</p>
        <button type="button" className="btn btn-primary" onClick={request}>
          {status === "locating" ? "Finding you…" : "Use my location"}
        </button>
      </div>

      <div className="section-head">
        <h2>Interests</h2>
        <p>Side quests and journeys use the interests on your account.</p>
      </div>
      <button type="button" className="btn btn-ghost btn-block" onClick={() => go({ name: "interests", mode: "edit" })}>
        Edit interests
      </button>
    </section>
  );
}

export function InfoScreen() {
  const { back } = useRamble();
  return (
    <section className="page">
      <BackRow onBack={back} />
      <p className="eyebrow">Info</p>
      <h1>Ramble</h1>
      <div className="prose">
        <p>
          Ramble turns New York from a map of places into a map of communities. Explore covers Manhattan, Brooklyn, Queens, the Bronx, and Staten Island.
        </p>
        <p>
          Verified places come from NYC Open Data: farmers markets, public art, community gardens, and libraries, museums, and community centers. Cafés and a few neighborhood rooms stay labeled Live Discovery.
        </p>
        <p>
          Journeys and side quests start where you are. Ramble asks for your location and does not substitute a landmark such as City Hall.
        </p>
        <p>Your account, photo, quests, and passport stay in this browser. Nothing is sent to an account server.</p>
      </div>
    </section>
  );
}
