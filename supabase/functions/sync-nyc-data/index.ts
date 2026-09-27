import { createClient } from "npm:@supabase/supabase-js@2";

import { cleanNYCValue, fetchSocrata, nycCoordinates, upsertDiscoveries, type SupabaseClient } from "./helpers.ts";
import { syncCommunityGardens, syncCulturalOrganizations, syncLibraries, syncFarmersMarkets, syncRestaurants, syncPOPS } from "./places.ts";

// ==================================================
// NYC PARKS EVENT HELPERS
// ==================================================

function categorizeEvent(event: any): string[] {
  const title = (event.title ?? "").toLowerCase();
  const description = (event.description ?? "").toLowerCase();
  const nycCategories = (event.categories ?? "").toLowerCase();

  const categories = new Set<string>();

  // Title + NYC's categories are stronger signals than
  // random words appearing somewhere in the description.
  const strongText = `${title} ${nycCategories}`;
  const allText = `${strongText} ${description}`;

  function matches(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => {
      const escaped = keyword.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const regex = new RegExp(
        `(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`,
        "i"
      );

      return regex.test(text);
    });
  }

  // FOOD
  if (
    matches(strongText, [
      "food",
      "cooking",
      "culinary",
      "farmers market",
      "food festival",
    ])
  ) {
    categories.add("food");
  }

  // ART
  if (
    matches(strongText, [
      "art",
      "arts",
      "painting",
      "drawing",
      "sculpture",
      "photography",
      "craft",
      "crafts",
      "gallery",
      "exhibition",
    ])
  ) {
    categories.add("art");
  }

  // BOOKS
  if (
    matches(strongText, [
      "book",
      "books",
      "reading",
      "literary",
      "author",
      "poetry",
      "storytelling",
    ])
  ) {
    categories.add("books");
  }

  // GAMING
  if (
    matches(strongText, [
      "gaming",
      "video game",
      "video games",
      "board game",
      "board games",
      "chess",
      "esports",
    ])
  ) {
    categories.add("gaming");
  }

  // CULTURE
  if (
    matches(strongText, [
      "culture",
      "cultural",
      "heritage",
      "festival",
      "community festival",
    ])
  ) {
    categories.add("culture");
  }

  // VOLUNTEERING
  if (
    matches(allText, [
      "volunteer",
      "volunteering",
      "cleanup",
      "clean-up",
      "stewardship",
      "service project",
    ])
  ) {
    categories.add("volunteering");
  }

  // HISTORY
  if (
    matches(strongText, [
      "history",
      "historic",
      "historical",
      "heritage tour",
      "walking tour",
    ])
  ) {
    categories.add("history");
  }

  // COFFEE
  if (
    matches(strongText, [
      "coffee",
      "cafe",
      "café",
      "espresso",
    ])
  ) {
    categories.add("coffee");
  }

  // SUSTAINABILITY
  if (
    matches(allText, [
      "environment",
      "environmental",
      "nature",
      "gardening",
      "garden",
      "compost",
      "composting",
      "recycling",
      "sustainability",
      "conservation",
      "ecology",
      "forest bathing",
      "tree identification",
    ])
  ) {
    categories.add("sustainability");
  }

  // MUSIC
  if (
    matches(strongText, [
      "music",
      "concert",
      "jazz",
      "choir",
      "singing",
      "band",
      "orchestra",
      "musical",
    ])
  ) {
    categories.add("music");
  }

  // TECHNOLOGY
  if (
    matches(strongText, [
      "technology",
      "coding",
      "computer",
      "computers",
      "robotics",
      "programming",
      "software",
      "web development",
      "artificial intelligence",
      "virtual reality",
      "digital technology",
      "maker",
      "makerspace",
    ])
  ) {
    categories.add("technology");
  }

  return Array.from(categories);
}


function parseCoordinates(coordinates?: string) {
  if (!coordinates) {
    return {
      latitude: null,
      longitude: null,
    };
  }

  const [latitudeString, longitudeString] =
    coordinates.split(",");

  const latitude = Number(latitudeString?.trim());
  const longitude = Number(longitudeString?.trim());

  return {
    latitude: Number.isFinite(latitude)
      ? latitude
      : null,

    longitude: Number.isFinite(longitude)
      ? longitude
      : null,
  };
}


// ==================================================
// NYC PUBLIC ART HELPERS
// ==================================================

