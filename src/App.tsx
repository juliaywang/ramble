import { AccountMenu } from "./components/AccountMenu";
import { IconBook, IconCompass, IconDice, IconPath } from "./components/Icons";
import { CommunityScreen, PlaceScreen } from "./screens/Details";
import { ExploreScreen } from "./screens/Explore";
import { GeneratingJourneyScreen, JourneyScreen } from "./screens/Journey";
import { InterestsScreen, SignupScreen, WelcomeScreen } from "./screens/Onboarding";
import { PassportScreen } from "./screens/Passport";
import { ProfileScreen } from "./screens/Profile";
import { InfoScreen, SettingsScreen } from "./screens/Settings";
import {
  GeneratingQuestScreen,
  QuestCompleteScreen,
  QuestDetailScreen,
  QuestEmptyScreen,
  QuestOfferScreen,
  QuestsScreen,
} from "./screens/Quests";
import { AreaProvider } from "./state/AreaContext";
import { FeedProvider } from "./state/FeedContext";
import { LocationProvider } from "./state/LocationContext";
import { RambleProvider, useRamble } from "./state/RambleContext";
import { screenKey, tabOf, type TabName } from "./state/screens";

const TABS: { id: TabName; label: string; icon: typeof IconCompass }[] = [
  { id: "explore", label: "Explore", icon: IconCompass },
  { id: "quests", label: "Quests", icon: IconDice },
  { id: "journey", label: "Journey", icon: IconPath },
  { id: "passport", label: "Passport", icon: IconBook },
];

export function App() {
  return (
    <FeedProvider>
      <AreaProvider>
        <RambleProvider>
          <LocationProvider>
            <Shell />
          </LocationProvider>
        </RambleProvider>
      </AreaProvider>
    </FeedProvider>
  );
}

function Shell() {
  const { screen, session, user } = useRamble();
  const signedIn = Boolean(session && user);
  return (
    <div className={signedIn ? "app-shell has-nav has-account" : "app-shell has-nav"}>
      {signedIn ? <AccountMenu /> : null}
      <div key={screenKey(screen)} className="screen">
        <Routes />
      </div>
      <TabBar />
    </div>
  );
}

function Routes() {
  const { screen, session, user } = useRamble();
  if (screen.name === "welcome") return <WelcomeScreen />;
  if (screen.name === "signup") return <SignupScreen />;
  if (screen.name === "interests" && screen.mode === "onboarding") return <InterestsScreen />;
  if (!session || !user) return <WelcomeScreen />;

  switch (screen.name) {
    case "explore":
      return <ExploreScreen />;
    case "place":
      return <PlaceScreen id={screen.id} />;
    case "community":
      return <CommunityScreen id={screen.id} />;
    case "quests":
      return <QuestsScreen highlightId={screen.highlightId} />;
    case "generating-quest":
      return <GeneratingQuestScreen />;
    case "quest-offer":
      return <QuestOfferScreen />;
    case "quest":
      return <QuestDetailScreen id={screen.id} />;
    case "quest-complete":
      return <QuestCompleteScreen questId={screen.questId} />;
    case "quest-empty":
      return <QuestEmptyScreen />;
    case "journey":
      return <JourneyScreen />;
    case "generating-journey":
      return <GeneratingJourneyScreen />;
    case "passport":
      return <PassportScreen highlight={screen.highlight} />;
    case "profile":
      return <ProfileScreen />;
    case "settings":
      return <SettingsScreen />;
    case "info":
      return <InfoScreen />;
    case "interests":
      return <InterestsScreen />;
    default:
      return <ExploreScreen />;
  }
}

function TabBar() {
  const { screen, tab, session, user, go } = useRamble();
  const current = session && user ? tabOf(screen) : null;
  return (
    <nav className="tabbar" aria-label="Primary">
      {TABS.map((item) => {
        const Icon = item.icon;
        const on = current === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className="tab"
            aria-current={on ? "page" : undefined}
            onClick={() => {
              if (session && user) tab({ name: item.id });
              else if (screen.name !== "signup" && screen.name !== "interests") go({ name: "signup" });
            }}
          >
            <span className="tab-icon">
              <Icon />
            </span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
