import { useMemo, useState } from "react";

type Tab = "explore" | "quests" | "journey" | "passport" | "profile";
type IconName =
  | "arrow"
  | "book"
  | "briefcase"
  | "building"
  | "calendar"
  | "check"
  | "chevron"
  | "clock"
  | "coffee"
  | "compass"
  | "dice"
  | "heart"
  | "home"
  | "leaf"
  | "map"
  | "music"
  | "palette"
  | "pin"
  | "route"
  | "search"
  | "sparkles"
  | "star"
  | "user"
  | "users"
  | "x";

const iconPaths: Record<IconName, React.ReactNode> = {
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
  building: <><path d="M4 21h16M6 21V7l6-4 6 4v14M9 10h1M14 10h1M9 14h1M14 14h1M10 21v-3h4v3" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  coffee: <><path d="M4 8h13v6a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V8Z" /><path d="M17 10h1a3 3 0 0 1 0 6h-2M7 4h8" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
  dice: <><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r=".75" fill="currentColor" /><circle cx="16" cy="8" r=".75" fill="currentColor" /><circle cx="12" cy="12" r=".75" fill="currentColor" /><circle cx="8" cy="16" r=".75" fill="currentColor" /><circle cx="16" cy="16" r=".75" fill="currentColor" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10M9 21v-6h6v6" /></>,
  leaf: <><path d="M20 4c-8 0-14 3-14 9a5 5 0 0 0 5 5c6 0 9-6 9-14Z" /><path d="M4 21c2-5 6-9 12-12" /></>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></>,
  music: <><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></>,
  palette: <><path d="M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h3a6 6 0 0 0 0-12Z" /><path d="M7.5 10h.01M9 6.5h.01M14 6h.01M17.5 9h.01" /></>,
  pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  route: <><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h3a3 3 0 0 0 3-3v-1a3 3 0 0 0-3-3h-1a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  sparkles: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14ZM19 13l.7 1.3L21 15l-1.3.7L19 17l-.7-1.3L17 15l1.3-.7L19 13Z" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 4a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5" /></>,
  x: <path d="m6 6 12 12M18 6 6 18" />,
};

function Icon({ name, size = "md", filled = false }: { name: IconName; size?: "sm" | "md" | "lg"; filled?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={size === "sm" ? "size-4" : size === "lg" ? "size-7" : "size-5"}
      fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  );
}

function Action({
  children,
  onClick,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "quiet" | "dark" | "accent";
  className?: string;
}) {
  const styles = {
    primary: "bg-ink text-white shadow-button hover:bg-ink-soft",
    secondary: "bg-white text-ink border border-line hover:border-ink-muted",
    quiet: "text-ink-muted hover:bg-wash",
    dark: "bg-lime text-ink hover:bg-lime-soft",
    accent: "bg-quest-soft text-coral hover:bg-coral-contrast",
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick?.();
      }}
      className={`select-none cursor-pointer transition active:scale-95 flex items-center justify-center gap-2 rounded-full font-semibold ${styles[variant]} ${className}`}
    >
      {children}
    </div>
  );
}

const interests = [
  ["Food", "coffee"],
  ["Art", "palette"],
  ["Books", "book"],
  ["Gaming", "dice"],
  ["Culture", "building"],
  ["Volunteering", "heart"],
  ["History", "compass"],
  ["Coffee", "coffee"],
  ["Sustainability", "leaf"],
  ["Music", "music"],
  ["Technology", "sparkles"],
] as const;

