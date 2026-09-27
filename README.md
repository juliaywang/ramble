# Ramble

Ramble is a mobile-first prototype for exploring New York City as a map of communities — Manhattan first, then Brooklyn, Queens, the Bronx, and Staten Island.

> Turn the city from a map of places into a map of communities.

## Demo flow

Create an account, pick at least three interests, then:

1. On Explore, switch boroughs. The map and the list follow the borough you pick. All NYC shows the five together.
2. Open a discovery, tap **Give me a side quest**, accept it, and complete it. Quests and journeys start at your current location. Allow location when the browser asks. Open in Maps is on the place and on the quest. Edit profile is under the picture at the top right, and on Explore.
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

## Friends & Community (Supabase)

Ramble includes a **Friends** feature to connect with fellow NYC explorers, share discoveries, compare passport progress, and ramble together.

### Demo mode & Supabase connection

- **Runs immediately in Local Demo Mode**: If you haven't created your Supabase database yet, the Friends feature works in local demo mode with pre-populated NYC explorers (e.g. `@mayawalks`, `@marcus_nyc`, `@elenarambles`). You can search, send/accept requests, view profiles, and test the full experience right away.
- **Connecting your Supabase database**:
  1. Create a free project at [supabase.com](https://supabase.com).
  2. Open the **SQL Editor** in Supabase and run [`supabase/schema.sql`](supabase/schema.sql) (or [`supabase_setup.sql`](supabase_setup.sql)). This creates the `profiles` and `friendships` tables, indexes, and RLS policies.
  3. Copy your **Project URL** and **anon public key** from Supabase (Project Settings → API).
  4. Either:
     - Add them to `.env`:
       ```env
       VITE_SUPABASE_URL=https://your-project.supabase.co
       VITE_SUPABASE_ANON_KEY=your-anon-key
       ```
     - **Or** enter them directly inside Ramble under **Settings → Supabase Database** (or tap the database banner on the Friends screen).

## Scripts

```bash
npm install
npm run dev
npm test
npm run build
```


### Local demo accounts

With `npm run dev`, friends use browser storage instead of Supabase. Choose **Sign in / Create account**, create an account with any email-shaped address and a password of at least six characters, and select your interests. Later, choose **Sign in** with the same email and password to restore its profile, friends, requests, saved places, quests, passport, and journey. Each account retains its own identity and progress. To try requests between two accounts, create both in the same browser, send a request from one, then sign in as the other to accept it.

These are local demo accounts, not server authentication. They stay in this browser at the same origin (including the localhost port); clearing site data removes them, and they do not sync across devices. Passwords are stored as salted PBKDF2 hashes. Older accounts without a password keep their existing identity and set a password on their first local sign-in.


### Shared quests and journeys

Run [supabase_activities.sql](./supabase_activities.sql) in the Supabase SQL Editor after the main setup script to enable activity invitations across accounts/devices. Deploy the updated app afterward. This migration adds a participant-only invitation table and a function for accepting, declining, and recording check-ins; it does not alter existing account data.

From an active quest or generated journey, choose an accepted friend and select **Invite to join**. Each activity supports one invited friend. Both users can open **Friends → Activity invites** to view the activity; the recipient chooses **Join** or **Decline**. Invitations refresh every 15 seconds, when the window gains focus, or with **Refresh**.

Each person checks in within 200 feet of the destination. Their own check-in earns base XP; both check-ins within 30 minutes award each participant an additional 50% of base XP. Shared journeys award 40 base XP plus 20 together XP per stop. Each stop must be checked in separately. Sending or accepting invitations alone does not earn XP. Duplicate check-ins retain the original timestamp and do not repeat rewards. The sender's original quest is updated rather than added again.

Without Supabase configured, invitations persist in this browser's local storage; test with two local accounts in the same browser. Separate browsers/devices require Supabase. Configured cloud errors are shown rather than silently saving invitations locally. Location is verified by the app, not a server-side GPS attestation service.


### Frontend discovery feed

With `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` configured, the frontend reads the existing `discoveries` table for all eight synced NYC sources. It uses the public browser key, never a service-role key. Pagination loads more than the first 1,000 records. The feed refreshes after login, on window focus, and every five minutes; changed descriptions and coordinates are applied as well as new IDs.

Deploy/run `sync-nyc-data` first to populate the table, then deploy/reload the frontend. If Explore reports that it is showing saved places, check the sync results and read permissions. [supabase_discoveries_read.sql](./supabase_discoveries_read.sql) grants read access to these public NYC sources if needed; it adds no browser write policy. An empty or failed database read shows a fallback notice. Without Supabase configured, the existing direct NYC fetch remains available.

Supabase source/external-ID pairs give records stable frontend IDs. Same-name nearby matches retain existing IDs for saved places and quests. Curated local entries remain available. Records without coordinates cannot appear on the map; cultural organizations will appear once geocoded. Expired or undated events are excluded. Upcoming events can be viewed, but only running events produce quests or journey stops. Source links and event schedules appear on place details.