function createPublicArtId(artwork: any): string {
  return [
    artwork.title,
    artwork.location_name,
    artwork.address,
    artwork.borough,
  ]
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}


function categorizePublicArt(artwork: any): string[] {
  const categories = new Set<string>();

  // Every record in this dataset is public art.
  categories.add("art");

  const text = `
    ${artwork.title ?? ""}
    ${artwork.alternate_title ?? ""}
    ${artwork.artwork_type1 ?? ""}
    ${artwork.artwork_type2 ?? ""}
    ${artwork.subject_keyword ?? ""}
    ${artwork.inscription ?? ""}
  `.toLowerCase();

  const historyKeywords = [
    "monument",
    "memorial",
    "marker",
    "tablet",
    "historic",
    "historical",
    "war",
    "revolution",
    "world's fair",
    "world war",
  ];

  if (
    historyKeywords.some((keyword) =>
      text.includes(keyword)
    )
  ) {
    categories.add("history");
  }

  const cultureKeywords = [
    "heritage",
    "cultural",
    "culture",
    "immigrant",
    "community",
  ];

  if (
    cultureKeywords.some((keyword) =>
      text.includes(keyword)
    )
  ) {
    categories.add("culture");
  }

  return Array.from(categories);
}


// ==================================================
// FETCH NYC DATA
// ==================================================

async function fetchParksEvents() {
  return await fetchSocrata("w3wp-dpdi", "NYC Parks");
}

async function fetchPublicArt() {
  return await fetchSocrata("2pg3-gcaa", "NYC Public Art");
}


// ==================================================
// SYNC PARKS EVENTS
// ==================================================

async function syncParksEvents(
  supabase: SupabaseClient
) {
  const data = await fetchParksEvents();

  const discoveries = data

    // Must have a unique ID and title.
    .filter(
      (event: any) =>
        cleanNYCValue(event.guid) &&
        cleanNYCValue(event.title)
    )

    // Do not recommend canceled events.
    .filter(
      (event: any) =>
        !event.title
          .toLowerCase()
          .includes("canceled:")
    )

    .map((event: any) => {
      const coordinates =
        parseCoordinates(event.coordinates);

      return {
        external_id: event.guid,

        name: event.title,

        discovery_type: "event",

        categories:
          categorizeEvent(event),

        description:
          cleanNYCValue(event.description),

        address:
          cleanNYCValue(event.location),

        neighborhood: null,

        borough: null,

        latitude:
          coordinates.latitude,

        longitude:
          coordinates.longitude,

        start_time:
          cleanNYCValue(event.starttime),

        end_time:
          cleanNYCValue(event.endtime),

        source: "NYC Parks",

        source_url:
          event.link?.url ?? null,

        last_synced_at:
          new Date().toISOString(),
      };
    })

    // Only save events relevant to one of
    // Ramble's categories.
    .filter(
      (event: any) =>
        event.categories.length > 0
    );

  console.log(
    `Prepared ${discoveries.length} Parks events`
  );

  const imported = await upsertDiscoveries(supabase, "NYC Parks", discoveries);
  return { fetched: data.length, imported, sample: discoveries.slice(0, 3) };
}


// ==================================================
// SYNC PUBLIC ART
// ==================================================