const discoveries = [
  { id: 1, name: "Book Culture", type: "Independent bookstore", distance: "0.2 mi", match: 98, source: "Live Discovery", icon: "book" as IconName, x: "18%", y: "37%", color: "bg-coral", why: "Because you love books and neighborhood staples", detail: "A beloved independent bookstore with author events, thoughtful staff picks, and four floors to wander." },
  { id: 2, name: "Morningside Park Farmers Market", type: "Farmers market", distance: "0.5 mi", match: 94, source: "Verified NYC Data", icon: "leaf" as IconName, x: "70%", y: "65%", color: "bg-green", why: "Fresh food and sustainability, nearby", detail: "Local growers, seasonal produce, bread, and neighborhood vendors every Saturday." },
  { id: 3, name: "The Hungarian Pastry Shop", type: "Independent café", distance: "0.4 mi", match: 92, source: "Live Discovery", icon: "coffee" as IconName, x: "55%", y: "19%", color: "bg-orange", why: "A study break with old-NYC character", detail: "A cash-only neighborhood institution known for pastries, lively tables, and no Wi-Fi." },
  { id: 4, name: "Wallach Art Gallery", type: "Public art", distance: "0.3 mi", match: 89, source: "Verified NYC Data", icon: "palette" as IconName, x: "35%", y: "76%", color: "bg-blue", why: "Free, close by, and matched to art", detail: "Columbia's public gallery presents contemporary exhibitions and research-driven shows." },
  { id: 5, name: "Riverside Park Bird Sanctuary", type: "Nature", distance: "0.7 mi", match: 87, source: "Verified NYC Data", icon: "leaf" as IconName, x: "12%", y: "66%", color: "bg-green", why: "A quiet reset within walking distance", detail: "A wooded stretch of Riverside Park where more than 180 bird species have been recorded." },
  { id: 6, name: "Miller Theatre", type: "Live music", distance: "0.2 mi", match: 86, source: "Live Discovery", icon: "music" as IconName, x: "48%", y: "48%", color: "bg-violet", why: "Experimental music around the corner", detail: "An intimate venue featuring adventurous contemporary, jazz, and early music." },
  { id: 7, name: "St. John the Divine", type: "Historic site", distance: "0.5 mi", match: 83, source: "Verified NYC Data", icon: "building" as IconName, x: "77%", y: "30%", color: "bg-blue", why: "Architecture and neighborhood history", detail: "One of the world's largest cathedrals, with gardens, art, and peacocks on the grounds." },
  { id: 8, name: "Roerich Museum", type: "Cultural institution", distance: "0.5 mi", match: 81, source: "Verified NYC Data", icon: "palette" as IconName, x: "24%", y: "23%", color: "bg-coral", why: "A hidden gem for your art interests", detail: "A townhouse museum devoted to the vivid paintings of Nicholas Roerich. Admission is free." },
  { id: 9, name: "Morningside Area Alliance", type: "Community organization", distance: "0.6 mi", match: 80, source: "Live Discovery", icon: "users" as IconName, x: "84%", y: "50%", color: "bg-violet", why: "Meet neighborhood builders", detail: "A coalition connecting residents with local programs, cultural events, and civic resources." },
  { id: 10, name: "Riverside Language Program", type: "Volunteer opportunity", distance: "0.8 mi", match: 78, source: "Live Discovery", icon: "heart" as IconName, x: "8%", y: "49%", color: "bg-orange", why: "A practical way to volunteer locally", detail: "Support immigrant and refugee adults learning English and navigating life in New York." },
  { id: 11, name: "The Forum at Columbia", type: "Community event space", distance: "0.9 mi", match: 77, source: "Verified NYC Data", icon: "calendar" as IconName, x: "64%", y: "84%", color: "bg-blue", why: "Free public talks match your interests", detail: "A public-facing gathering space hosting talks, exhibits, and neighborhood events." },
  { id: 12, name: "Hex & Co.", type: "Board game café", distance: "0.7 mi", match: 76, source: "Live Discovery", icon: "dice" as IconName, x: "91%", y: "74%", color: "bg-coral", why: "Gaming plus a social atmosphere", detail: "A lively café with hundreds of games, friendly hosts, tournaments, and snacks." },
  { id: 13, name: "Bloomingdale Library", type: "Public library", distance: "0.9 mi", match: 74, source: "Verified NYC Data", icon: "book" as IconName, x: "6%", y: "82%", color: "bg-violet", why: "Books, events, and free resources", detail: "A neighborhood NYPL branch with reading rooms, workshops, and free community resources." },
  { id: 14, name: "West Side Campaign Against Hunger", type: "Food resource", distance: "1.0 mi", match: 72, source: "Verified NYC Data", icon: "heart" as IconName, x: "89%", y: "13%", color: "bg-orange", why: "Local food justice in action", detail: "A community-powered organization advancing food access and dignity across the Upper West Side." },
  { id: 15, name: "Sakura Park", type: "Public park", distance: "0.4 mi", match: 70, source: "Verified NYC Data", icon: "leaf" as IconName, x: "40%", y: "8%", color: "bg-green", why: "A peaceful green pocket nearby", detail: "A compact park known for cherry trees, lawns, and a stone Japanese lantern." },
];

