# Ramble

Ramble is a mobile-first prototype for exploring New York as a map of communities — starting in Morningside Heights, around Columbia University.

> Turn the city from a map of places into a map of communities.

## Demo flow

Create an account, pick at least three interests, then:

1. Open the Explore map and a discovery.
2. Tap **Give me a side quest**, accept it, and complete it.
3. Find it under **Quests → Completed**. The passport percentage moves when the quest stamps a new kind of place.
4. Open **Journey** and tap **Build my journey**.

The account, quests, saved places, and passport live in this browser (`localStorage`). The password is checked on the signup form and not stored.

## What’s in the feed

Verified places come from five NYC Open Data feeds, limited to Morningside Heights:

- Farmers markets
- Public art
- GreenThumb community gardens
- Individual landmarks
- Libraries, museums, and community centers

The app starts from a saved copy of those rows, then refreshes each dataset in the browser. If one request fails, that dataset stays on the saved copy. Cafés, the game café, concerts, parks, and the food pantry stay in the app as **Live Discovery** until a search client exists.

A new passport opens at **50%** (Bookstore, Café, Farmers Market). Completing a quest fills the next line: Cultural Organization, Historic Site, or Community Event.

## Pipeline

```
NYC Open Data (live, with a saved fallback) + Live Discovery fixtures
  → normalize into Discovery / Community records
  → agent (match, why, side quest, journey)
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
