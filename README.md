# Ramble

Ramble is a mobile-first prototype for exploring New York City as a map of communities — Manhattan first, then Brooklyn, Queens, the Bronx, and Staten Island.

> Turn the city from a map of places into a map of communities.

## Demo flow

Create an account, pick at least three interests, then:

1. On Explore, switch boroughs. The map and the list follow the borough you pick. All NYC shows the five together.
2. Open a discovery, tap **Give me a side quest**, accept it, and complete it. Quests and journeys start at your current location. If location is off, they start from that borough’s anchor (College Walk in Manhattan).
3. Find it under **Quests → Completed**. The passport percentage moves when the quest stamps a new kind of place.
4. Open **Journey** and tap **Build my journey**.

The account, quests, saved places, and passport live in this browser (`localStorage`). The password is checked on the signup form and not stored.

## What’s in the feed

Verified places come from NYC Open Data, across the city:

- Farmers markets
- Public art
- GreenThumb community gardens
- Libraries, museums, and community centers

The app starts from a saved copy of those rows, then refreshes each dataset in the browser. If one request fails, that dataset stays on the saved copy. Cafés, the game café, concerts, parks, and the food pantry stay in the app as **Live Discovery** until a search client exists.

A new passport opens at **50%** (Bookstore, Café, Farmers Market). Completing a quest fills the next line: Cultural Organization, Historic Site, or Community Event.

## Pipeline

```
NYC Open Data (live, with a saved citywide fallback) + Live Discovery fixtures
  → normalize into Discovery / Community records, tagged by borough
  → agent (match, why, side quest, journey) from the borough’s starting point
  → map
```

`fetchNeighborhoodFeed()` is the seam. `src/pipeline/agent.ts` stays the personalization layer.

## Scripts

```bash
npm install
npm run dev
npm test
npm run build
```