const navItems: { id: Tab; label: string; icon: IconName }[] = [
  { id: "explore", label: "Explore", icon: "compass" },
  { id: "quests", label: "Quests", icon: "dice" },
  { id: "journey", label: "Journey", icon: "route" },
  { id: "passport", label: "Passport", icon: "map" },
  { id: "profile", label: "Profile", icon: "user" },
];

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="size-9 rounded-xl bg-ink text-lime flex items-center justify-center -rotate-6"><Icon name="route" /></div>
      <div className="text-xl font-extrabold tracking-tight">ramble</div>
    </div>
  );
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>(["Books", "Art", "Coffee", "Sustainability"]);
  if (step === 0) {
    return (
      <main className="min-h-screen bg-cream flex flex-col lg:flex-row safe-top">
        <section className="flex-1 p-6 lg:p-12 flex flex-col">
          <Brand />
          <div className="my-auto py-16 max-w-xl">
            <div className="inline-flex items-center gap-2 bg-lime-soft text-ink rounded-full px-4 py-2 text-sm font-bold mb-6"><Icon name="sparkles" size="sm" /> AI-powered city discovery</div>
            <div className="text-4xl lg:text-6xl font-extrabold tracking-tight leading-none">Find the city<br /><span className="text-coral">between</span> the pins.</div>
            <div className="text-lg text-ink-muted mt-6 max-w-lg leading-relaxed">Ramble turns New York from a map of places into a map of communities, stories, and unexpected adventures.</div>
            <Action onClick={() => setStep(1)} className="mt-9 px-6 py-4 w-full sm:w-fit">Create your account <Icon name="arrow" /></Action>
            <div className="mt-5 text-sm text-ink-muted">Free to explore. No credit card needed.</div>
          </div>
          <div className="text-sm text-ink-muted">Built for curious New Yorkers.</div>
        </section>
        <section className="hidden lg:flex flex-1 bg-ink p-12 items-center justify-center overflow-hidden relative">
          <div className="absolute inset-0 city-grid opacity-20" />
          <div className="relative w-full max-w-lg">
            <div className="bg-white rounded-card p-5 shadow-float rotate-2">
              <div className="flex items-start justify-between">
                <div className="size-12 bg-coral-soft text-coral rounded-2xl flex items-center justify-center"><Icon name="book" size="lg" /></div>
                <div className="bg-lime-soft rounded-full px-3 py-1 text-sm font-bold">98% match</div>
              </div>
              <div className="text-xl font-extrabold mt-6">Book Culture</div>
              <div className="text-ink-muted mt-1">Independent bookstore · 0.2 mi</div>
              <div className="mt-5 pt-5 border-t border-line text-sm flex items-center gap-2"><Icon name="sparkles" size="sm" /> Because you love books and neighborhood staples</div>
            </div>
            <div className="bg-lime rounded-card p-5 shadow-float -rotate-3 w-72 -mt-3 ml-auto">
              <div className="font-bold flex gap-2 items-center"><Icon name="dice" /> Side quest</div>
              <div className="text-xl font-extrabold mt-3">Find a new favorite read</div>
              <div className="text-sm mt-2">+150 XP · 30 min</div>
            </div>
          </div>
        </section>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-cream p-5 sm:p-8 flex items-start sm:items-center justify-center safe-top">
      <section className="w-full max-w-2xl py-2 sm:py-6">
        <Brand />
        <div className="mt-8 text-sm font-bold text-coral uppercase tracking-widest">Step 2 of 2</div>
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2">What pulls you outside?</div>
        <div className="text-ink-muted mt-2 leading-relaxed">Pick at least three. We'll use these to make your city feel personal.</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mt-6">
          {interests.map(([label, icon]) => {
            const active = selected.includes(label);
            return (
              <Action key={label} variant="secondary" onClick={() => setSelected(active ? selected.filter((i) => i !== label) : [...selected, label])} className={`relative h-full p-3 sm:p-4 justify-start rounded-2xl text-xs sm:text-sm ${active ? "border-ink bg-lime-soft" : ""}`}>
                <div className="flex flex-col items-start gap-1">
                  <Icon name={icon} />
                  <span>{label}</span>
                </div>
                {active && <span className="absolute top-2 right-2"><Icon name="check" size="sm" /></span>}
              </Action>
            );
          })}
        </div>
        <Action onClick={onDone} className="mt-6 py-4 w-full">Start exploring <Icon name="arrow" /></Action>
      </section>
    </main>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="px-5 pt-5 pb-3 lg:px-8 lg:pt-7 flex items-center justify-between gap-4">
      <div>
        <div className="text-xl font-extrabold tracking-tight">{title}</div>
        {subtitle && <div className="text-sm text-ink-muted mt-1">{subtitle}</div>}
      </div>
    </header>
  );
}