async function syncPublicArt(
  supabase: SupabaseClient
) {
  const data = await fetchPublicArt();

  const discoveries = data

    // We need a title and coordinates to
    // make the place useful in Ramble.
    .filter(
      (artwork: any) =>
        cleanNYCValue(artwork.title) &&
        nycCoordinates(artwork.latitude, artwork.longitude)
    )

    .map((artwork: any) => {
      const locationName =
        cleanNYCValue(
          artwork.location_name
        );

      const address =
        cleanNYCValue(
          artwork.address
        );

      const material =
        cleanNYCValue(
          artwork.material
        );

      const type =
        cleanNYCValue(
          artwork.artwork_type1
        );

      const subject =
        cleanNYCValue(
          artwork.subject_keyword
        );

      const created =
        cleanNYCValue(
          artwork.date_created
        );

      // Build a readable description
      // from NYC's structured fields.
      const descriptionParts:
        string[] = [];

      if (type) {
        descriptionParts.push(type);
      }

      if (material) {
        descriptionParts.push(
          `Made of ${material}`
        );
      }

      if (created) {
        descriptionParts.push(
          `Created in ${created}`
        );
      }

      if (subject) {
        descriptionParts.push(
          `Subjects: ${subject}`
        );
      }

      let formattedAddress:
        string | null = null;

      if (address && locationName) {
        formattedAddress =
          `${address} (${locationName})`;
      } else {
        formattedAddress =
          address ?? locationName;
      }

      return {
        external_id:
          createPublicArtId(artwork),

        name:
          artwork.title,

        discovery_type:
          "place",

        categories:
          categorizePublicArt(artwork),

        description:
          descriptionParts.length > 0
            ? descriptionParts.join(". ")
            : null,

        address:
          formattedAddress,

        neighborhood:
          null,

        borough:
          cleanNYCValue(
            artwork.borough
          ),

        latitude:
          Number(artwork.latitude),

        longitude:
          Number(artwork.longitude),

        // Places don't have event times.
        start_time:
          null,

        end_time:
          null,

        source:
          "NYC Public Art",

        source_url:
          null,

        last_synced_at:
          new Date().toISOString(),
      };
    });

  // Remove duplicate public art records that generated
  // the same external_id.
  const uniqueDiscoveries = Array.from(
    new Map(
      discoveries.map((artwork: any) => [
        artwork.external_id,
        artwork,
      ])
    ).values()
  );

  console.log(
    `Prepared ${discoveries.length} public art records`
  );

  console.log(
    `After removing duplicates: ${uniqueDiscoveries.length}`
  );

  const imported = await upsertDiscoveries(supabase, "NYC Public Art", uniqueDiscoveries);
  return { fetched: data.length, imported, sample: uniqueDiscoveries.slice(0, 3) };
}


// ==================================================
// DELETE EXPIRED EVENTS
// ==================================================

async function deleteExpiredEvents(
  supabase: SupabaseClient
) {
  const now =
    new Date().toISOString();

  const { error } = await supabase
    .from("discoveries")
    .delete()
    .eq("discovery_type", "event")
    .not("end_time", "is", null)
    .lt("end_time", now);

  if (error) {
    throw new Error(
      `Failed to delete expired events: ${error.message}`
    );
  }

  console.log(
    "Expired events deleted"
  );
}


// ==================================================
// MAIN EDGE FUNCTION
// ==================================================

Deno.serve(async () => {
  try {

    // ----------------------------------------------
    // Connect to Supabase
    // ----------------------------------------------

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      throw new Error(
        "Missing Supabase environment variables"
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey
      );


    // ----------------------------------------------
    // Sync NYC Parks events
    // ----------------------------------------------

    const parks =
      await syncParksEvents(
        supabase
      );


    // ----------------------------------------------
    // Sync NYC Public Art
    // ----------------------------------------------

    const publicArt =
      await syncPublicArt(
        supabase
      );


    // ----------------------------------------------
    // Delete expired events
    // ----------------------------------------------

    await deleteExpiredEvents(
      supabase
    );

    // Each source owns its schema mapping; only I/O utilities are shared.
    const communityGardens = await syncCommunityGardens(supabase);
    const culturalOrganizations = await syncCulturalOrganizations(supabase);
    const libraries = await syncLibraries(supabase);
    const farmersMarkets = await syncFarmersMarkets(supabase);
    const restaurants = await syncRestaurants(supabase);
    const pops = await syncPOPS(supabase);



    // ----------------------------------------------
    // Success response
    // ----------------------------------------------

    return new Response(
      JSON.stringify(
        {
          success: true,
          communityGardens,
          culturalOrganizations,
          libraries,
          farmersMarkets,
          restaurants,
          pops,

          parks: {
            fetched:
              parks.fetched,

            imported:
              parks.imported,

            sample:
              parks.sample,
          },

          publicArt: {
            fetched:
              publicArt.fetched,

            imported:
              publicArt.imported,

            sample:
              publicArt.sample,
          },
        },
        null,
        2
      ),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/json",
        },
      }
    );

  } catch (error) {

    console.error(
      "sync-nyc-data failed:",
      error
    );

    return new Response(
      JSON.stringify(
        {
          success: false,

          error:
            error instanceof Error
              ? error.message
              : "Unknown error occurred",
        },
        null,
        2
      ),
      {
        status: 500,

        headers: {
          "Content-Type":
            "application/json",
        },
      }
    );
  }
});