function SourceBadge({ source }: { source: string }) {
  const verified = source.includes("Verified");
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${verified ? "bg-blue-soft text-blue" : "bg-violet-soft text-violet"}`}>
      <Icon name={verified ? "check" : "sparkles"} size="sm" /> {source}
    </div>
  );
}

function Explore({ openDiscovery, goQuest }: { openDiscovery: (id: number) => void; goQuest: () => void }) {
  const [filter, setFilter] = useState("For you");
  return (
    <div>
      <Header title="Good afternoon, Alex" subtitle="Morningside Heights · Tuesday, 2:14 PM" />
      <div className="px-5 lg:px-8">
        <div className="mt-5 flex flex-wrap gap-2 pb-1">
          {["For you", "Food", "Art", "Community", "Outdoors"].map((item) => <Action key={item} variant={filter === item ? "primary" : "secondary"} onClick={() => setFilter(item)} className="px-4 py-2.5 text-sm">{item}</Action>)}
        </div>
        <div className="mt-5 relative h-72 lg:h-96 rounded-card overflow-hidden bg-map border border-line">
          <div className="absolute inset-0 map-lines opacity-60" />
          <div className="absolute left-4 top-4 z-20 bg-white/90 backdrop-blur rounded-full px-3 py-2 text-xs font-bold shadow-soft flex items-center gap-2"><span className="size-2 bg-green rounded-full" /> 15 discoveries nearby</div>
          <div className="absolute right-4 top-4 bg-white rounded-full p-2 shadow-soft"><Icon name="pin" /></div>
          {discoveries.map((place) => (
            <div key={place.id} role="button" tabIndex={0} onClick={() => openDiscovery(place.id)} onKeyDown={(e) => e.key === "Enter" && openDiscovery(place.id)} className={`absolute ${place.color} text-white size-9 rounded-full flex items-center justify-center shadow-pin cursor-pointer hover:scale-110 transition`} style={{ left: place.x, top: place.y }}><Icon name={place.icon} size="sm" /></div>
          ))}
          <div className="absolute left-1/2 top-1/2 size-5 bg-blue border-4 border-white rounded-full shadow-pin" />
          <div className="absolute bottom-4 left-4 bg-white rounded-xl px-3 py-2 shadow-soft text-xs font-semibold">You are near College Walk</div>
        </div>
        <div className="flex items-center justify-between mt-7">
          <div className="text-xl font-extrabold">Made for your afternoon</div>
          <div className="text-sm font-bold text-coral whitespace-nowrap">See all 15</div>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
          {discoveries.slice(0, 6).map((place) => (
            <div key={place.id} role="button" tabIndex={0} onClick={() => openDiscovery(place.id)} onKeyDown={(e) => e.key === "Enter" && openDiscovery(place.id)} className="bg-white border border-line rounded-3xl p-4 cursor-pointer hover:-translate-y-1 hover:shadow-soft transition">
              <div className="flex items-start gap-3">
                <div className={`${place.color} text-white size-12 rounded-2xl flex items-center justify-center shrink-0`}><Icon name={place.icon} /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold leading-snug">{place.name}</div>
                  <div className="text-sm text-ink-muted mt-0.5 flex flex-wrap gap-x-1">
                    <span>{place.type} ·</span>
                    <span className="whitespace-nowrap">{place.distance}</span>
                  </div>
                </div>
                <div className="text-xs font-bold bg-lime-soft px-2 py-1 rounded-full">{place.match}%</div>
              </div>
              <div className="mt-4"><SourceBadge source={place.source} /></div>
              <div className="text-sm mt-3 text-ink-muted flex gap-2"><span className="text-coral"><Icon name="sparkles" size="sm" /></span>{place.why}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuestView({ status, setStatus }: { status: "none" | "active" | "complete"; setStatus: (s: "none" | "active" | "complete") => void }) {
  if (status === "none") {
    return (
      <div className="pb-28">
        <Header title="Side quests" subtitle="Small adventures. Real New York." />
        <div className="px-5 lg:px-8">
          <>
            <div className="size-14 bg-coral text-white rounded-2xl flex items-center justify-center"><Icon name="dice" size="lg" /></div>
            <div className="text-2xl font-extrabold tracking-tight mt-7 max-w-md">Your next story is hiding nearby.</div>
            <div className="text-ink-muted mt-3 max-w-md">We'll mix your interests, live city data, and a little serendipity.</div>
            <Action variant="accent" onClick={() => setStatus("active")} className="mt-8 px-6 py-4 w-full sm:w-fit"><Icon name="sparkles" /> Generate my quest</Action>
          </>
          <div className="mt-8 text-xl font-extrabold">Quest history</div>
          <div className="mt-4 flex gap-2">
            <div className="bg-ink text-white rounded-full px-4 py-2 text-sm font-bold">Active · 0</div>
            <div className="bg-white border border-line rounded-full px-4 py-2 text-sm font-bold">Completed · 6</div>
          </div>
          <div className="mt-3 bg-white border border-line rounded-3xl p-5 flex items-center gap-4">
            <div className="size-11 bg-green-soft text-green rounded-2xl flex items-center justify-center"><Icon name="check" /></div>
            <div className="flex-1"><div className="font-bold">Find a quiet corner in Riverside Park</div><div className="text-sm text-ink-muted mt-1">Completed last Saturday · +100 XP</div></div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="pb-28">
      <Header title={status === "complete" ? "Quest complete" : "Active quest"} subtitle="Morningside Heights" />
      <div className="px-5 lg:px-8 max-w-3xl">
        <div className={`rounded-card p-6 sm:p-8 ${status === "complete" ? "bg-green text-white" : "bg-lime text-ink"}`}>
          <div className="flex items-center justify-between">
            <div className="uppercase tracking-widest text-xs font-extrabold">{status === "complete" ? "Nicely rambled" : "Freshly generated"}</div>
            <div className="font-extrabold">+150 XP</div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-8">{status === "complete" ? "Quest completed!" : "The Local Shelf Challenge"}</div>
          <div className="mt-4 text-lg max-w-xl">{status === "complete" ? "You found a new corner of your neighborhood—and your passport just leveled up." : "Visit Book Culture and find a book by a New York author you haven't read before."}</div>
          {status === "active" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
              {[["pin", "Book Culture", "Destination"], ["map", "0.2 mi", "Distance"], ["clock", "30 min", "Time"], ["star", "150 XP", "Reward"]].map(([icon, value, label]) => (
                <div key={label} className="bg-white/60 rounded-2xl p-3"><Icon name={icon as IconName} size="sm" /><div className="font-extrabold mt-3 text-sm">{value}</div><div className="text-xs opacity-60 mt-0.5">{label}</div></div>
              ))}
            </div>
          )}
        </div>
        {status === "active" ? (
          <>
            <div className="mt-6 bg-white border border-line rounded-3xl p-5">
              <div className="text-xs font-extrabold uppercase tracking-widest text-ink-muted">Why this quest?</div>
              <div className="mt-3 flex gap-3"><div className="text-violet"><Icon name="sparkles" /></div><div className="text-sm leading-relaxed">You like books, this is a short walk, and you haven't explored this local favorite yet. Book Culture is a <b>Live Discovery</b>.</div></div>
            </div>
            <Action onClick={() => setStatus("complete")} className="mt-5 py-4 w-full"><Icon name="check" /> Complete quest</Action>
          </>
        ) : (
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            <div className="bg-white border border-line rounded-3xl p-5"><div className="text-sm text-ink-muted">Passport progress</div><div className="text-xl font-extrabold mt-1">65% explored</div><div className="h-2 bg-wash rounded-full mt-4 overflow-hidden"><div className="h-full w-2/3 bg-coral rounded-full" /></div></div>
            <div className="bg-white border border-line rounded-3xl p-5"><div className="text-sm text-ink-muted">Your total</div><div className="text-xl font-extrabold mt-1">7 quests · 850 XP</div><div className="text-sm text-green font-bold mt-4">New: Bookstore stamp</div></div>
          </div>
        )}
      </div>
    </div>
  );
}

function Journey() {
  const [time, setTime] = useState("90 min");
  const [generated, setGenerated] = useState(false);
  const stops = [discoveries[0], discoveries[1], discoveries[5]];
  return (
    <div className="pb-28">
      <Header title="Build my journey" subtitle="One neighborhood, made personal." />
      <div className="px-5 lg:px-8 max-w-4xl">
        {!generated ? (
          <div className="bg-white border border-line rounded-card p-6 sm:p-8">
            <div className="size-14 bg-violet-soft text-violet rounded-2xl flex items-center justify-center"><Icon name="route" size="lg" /></div>
            <div className="text-2xl font-extrabold mt-6 tracking-tight">How much time do you have?</div>
            <div className="text-ink-muted mt-2">We'll create a walkable route with places and moments that fit you.</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7">
              {["45 min", "90 min", "2 hours", "Half day"].map((item) => <Action key={item} variant="secondary" onClick={() => setTime(item)} className={`py-4 rounded-2xl ${time === item ? "bg-violet-soft border-violet text-violet" : ""}`}><Icon name="clock" size="sm" /> {item}</Action>)}
            </div>
            <Action onClick={() => setGenerated(true)} className="mt-8 py-4 w-full"><Icon name="sparkles" /> Build my journey</Action>
          </div>
        ) : (
          <>
            <div className="bg-violet text-white rounded-card p-6 sm:p-8">
              <div className="text-xs font-extrabold uppercase tracking-widest text-violet-contrast">Your {time} route</div>
              <div className="text-2xl font-extrabold mt-3">Pages, produce & new sounds</div>
              <div className="mt-3 text-white/70">1.4 miles · 3 stops · Mostly flat</div>
            </div>
            <div className="mt-5">
              {stops.map((stop, index) => (
                <div key={stop.id} className="flex gap-4">
                  <div className="flex flex-col items-center"><div className={`${stop.color} text-white size-10 rounded-full flex items-center justify-center font-extrabold`}>{index + 1}</div>{index < stops.length - 1 && <div className="w-0.5 h-20 bg-line" />}</div>
                  <div className="bg-white border border-line rounded-3xl p-4 flex-1 mb-4"><div className="font-extrabold">{stop.name}</div><div className="text-sm text-ink-muted mt-1">{stop.type} · {index === 0 ? "25" : index === 1 ? "30" : "35"} min</div><div className="text-sm mt-3 flex gap-2 text-ink-muted"><Icon name="sparkles" size="sm" />{stop.why}</div></div>
                </div>
              ))}
            </div>
            <Action className="py-4 w-full"><Icon name="route" /> Start journey</Action>
          </>
        )}
      </div>
    </div>
  );
}

function Passport({ questComplete }: { questComplete: boolean }) {
  const items = ["Bookstore", "Café", "Farmers Market", "Cultural Organization", "Historic Site", "Community Event"];
  return (
    <div className="pb-28">
      <Header title="Neighborhood passport" subtitle="Every block adds to your story." />
      <div className="px-5 lg:px-8 max-w-4xl">
        <div className="bg-coral text-white rounded-card p-6 sm:p-8">
          <div className="flex items-start justify-between"><div><div className="text-sm font-bold text-coral-contrast">CURRENT NEIGHBORHOOD</div><div className="text-2xl font-extrabold mt-2">Morningside Heights</div></div><Icon name="map" size="lg" /></div>
          <div className="mt-8 flex items-end justify-between"><div><span className="text-4xl font-extrabold">{questComplete ? 65 : 50}%</span><span className="text-white/70 ml-2">explored</span></div><div className="text-sm font-bold">Level 3</div></div>
          <div className="h-2 bg-white/20 rounded-full mt-4 overflow-hidden"><div className={`h-full bg-white rounded-full transition-all ${questComplete ? "w-2/3" : "w-1/2"}`} /></div>
        </div>
        <div className="mt-6 bg-white border border-line rounded-card p-5 sm:p-6">
          <div className="text-lg font-extrabold">Neighborhood stamps</div>
          <div className="mt-5 grid sm:grid-cols-2 gap-3">
            {items.map((item, index) => {
              const checked = index < 3 || (questComplete && index === 3);
              return <div key={item} className={`flex items-center gap-3 p-3 rounded-2xl ${checked ? "bg-green-soft" : "bg-wash"}`}><div className={`size-8 rounded-full flex items-center justify-center ${checked ? "bg-green text-white" : "bg-white text-ink-muted"}`}>{checked ? <Icon name="check" size="sm" /> : <span className="size-2 border border-ink-muted rounded-full" />}</div><span className={checked ? "font-bold" : "text-ink-muted"}>{item}</span></div>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Profile() {
  const stats = [["7", "Quests"], ["18", "Places"], ["3", "Neighborhoods"], ["12", "Saved"]];
  return (
    <div className="pb-28">
      <Header title="Your ramble" />
      <div className="px-5 lg:px-8 max-w-4xl">
        <div className="bg-ink text-white rounded-card p-6 flex items-center gap-5">
          <div className="size-20 bg-coral rounded-full flex items-center justify-center text-2xl font-extrabold">A</div>
          <div><div className="text-xl font-extrabold">Alex Morgan</div><div className="text-white/60 mt-1">Curious local · 850 XP</div><div className="inline-flex bg-lime text-ink text-xs font-extrabold rounded-full px-3 py-1 mt-3">LEVEL 4 EXPLORER</div></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">{stats.map(([value, label]) => <div key={label} className="bg-white border border-line rounded-3xl p-4"><div className="text-xl font-extrabold">{value}</div><div className="text-sm text-ink-muted mt-1">{label}</div></div>)}</div>
        <div className="mt-6 text-xl font-extrabold">Your interests</div>
        <div className="mt-3 flex flex-wrap gap-2">{["Books", "Art", "Coffee", "Sustainability", "Music"].map((item) => <div key={item} className="bg-white border border-line rounded-full px-4 py-2 text-sm font-bold">{item}</div>)}</div>
        <div className="mt-7 text-xl font-extrabold">Recent adventures</div>
        <div className="mt-3 space-y-3">{["Found a quiet corner in Riverside Park", "Visited the Wallach Art Gallery", "Saved Hex & Co."].map((item, index) => <div key={item} className="bg-white border border-line rounded-2xl p-4 flex gap-3 items-center"><div className="size-9 rounded-xl bg-lime-soft flex items-center justify-center"><Icon name={index === 2 ? "heart" : "check"} size="sm" /></div><div><div className="font-bold text-sm">{item}</div><div className="text-xs text-ink-muted mt-1">{index === 0 ? "Last Saturday" : index === 1 ? "2 weeks ago" : "3 weeks ago"}</div></div></div>)}</div>
      </div>
    </div>
  );
}

function People() {
  return (
    <div className="px-5 lg:px-8 mt-6 pb-28 lg:pb-8">
      <div className="text-xl font-extrabold">Find your people</div>
      <div className="text-sm text-ink-muted mt-1">Communities nearby that match your interests.</div>
      <div className="grid sm:grid-cols-3 gap-4 mt-4">
        {[["Columbia EcoReps", "Sustainability", "leaf"], ["Morningside Book Club", "Books", "book"], ["Harlem Arts Alliance", "Art + culture", "palette"]].map(([name, reason, icon]) => <div key={name} className="bg-white border border-line rounded-3xl p-5"><div className="size-10 bg-violet-soft text-violet rounded-xl flex items-center justify-center"><Icon name={icon as IconName} /></div><div className="font-extrabold mt-4">{name}</div><div className="text-sm text-ink-muted mt-1">Matched for {reason}</div><div className="text-sm font-bold text-violet mt-4 flex items-center gap-1">View community <Icon name="chevron" size="sm" /></div></div>)}
      </div>
    </div>
  );
}

function DiscoveryModal({ id, close, goQuest }: { id: number; close: () => void; goQuest: () => void }) {
  const place = discoveries.find((item) => item.id === id)!;
  return (
    <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5" onClick={close}>
      <div className="bg-cream w-full max-w-lg rounded-t-card sm:rounded-card p-5 sm:p-7 shadow-float" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start"><div className={`${place.color} text-white size-14 rounded-2xl flex items-center justify-center`}><Icon name={place.icon} size="lg" /></div><Action variant="secondary" onClick={close} className="size-10 p-0"><Icon name="x" /></Action></div>
        <div className="text-2xl font-extrabold mt-6 tracking-tight">{place.name}</div>
        <div className="text-ink-muted mt-2">{place.type} · {place.distance} away</div>
        <div className="mt-4"><SourceBadge source={place.source} /></div>
        <div className="mt-5 leading-relaxed text-ink-muted">{place.detail}</div>
        <div className="mt-5 bg-white rounded-2xl p-4 border border-line flex gap-3"><span className="text-coral"><Icon name="sparkles" /></span><div><div className="text-xs uppercase font-extrabold tracking-widest text-ink-muted">Why it fits you</div><div className="font-bold mt-1">{place.why}</div></div></div>
        <div className="flex gap-3 mt-6"><Action variant="secondary" className="p-4"><Icon name="heart" /></Action><Action onClick={goQuest} className="py-4 flex-1"><Icon name="dice" /> Make this a quest</Action></div>
      </div>
    </div>
  );
}

export default function App() {
  const [onboarded, setOnboarded] = useState(false);
  const [tab, setTab] = useState<Tab>("explore");
  const [discovery, setDiscovery] = useState<number | null>(null);
  const [quest, setQuest] = useState<"none" | "active" | "complete">("none");
  const content = useMemo(() => {
    if (tab === "quests") return <QuestView status={quest} setStatus={setQuest} />;
    if (tab === "journey") return <Journey />;
    if (tab === "passport") return <Passport questComplete={quest === "complete"} />;
    if (tab === "profile") return <Profile />;
    return <><Explore openDiscovery={setDiscovery} goQuest={() => { setQuest("none"); setTab("quests"); }} /><People /></>;
  }, [tab, quest]);
  if (!onboarded) return <Onboarding onDone={() => setOnboarded(true)} />;
  return (
    <main className="min-h-screen bg-cream text-ink lg:flex safe-top">
      <aside className="hidden lg:flex w-64 shrink-0 bg-white border-r border-line p-6 flex-col sticky top-0 h-screen">
        <Brand />
        <nav className="mt-10 space-y-2">{navItems.map((item) => <Action key={item.id} variant="quiet" onClick={() => setTab(item.id)} className={`px-4 py-3 justify-start rounded-2xl ${tab === item.id ? "bg-ink text-white" : ""}`}><Icon name={item.icon} />{item.label}</Action>)}</nav>
        <div className="mt-auto bg-lime-soft rounded-3xl p-4"><div className="text-sm font-extrabold">Keep rambling</div><div className="text-xs text-ink-muted mt-1">150 XP until level 5</div><div className="h-1.5 bg-white rounded-full mt-3"><div className="w-2/3 h-full bg-ink rounded-full" /></div></div>
      </aside>
      <section className="flex-1 min-w-0">{content}</section>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-line grid grid-cols-5 px-1 pb-safe pt-2">
        {navItems.map((item) => <Action key={item.id} variant="quiet" onClick={() => setTab(item.id)} className={`min-w-0 w-full flex-col gap-1 py-2 px-1 rounded-xl text-xs ${tab === item.id ? "text-coral bg-coral-soft" : ""}`}><Icon name={item.icon} /><span>{item.label}</span></Action>)}
      </nav>
      {discovery && <DiscoveryModal id={discovery} close={() => setDiscovery(null)} goQuest={() => { setDiscovery(null); setQuest("active"); setTab("quests"); }} />}
    </main>
  );
}
