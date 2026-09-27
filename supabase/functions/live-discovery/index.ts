// ==================================================
// RAMBLE LIVE DISCOVERY
// Supabase Edge Function: Tavily Search + Google Gemini Structured Extraction
// ==================================================

// ==================================================
// CONFIGURATION & CONSTANTS
// ==================================================

export const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Model selection constant:
 * gemini-2.5-flash-lite is optimized for low-latency, high-volume structured extraction
 * and natively supports Gemini Structured Outputs (responseMimeType: "application/json" + responseSchema).
 */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

export const MAX_CATEGORIES = 3;
export const MAX_TAVILY_RESULTS_PER_CATEGORY = 6;
export const MAX_SOURCE_CONTENT_LENGTH = 1200;
export const MAX_BATCH_SOURCES_TO_LLM = 15;

export const ALLOWED_CATEGORIES = [
  "food",
  "art",
  "books",
  "gaming",
  "culture",
  "volunteering",
  "history",
  "coffee",
  "sustainability",
  "music",
  "technology",
] as const;

export type Category = (typeof ALLOWED_CATEGORIES)[number];

// ==================================================
// DATA CONTRACTS & INTERFACES
// ==================================================

export interface RequestBody {
  latitude?: number;
  longitude?: number;
  neighborhood?: string;
  categories?: string[];
}

export interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
}

export interface TavilyResponse {
  results?: TavilyResult[];
}

export interface SourceDocument {
  source_id: string;
  url: string;
  title: string;
  snippet: string;
  category: Category;
  neighborhood: string;
}

export interface RawExtractedDiscovery {
  name: string;
  discovery_type: "place" | "event";
  categories: string[];
  description: string | null;
  address: string | null;
  neighborhood: string | null;
  borough: string | null;
  latitude: number | null;
  longitude: number | null;
  start_time: string | null;
  end_time: string | null;
  source_url: string;
}

export interface Discovery {
  name: string;
  discovery_type: "place" | "event";
  categories: Category[];
  description: string | null;
  address: string | null;
  neighborhood: string | null;
  borough: string | null;
  latitude: number | null;
  longitude: number | null;
  start_time: string | null;
  end_time: string | null;
  source: "Live Discovery";
  source_url: string;
  verified: false;
}

// ==================================================
// CORS HEADERS
// ==================================================

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ==================================================
// API KEY RESOLUTION (SAFE SERVER-SIDE)
// ==================================================

export function getApiKey(name: "TAVILY_API_KEY" | "GEMINI_API_KEY"): string | undefined {
  if (typeof Deno !== "undefined" && Deno.env?.get) {
    return Deno.env.get(name);
  }
  return (globalThis as unknown as { process?: { env?: Record<string, string> } }).process?.env?.[name];
}

// ==================================================
// NYC GEOGRAPHY & LANDMARKS
// ==================================================

export interface NeighborhoodMeta {
  borough: string;
  aliases: string[];
}

export const NYC_NEIGHBORHOODS: Record<string, NeighborhoodMeta> = {
  "Morningside Heights": {
    borough: "Manhattan",
    aliases: ["morningside heights", "morningside"],
  },
  "Harlem": {
    borough: "Manhattan",
    aliases: ["harlem", "central harlem", "west harlem", "east harlem"],
  },
  "Upper West Side": {
    borough: "Manhattan",
    aliases: ["upper west side", "uws"],
  },
  "Upper East Side": {
    borough: "Manhattan",
    aliases: ["upper east side", "ues", "yorkville", "carnegie hill"],
  },
  "East Village": {
    borough: "Manhattan",
    aliases: ["east village", "alphabet city"],
  },
  "West Village": {
    borough: "Manhattan",
    aliases: ["west village", "greenwich village", "meatpacking"],
  },
  "Williamsburg": {
    borough: "Brooklyn",
    aliases: ["williamsburg", "east williamsburg"],
  },
  "Bushwick": {
    borough: "Brooklyn",
    aliases: ["bushwick"],
  },
  "DUMBO": {
    borough: "Brooklyn",
    aliases: ["dumbo"],
  },
  "Astoria": {
    borough: "Queens",
    aliases: ["astoria"],
  },
};

export const OUT_OF_HOOD_DISQUALIFIERS: Record<string, string[]> = {
  "Morningside Heights": [
    "bryant park",
    "times square",
    "rockefeller center",
    "empire state",
    "madison square",
    "lincoln center",
    "carnegie hall",
    "radio city",
    "battery park",
    "high line",
    "little island",
    "soho",
    "tribeca",
    "chelsea",
    "greenwich village",
    "west village",
    "east village",
    "lower east side",
    "financial district",
    "fidi",
    "midtown",
    "hells kitchen",
    "hell's kitchen",
    "gramercy",
    "flatiron",
    "union square",
    "washington square",
    "central park south",
    "central park zoo",
    "prospect park",
    "williamsburg",
    "bushwick",
    "dumbo",
    "astoria",
    "flushing",
  ],
};

// ==================================================
// URL EXCLUSIONS & SPAM FILTERING
// ==================================================

export const BLOCKED_DOMAINS = [
  "yelp.com",
  "tripadvisor.com",
  "foursquare.com",
  "pinterest.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "reddit.com",
  "twitter.com",
  "x.com",
  "yellowpages.com",
  "mapquest.com",
  "groupon.com",
  "whitepages.com",
  "superpages.com",
  "citysearch.com",
  "nextdoor.com",
  "bbb.org",
  "linkedin.com",
  "zillow.com",
  "streeteasy.com",
  "apartments.com",
  "rent.com",
  "trulia.com",
  "realtor.com",
  "movers.com",
  "moving.com",
];

export function isBlockedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    return BLOCKED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return true;
  }
}

// ==================================================
// 1. VALIDATE REQUEST HELPER
// ==================================================

export interface ValidatedRequest {
  neighborhood: string;
  categories: Category[];
  latitude?: number;
  longitude?: number;
}

export function isCategory(value: string): value is Category {
  return (ALLOWED_CATEGORIES as readonly string[]).includes(value);
}

export function validateRequest(body: unknown): {
  isValid: boolean;
  error?: string;
  data?: ValidatedRequest;
} {
  if (!body || typeof body !== "object") {
    return { isValid: false, error: "Request body must be a JSON object" };
  }

  const raw = body as RequestBody;

  if (!Array.isArray(raw.categories) || raw.categories.length === 0) {
    return { isValid: false, error: "categories must be a non-empty array" };
  }

  const validCategories = raw.categories.filter(
    (cat): cat is Category => typeof cat === "string" && isCategory(cat)
  );

  if (validCategories.length === 0) {
    return {
      isValid: false,
      error: `No valid Ramble categories found. Allowed: ${ALLOWED_CATEGORIES.join(", ")}`,
    };
  }

  // Enforce max categories per request to control API usage
  const categories = validCategories.slice(0, MAX_CATEGORIES);

  const neighborhood =
    typeof raw.neighborhood === "string" && raw.neighborhood.trim()
      ? raw.neighborhood.trim()
      : "New York City";

  const latitude =
    typeof raw.latitude === "number" && !isNaN(raw.latitude)
      ? raw.latitude
      : undefined;
  const longitude =
    typeof raw.longitude === "number" && !isNaN(raw.longitude)
      ? raw.longitude
      : undefined;

  return {
    isValid: true,
    data: {
      neighborhood,
      categories,
      latitude,
      longitude,
    },
  };
}

// ==================================================
// 2. QUERY GENERATION HELPER
// ==================================================

export function buildSearchQuery(category: Category, neighborhood: string): string {
  const isSpecific =
    neighborhood &&
    neighborhood.trim() &&
    neighborhood.trim().toLowerCase() !== "new york city" &&
    neighborhood.trim().toLowerCase() !== "nyc";
  const cleanHood = neighborhood.trim();
  const borough = isSpecific && NYC_NEIGHBORHOODS[cleanHood] ? ` ${NYC_NEIGHBORHOODS[cleanHood].borough}` : "";
  const location = isSpecific
    ? `physically located in ${cleanHood}${borough} NYC`
    : "physically located in New York City";

  const queries: Record<Category, string> = {
    food: `independent local restaurants food markets ${location} address`,
    art: `independent art galleries public art exhibition spaces ${location} address`,
    books: `independent bookstores booksellers ${location} address`,
    gaming: `board game cafes gaming lounges arcades ${location} address`,
    culture: `cultural centers community spaces cultural spaces ${location} address`,
    volunteering: `community organizations volunteer opportunities local centers ${location}`,
    history: `historic sites landmarks heritage spaces ${location} address`,
    coffee: `independent coffee shops cafes ${location} address`,
    sustainability: `community gardens sustainability spaces environmental centers ${location} address`,
    music: `live music venues concert halls intimate performance spaces ${location} address`,
    technology: `makerspaces hacker spaces tech communities coding spaces ${location} address`,
  };

  return queries[category];
}

// ==================================================
// 3. TAVILY SEARCH HELPER
// ==================================================

export async function searchTavily(
  apiKey: string,
  query: string,
  fetchFn: typeof fetch = fetch
): Promise<TavilyResult[]> {
  const response = await fetchFn(TAVILY_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: MAX_TAVILY_RESULTS_PER_CATEGORY,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
      exclude_domains: BLOCKED_DOMAINS.slice(0, 15),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily API failed (${response.status}): ${errorText}`);
  }

  const data: TavilyResponse = await response.json();
  return data.results ?? [];
}

// ==================================================
// 4. PREPARE SOURCES FOR EXTRACTION
// ==================================================

export function prepareSourcesForExtraction(
  categorySearches: Array<{ category: Category; results: TavilyResult[] }>,
  requestedNeighborhood: string
): SourceDocument[] {
  const seenUrls = new Set<string>();
  const documents: SourceDocument[] = [];

  for (const { category, results } of categorySearches) {
    for (const res of results) {
      if (!res.url || !res.title) continue;
      const cleanUrl = res.url.trim();

      if (isBlockedUrl(cleanUrl)) continue;
      if (seenUrls.has(cleanUrl)) continue;
      seenUrls.add(cleanUrl);

      // Clean and truncate content to preserve token budget
      const rawContent = (res.content ?? "").replace(/\s+/g, " ").trim();
      const snippet = rawContent.slice(0, MAX_SOURCE_CONTENT_LENGTH);

      documents.push({
        source_id: `src_${documents.length + 1}`,
        url: cleanUrl,
        title: res.title.trim(),
        snippet,
        category,
        neighborhood: requestedNeighborhood,
      });

      if (documents.length >= MAX_BATCH_SOURCES_TO_LLM) {
        return documents;
      }
    }
  }

  return documents;
}

// ==================================================
// 5. GEMINI STRUCTURED EXTRACTION HELPER
// ==================================================

export const EXTRACTION_SYSTEM_PROMPT = `You are a strict, factual information extraction engine for Ramble, an NYC exploration app.
Your task is to analyze the provided web search sources and extract actual individual NYC places or specific scheduled events that match the requested category and geographic area.

CRITICAL EXTRACTION RULES:
1. EXTRACT ACTUAL ENTITIES, NOT ARTICLE TITLES:
   - BAD: "The Best Independent Bookstores In NYC"
   - GOOD: "Book Culture"
   - BAD: "Perk Up! The Buzz on Upper West Side Coffee Spots"
   - GOOD: "The Hungarian Pastry Shop"
   - BAD: "10 Cozy Morningside Heights Cafes"
   - GOOD: "Sipsteria"

2. VALID PLACES & EVENTS ONLY:
   - Valid places: bookstore, cafe, restaurant, bakery, gallery, museum, cultural center, music venue, library, gaming cafe, arcade, makerspace, community garden, historic site, community center.
   - Valid events: specific concert, workshop, meetup, book reading, volunteer session, performance, festival, pop-up market.

3. NEVER RETURN JUNK OR NON-ENTITIES:
   - NEVER return: articles, listicles, neighborhood guides, generic event calendars, directories, search result pages.
   - NEVER return: apartment buildings (e.g. One Morningside Park, Avalon), real estate listings, moving companies (e.g. Morningside Heights Movers), commercial leasing, movies (e.g. Spider-Man 2), or unrelated businesses.

4. STRICT POSITIVE GEOGRAPHIC EVIDENCE (MANDATORY):
   - When a specific neighborhood is requested (e.g. "Morningside Heights"), every extracted discovery must contain source-supported positive evidence that the entity itself is physically located in that neighborhood or its immediate surrounding streets/campus.
   - Do NOT accept an entity merely because Tavily returned it for the query, because it is somewhere in Manhattan, or because the webpage discusses the requested neighborhood.
   - If an event or place has no neighborhood and no address (or only borough = "Manhattan"), it must NOT be extracted for a neighborhood-specific request.
   - A borough of "Manhattan" by itself is insufficient evidence for a Morningside Heights request.
   - For Morningside Heights, acceptable evidence includes:
     * The source explicitly names "Morningside Heights", "Morningside", "Columbia University", "Barnard College", "Cathedral of St. John the Divine", or "Riverside Church".
     * A street address between W 110th St and W 125th St (e.g. Broadway, Amsterdam Ave, Claremont Ave, Riverside Dr, Manhattan Ave).
   - NEVER return entities from distant Manhattan neighborhoods (e.g., Bryant Park, Midtown, Times Square, Lincoln Center, Central Park South, SoHo, Lower East Side, Chelsea, Greenwich Village, East Village, Financial District) or other boroughs for a Morningside Heights request.
   - If the source text does NOT establish geographic relevance, OMIT THE ENTITY. Returning fewer discoveries is far better than returning unrelated Manhattan results.
   - Do NOT invent an address or neighborhood to make an entity pass.

5. ENTITY-LEVEL CATEGORY RELEVANCE (MANDATORY):
   - A discovery must ACTUALLY belong to the category being searched based on what the entity itself is or does.
   - NEVER assume that something belongs to a category (e.g. "music") simply because it came from a search for that category or has a search topic label.
   - Example false positive: "The Garden People: 45 Years in Bloom" (description: "Join the Garden People in celebrating 45 years of growing together...") is a community garden anniversary celebration, NOT a music discovery. Do NOT extract it as music unless the source specifically establishes a relevant live musical performance.
   - Gemini must independently determine whether the ENTITY itself is genuinely relevant to the requested category.
   - If it is not relevant, OMIT IT.

6. DO NOT CREATE AGGREGATE PLACE RECORDS (MANDATORY):
   - Do NOT return a place when the extracted address actually describes multiple locations (e.g. address: "112th and 114th streets", "locations on Broadway and Amsterdam", "multiple locations").
   - A single place discovery must represent exactly ONE physical location.
   - If a source describes multiple locations (e.g. Book Culture having branches on 112th St and Broadway):
     * Extract each location separately ONLY when the source provides enough information to identify each individual location with its own specific physical address (e.g. "536 West 112th Street" as one discovery, "2915 Broadway" as another).
     * If the source describes multiple locations in an aggregate or ambiguous way without specific separate addresses (e.g. "112th and 114th streets"), SKIP the ambiguous aggregate result.
   - The valid result with a single specific physical address (e.g. Book Culture at 536 West 112th Street) should remain.

7. REQUIRE PLACES TO BE PHYSICAL PLACES (MANDATORY):
   - 'discovery_type = "place"' MUST represent a physical location that a Ramble user can actually visit in person (e.g. storefront bookstore, cafe, bakery, physical gallery, museum, physical venue).
   - A club, organization, online community, or group without a supported physical location must NOT be returned as a place.
   - For example: "Books that Bind" is a book club. If the source does not provide a specific physical location that the user can visit, do NOT return it as a place.
   - Do NOT invent a physical location from the organization's general area or affiliated university.
   - If a club holds a specific scheduled gathering at a physical venue, it may be extracted as an 'event' ONLY if the date, time, and specific physical venue are supported by the source. Otherwise, OMIT IT.

8. EVIDENCE-BASED LOCATION ONLY (NEVER INVENT):
   - Only set 'neighborhood' if the source text explicitly supports it. Do NOT blindly copy the requested neighborhood.
   - Only set 'address' if explicitly stated in the source text (street name or cross streets).
   - Only set 'borough' (Manhattan, Brooklyn, Queens, Bronx, Staten Island) if supported.
   - Leave 'latitude' and 'longitude' as null unless the source explicitly specifies coordinates. NEVER infer or invent coordinates.
   - If address, neighborhood, or borough are unknown, use null.

9. PLACE VS. EVENT CONSISTENCY (CRITICAL):
   - A PLACE represents a persistent physical location (e.g. bookstore, cafe, jazz club, church, theatre, library).
     For a PLACE: 'start_time' and 'end_time' MUST BE NULL. NEVER attach an event's schedule or performance time to a place object.
   - An EVENT represents a specific scheduled activity or performance (e.g. "Bach Virtuosi Concert", "Poetry Reading", "Jazz Performance").
     Only an EVENT may have a 'start_time' and 'end_time'.
   - Do NOT mix a venue and a performance into one discovery.
     * If extracting the venue (e.g. "Smoke Jazz & Supper Club"): discovery_type = "place", start_time = null, end_time = null.
     * If extracting a specific performance (e.g. "Walter Smith III Quintet"): discovery_type = "event", and start_time = supported event time.

10. SOURCE ATTRIBUTION:
   - 'source_url' MUST exactly match the URL of one of the provided source documents. NEVER generate an arbitrary URL.

11. EMPTY RESULTS:
   - If the provided sources do NOT contain enough reliable evidence to identify an actual individual place or event physically located in the requested area, return an empty discoveries array: {"discoveries": []}. Never hallucinate or invent recommendations.`;

export const GEMINI_DISCOVERY_SCHEMA = {
  type: "object",
  properties: {
    discoveries: {
      type: "array",
      description: "List of valid individual places or specific events found in the sources",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Official name of the specific place or event. Must NOT be an article title.",
          },
          discovery_type: {
            type: "string",
            enum: ["place", "event"],
            description: "Whether this is an ongoing physical place or a specific scheduled event.",
          },
          categories: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "food",
                "art",
                "books",
                "gaming",
                "culture",
                "volunteering",
                "history",
                "coffee",
                "sustainability",
                "music",
                "technology",
              ],
            },
            description: "Ramble categories that describe this place or event.",
          },
          description: {
            type: "string",
            nullable: true,
            description: "Concise 1-2 sentence description based only on the source text, or null.",
          },
          address: {
            type: "string",
            nullable: true,
            description: "Street address or cross streets if explicitly mentioned, otherwise null.",
          },
          neighborhood: {
            type: "string",
            nullable: true,
            description: "NYC neighborhood if explicitly supported by the source, otherwise null.",
          },
          borough: {
            type: "string",
            nullable: true,
            description: "NYC borough (Manhattan, Brooklyn, Queens, Bronx, Staten Island) if supported, otherwise null.",
          },
          latitude: {
            type: "number",
            nullable: true,
            description: "Explicit coordinate latitude if provided, otherwise null. NEVER infer.",
          },
          longitude: {
            type: "number",
            nullable: true,
            description: "Explicit coordinate longitude if provided, otherwise null. NEVER infer.",
          },
          start_time: {
            type: "string",
            nullable: true,
            description: "ISO 8601 timestamp for scheduled events if reliably known, otherwise null.",
          },
          end_time: {
            type: "string",
            nullable: true,
            description: "ISO 8601 timestamp for scheduled events if reliably known, otherwise null.",
          },
          source_url: {
            type: "string",
            description: "Exact URL of the source document where this place or event was found.",
          },
        },
        required: [
          "name",
          "discovery_type",
          "categories",
          "description",
          "address",
          "neighborhood",
          "borough",
          "latitude",
          "longitude",
          "start_time",
          "end_time",
          "source_url",
        ],
      },
    },
  },
  required: ["discoveries"],
} as const;

export async function extractDiscoveriesWithGemini(
  apiKey: string,
  sources: SourceDocument[],
  requestedNeighborhood: string,
  model: string = DEFAULT_GEMINI_MODEL,
  fetchFn: typeof fetch = fetch
): Promise<RawExtractedDiscovery[]> {
  if (sources.length === 0) {
    return [];
  }

  const sourcesPrompt = sources
    .map(
      (s, idx) =>
        `[Source ${idx + 1}]
ID: ${s.source_id}
Search Topic Context: ${s.category} (Note: verify entity independently belongs to this category; do NOT assume)
URL: ${s.url}
Title: ${s.title}
Content: ${s.snippet}`
    )
    .join("\n\n---\n\n");

  const requestedCategories = Array.from(new Set(sources.map((s) => s.category)));

  const userPrompt = `Requested NYC Neighborhood: "${requestedNeighborhood}"
Requested Categories: ${requestedCategories.join(", ")}

CRITICAL REQUIREMENTS:
1. REQUIRE POSITIVE GEOGRAPHIC EVIDENCE:
   - Every extracted place or event MUST have clear, positive evidence in the source text showing it is physically located in or immediately adjacent to "${requestedNeighborhood}".
   - Do NOT accept an entity merely because Tavily returned it for the query, because it is somewhere in Manhattan, or because the webpage discusses the requested neighborhood.
   - If an entity/event has no neighborhood and no address (or only borough = "Manhattan"), DO NOT EXTRACT IT.
   - Do NOT invent an address or neighborhood to make an entity pass.
   - If the source does not establish geographic relevance to "${requestedNeighborhood}", OMIT IT.

2. REQUIRE ENTITY-LEVEL CATEGORY RELEVANCE:
   - Every extracted discovery must independently and genuinely belong to at least one of the requested categories: ${requestedCategories.join(", ")}.
   - Do NOT assume an entity belongs to a category (e.g. "music") simply because the source was retrieved for that category.
   - For example: "The Garden People: 45 Years in Bloom" is a community garden celebration, NOT a music discovery. Do NOT extract it as music unless the source specifically establishes a live musical performance.
   - If the entity itself is not factually relevant to the requested categories based on its primary function or described activity, DO NOT EXTRACT IT.

3. DO NOT CREATE AGGREGATE PLACE RECORDS:
   - Do NOT return a place when the extracted address describes multiple locations (e.g. "112th and 114th streets", "locations on Broadway and Amsterdam", "multiple locations").
   - If a source describes multiple locations (e.g. Book Culture having branches on 112th St and Broadway), extract them separately ONLY when the source provides enough information to identify each individual location with its own specific physical address (e.g. "536 West 112th Street").
   - If the source only describes multiple locations in an aggregate or ambiguous way without specific separate addresses, SKIP the ambiguous aggregate result.

4. REQUIRE PLACES TO BE PHYSICAL PLACES:
   - 'discovery_type = "place"' MUST represent a physical location that a Ramble user can actually visit in person (e.g. storefront bookstore, cafe, venue).
   - A club, organization, online community, or group without a supported physical location (e.g. "Books that Bind" book club) MUST NOT be returned as a place.
   - Do NOT invent a physical location from an organization's general area or affiliated institution.

5. PLACE VS EVENT CONSISTENCY:
   - For persistent places, 'start_time' and 'end_time' MUST BE NULL.
   - Only specific scheduled events may have 'start_time' or 'end_time'.

Here are the search sources to analyze:

${sourcesPrompt}

Extract all valid individual places or specific events according to your instructions.`;

  const url = `${GEMINI_BASE_URL}/${model}:generateContent`;

  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: EXTRACTION_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: GEMINI_DISCOVERY_SCHEMA,
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API failed (${response.status}): ${errorText}`);
  }

  const jsonResponse = await response.json();
  const text = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed.discoveries) ? parsed.discoveries : [];
  } catch {
    return [];
  }
}

// ==================================================
// 6. SERVER-SIDE VALIDATION & FILTERING HELPER
// ==================================================

const JUNK_PATTERNS = [
  /^\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(best|top|must|great|underrated|favorite|coolest|essential|hidden|cozy|places|spots|coffee|bookstores|cafes)/i,
  /^\s*(the\s+)?(best|top|favorite|underrated|must[- ]visit|greatest)\s+/i,
  /\b(guide to|roundup of|best of|things to do|places to eat|places to visit|where to drink|where to go|where to find|buzz on|perk up)\b/i,
  /\b(best|top|favorite|underrated)\s+[a-z\s&'-]{2,60}\s+in\s+(nyc|new york|manhattan|brooklyn|queens|bronx|morningside|harlem)\b/i,
  /\b(upcoming events|events calendar|calendar of events|directory of|events happening in|events near)\b/i,
  /\b(apartment|apartments|condo|condos|residential|movers|moving company|storage|realty|real estate|leasing office|spider-man)\b/i,
];

export function isAggregateAddress(address: string | null | undefined): boolean {
  if (!address || typeof address !== "string") return false;
  const clean = address.trim();

  // Explicit multi-location words
  if (/\b(multiple|various|several|both|all)\s+(locations|branches|stores|sites|spots)\b/i.test(clean)) {
    return true;
  }
  if (/\b(locations|branches|stores)\s+(?:on|at|in)\b/i.test(clean)) {
    return true;
  }

  // Plural streets indicating multiple distinct streets/sites, e.g. "112th and 114th streets", "112th & 114th sts"
  if (/\b\d+(?:st|nd|rd|th)?\s*(?:and|&|\/)\s*\d+(?:st|nd|rd|th)?\s*(?:streets|sts)\b/i.test(clean)) {
    return true;
  }

  // Joining two distinct full street addresses (e.g. "536 W 112th St and 2915 Broadway" or "536 W 112th St & 2915 Broadway")
  if (/\b\d+\s+[a-z0-9\s.,-]+(?:street|st|avenue|ave|broadway|road|rd)\s*(?:and|&|;)\s*\d+\s+[a-z0-9\s.,-]+/i.test(clean)) {
    return true;
  }

  // Two parallel numbered streets joined by and/& without an avenue or "between", e.g. "112th and 114th" or "112th St and 114th St"
  const parallelStreetMatch = clean.match(
    /\b(\d+)(?:st|nd|rd|th)?\s*(?:street|st)?\s*(?:and|&)\s*(\d+)(?:st|nd|rd|th)?\s*(?:streets?|sts?)?(?:\s|$|,|\.)/i
  );
  if (parallelStreetMatch) {
    const num1 = parseInt(parallelStreetMatch[1], 10);
    const num2 = parseInt(parallelStreetMatch[2], 10);
    const afterMatch = clean.slice((parallelStreetMatch.index ?? 0) + parallelStreetMatch[0].length);
    const isAvenueOrRoad = /^\s*(?:ave|avenue|road|rd|blvd|broadway|place|pl|lane|ln)\b/i.test(afterMatch);

    if (num1 !== num2 && !isAvenueOrRoad && !/\b(between|b\/w)\b/i.test(clean)) {
      return true;
    }
  }

  return false;
}

export function isEntityRelevantToCategory(
  category: Category,
  name: string,
  description: string | null
): boolean {
  const text = `${name} ${description ?? ""}`.toLowerCase();
  switch (category) {
    case "music": {
      // Reject blatant false positives: gardens, botany, blooms with zero musical mentions
      const isGardenOrBotany = /\b(garden|gardening|bloom|blooms|horticulture|planting)\b/i.test(text);
      const hasMusicTerm = /\b(music|musical|musician|concert|jazz|band|symphony|performance|perform|sing|singer|choir|song|orchestra|acoustic|opera|piano|recital|sound|dj|live|theatre|theater|stage|hall|auditorium|venue|quintet|quartet|trio|ensemble|gig|jam|composer)\b/i.test(text);
      if (isGardenOrBotany && !hasMusicTerm) {
        return false;
      }
      return true;
    }
    default:
      return true;
  }
}

export function validateExtractedDiscovery(
  raw: RawExtractedDiscovery,
  validSourceUrls: Set<string>,
  requestedNeighborhood: string,
  requestedCategories?: Category[]
): Discovery | null {
  if (!raw || typeof raw !== "object") return null;

  // 1. Validate Name
  if (typeof raw.name !== "string") return null;
  const name = raw.name.trim();
  if (name.length < 2 || name.length > 70) return null;
  if (JUNK_PATTERNS.some((p) => p.test(name))) return null;

  // 2. Validate discovery_type
  if (raw.discovery_type !== "place" && raw.discovery_type !== "event") {
    return null;
  }

  // 3. Validate Categories
  if (!Array.isArray(raw.categories) || raw.categories.length === 0) {
    return null;
  }
  const validCategories = raw.categories.filter((cat): cat is Category =>
    typeof cat === "string" && isCategory(cat)
  );
  if (validCategories.length === 0) return null;

  // If requestedCategories is provided, ensure discovery matches at least one requested category
  if (requestedCategories && requestedCategories.length > 0) {
    const hasRequested = validCategories.some((cat) => requestedCategories.includes(cat));
    if (!hasRequested) return null;
  }

  // Entity-level category relevance check (e.g. community garden celebration tagged as music)
  for (const cat of validCategories) {
    if (!isEntityRelevantToCategory(cat, name, raw.description)) {
      return null;
    }
  }

  // 4. Validate Source URL Attribution (must match a supplied Tavily source)
  if (typeof raw.source_url !== "string" || !validSourceUrls.has(raw.source_url.trim())) {
    return null;
  }
  const sourceUrl = raw.source_url.trim();

  // 5. Geographic Consistency & Positive Evidence Check
  const hasSpecificNeighborhood =
    requestedNeighborhood &&
    requestedNeighborhood.trim() &&
    requestedNeighborhood.trim().toLowerCase() !== "new york city" &&
    requestedNeighborhood.trim().toLowerCase() !== "nyc";

  if (hasSpecificNeighborhood) {
    // Require positive geographic evidence:
    // If an entity has no neighborhood and no address (or only borough = "Manhattan"),
    // it lacks positive geographic evidence for the requested neighborhood.
    const normalizedRawNeighborhood = raw.neighborhood ? raw.neighborhood.trim().toLowerCase() : "";
    const isGenericOrMissingHood =
      !normalizedRawNeighborhood ||
      normalizedRawNeighborhood === "manhattan" ||
      normalizedRawNeighborhood === "new york" ||
      normalizedRawNeighborhood === "nyc" ||
      normalizedRawNeighborhood === "new york city";

    if (isGenericOrMissingHood && (!raw.address || !raw.address.trim())) {
      // Neither neighborhood nor address is provided (or neighborhood is just generic "Manhattan").
      // A borough of "Manhattan" alone is insufficient evidence for a specific neighborhood.
      return null;
    }

    const targetMeta = NYC_NEIGHBORHOODS[requestedNeighborhood.trim()];
    if (targetMeta) {
      // If extracted borough explicitly conflicts with target borough
      if (
        raw.borough &&
        typeof raw.borough === "string" &&
        raw.borough.trim().toLowerCase() !== targetMeta.borough.toLowerCase()
      ) {
        return null;
      }

      // If extracted neighborhood explicitly conflicts with target neighborhood
      if (
        raw.neighborhood &&
        typeof raw.neighborhood === "string" &&
        raw.neighborhood.trim().toLowerCase() !== requestedNeighborhood.trim().toLowerCase()
      ) {
        const otherMeta = NYC_NEIGHBORHOODS[raw.neighborhood.trim()];
        if (otherMeta) {
          // Confirmed conflicting known NYC neighborhood
          return null;
        }
      }

      // Disqualify known out-of-neighborhood landmarks and districts (e.g. Bryant Park, Midtown, Times Square)
      const disqualifiers = OUT_OF_HOOD_DISQUALIFIERS[requestedNeighborhood.trim()];
      if (disqualifiers) {
        const fullContext = `${name} ${raw.description ?? ""} ${raw.address ?? ""} ${raw.neighborhood ?? ""}`.toLowerCase();
        const matchesDisqualifier = disqualifiers.some((disq) => {
          const regex = new RegExp(`(^|[^a-z0-9])${disq.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i");
          return regex.test(fullContext);
        });
        if (matchesDisqualifier) {
          return null;
        }
      }
    }
  }

  // 6. Aggregate Address Check (Reject aggregate place records like "112th and 114th streets")
  if (raw.address && isAggregateAddress(raw.address)) {
    return null;
  }

  // 7. Physical Place Requirement:
  // discovery_type = "place" MUST represent a physical venue a user can actually visit.
  // A club, organization, online community, or group without a physical location cannot be a place.
  if (raw.discovery_type === "place") {
    if (!raw.address || !raw.address.trim()) {
      return null;
    }
    // Reject non-physical club/group patterns
    if (/\b(book\s*club|reading\s*group|discussion\s*group|online\s*community|meetup\s*group|virtual\s*community)\b/i.test(name)) {
      return null;
    }
    if (
      raw.description &&
      /\b(is a|a local|a student)\s+(book\s*club|reading\s*group|discussion\s*group|online\s*community)\b/i.test(raw.description)
    ) {
      return null;
    }
  }

  // 8. Coordinates Validation
  const latitude =
    typeof raw.latitude === "number" &&
    !isNaN(raw.latitude) &&
    raw.latitude >= -90 &&
    raw.latitude <= 90
      ? raw.latitude
      : null;

  const longitude =
    typeof raw.longitude === "number" &&
    !isNaN(raw.longitude) &&
    raw.longitude >= -180 &&
    raw.longitude <= 180
      ? raw.longitude
      : null;

  // 9. Text Cleanliness & Place vs Event Rule Enforcement
  const description =
    typeof raw.description === "string" && raw.description.trim()
      ? raw.description.trim().slice(0, 350)
      : null;
  const address =
    typeof raw.address === "string" && raw.address.trim()
      ? raw.address.trim()
      : null;
  const neighborhood =
    typeof raw.neighborhood === "string" && raw.neighborhood.trim()
      ? raw.neighborhood.trim()
      : null;
  const borough =
    typeof raw.borough === "string" && raw.borough.trim()
      ? raw.borough.trim()
      : null;

  let start_time =
    typeof raw.start_time === "string" && raw.start_time.trim()
      ? raw.start_time.trim()
      : null;
  let end_time =
    typeof raw.end_time === "string" && raw.end_time.trim()
      ? raw.end_time.trim()
      : null;

  // Place vs Event consistency:
  // A place represents a persistent physical location. Its start_time and end_time MUST be null.
  if (raw.discovery_type === "place") {
    start_time = null;
    end_time = null;
  }

  return {
    name,
    discovery_type: raw.discovery_type,
    categories: validCategories,
    description,
    address,
    neighborhood,
    borough,
    latitude,
    longitude,
    start_time,
    end_time,
    source: "Live Discovery",
    source_url: sourceUrl,
    verified: false,
  };
}

// ==================================================
// 7. DEDUPLICATION & MERGING HELPERS
// ==================================================

export function normalizeName(name: string): string {
  if (!name) return "";
  let clean = name.toLowerCase().trim();

  // Normalize conjunctions & symbols
  clean = clean.replace(/&/g, " and ");
  clean = clean.replace(/['’"“”`]/g, "");

  // Remove leading "the "
  clean = clean.replace(/^the\s+/, "");

  // Replace punctuation and special characters with spaces
  clean = clean.replace(/[^a-z0-9\s]/g, " ");

  // Collapse repeated whitespace
  clean = clean.replace(/\s+/g, " ").trim();

  return clean;
}

export function namesMatch(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;

  // Check if one is an exact prefix/suffix with a generic descriptor
  const genericDescriptors = [
    "cafe", "coffee", "roasters", "espresso", "bakery", "restaurant",
    "bookstore", "booksellers", "books", "bar", "theatre", "theater",
    "company", "co", "nyc", "shop", "lounge", "kitchen", "market",
  ];

  const [shorter, longer] = n1.length < n2.length ? [n1, n2] : [n2, n1];
  if (longer.startsWith(shorter)) {
    const remainder = longer.slice(shorter.length).trim();
    if (genericDescriptors.includes(remainder)) {
      return true;
    }
  }

  return false;
}

export function cleanAddressText(address: string): string {
  let clean = address.toLowerCase().trim();

  // Normalize conjunctions
  clean = clean.replace(/&/g, " and ");
  clean = clean.replace(/['’"“”`]/g, "");

  // Strip noise phrases (e.g. "corner of", "at the corner of", "located at")
  clean = clean.replace(/\b(at the corner of|on the corner of|corner of|intersection of|located at|located on|located in|cross streets?:?)\b/gi, " ");
  clean = clean.replace(/\b(near|between|off of|around)\b/gi, " ");
  clean = clean.replace(/\b(suite|ste|apt|apartment|fl|floor|unit)\s*[a-z0-9-]+\b/gi, " ");

  // Strip borough/city/state/zip suffixes
  clean = clean.replace(/,\s*(new york|ny|nyc|manhattan|brooklyn|queens|bronx|staten island)\b.*$/gi, "");
  clean = clean.replace(/\b100\d{2}\b/g, "");

  // Normalize common street abbreviations
  clean = clean.replace(/\b(streets?)\b/gi, "st");
  clean = clean.replace(/\b(avenues?|av)\b/gi, "ave");
  clean = clean.replace(/\b(boulevards?)\b/gi, "blvd");
  clean = clean.replace(/\b(places?)\b/gi, "pl");
  clean = clean.replace(/\b(roads?)\b/gi, "rd");
  clean = clean.replace(/\b(drives?)\b/gi, "dr");
  clean = clean.replace(/\b(lanes?)\b/gi, "ln");
  clean = clean.replace(/\b(ways?)\b/gi, "way");

  // Normalize directionals
  clean = clean.replace(/\b(west)\b/gi, "w");
  clean = clean.replace(/\b(east)\b/gi, "e");
  clean = clean.replace(/\b(north)\b/gi, "n");
  clean = clean.replace(/\b(south)\b/gi, "s");

  // Remove punctuation, collapse whitespace
  clean = clean.replace(/[^a-z0-9\s]/g, " ");
  clean = clean.replace(/\s+/g, " ").trim();

  return clean;
}

export interface ParsedAddress {
  raw: string;
  cleaned: string;
  buildingNumber: string | null;
  streetNumber: string | null; // e.g. "112" from "112th" or "112"
  mainStreet: string | null;   // e.g. "broadway", "amsterdam ave", "w 112th st"
  isCrossStreet: boolean;
  crossStreets: string[];      // e.g. ["111th", "amsterdam"]
}

export function parseAddress(address?: string | null): ParsedAddress | null {
  if (!address || typeof address !== "string" || !address.trim()) {
    return null;
  }

  const raw = address.trim();
  const cleaned = cleanAddressText(raw);
  if (!cleaned) return null;

  // Check for cross streets: e.g. "111th and amsterdam", "amsterdam at 111th st", "broadway / 114th"
  const crossMatch = cleaned.match(/^(.+?)\s+(?:and|at|\/)\s+(.+)$/);
  if (crossMatch && !/^\d{1,5}\s+/.test(crossMatch[1])) {
    const s1 = crossMatch[1].trim();
    const s2 = crossMatch[2].trim();
    const crossStreets = [s1, s2].sort();

    const numMatch = cleaned.match(/\b(\d{1,3})(?:st|nd|rd|th)?\b/);
    const streetNumber = numMatch ? numMatch[1] : null;

    return {
      raw,
      cleaned,
      buildingNumber: null,
      streetNumber,
      mainStreet: null,
      isCrossStreet: true,
      crossStreets,
    };
  }

  // Check for building number at start: e.g. "536 w 112th st", "2915 broadway"
  const bldgMatch = cleaned.match(/^(\d{1,5})\s+(.+)$/);
  if (bldgMatch) {
    const buildingNumber = bldgMatch[1];
    const mainStreet = bldgMatch[2].trim();

    const numMatch = mainStreet.match(/\b(\d{1,3})(?:st|nd|rd|th)?\b/);
    const streetNumber = numMatch ? numMatch[1] : null;

    return {
      raw,
      cleaned,
      buildingNumber,
      streetNumber,
      mainStreet,
      isCrossStreet: false,
      crossStreets: [],
    };
  }

  // General street or neighborhood phrase without building number
  const numMatch = cleaned.match(/\b(\d{1,3})(?:st|nd|rd|th)?\b/);
  const streetNumber = numMatch ? numMatch[1] : null;

  return {
    raw,
    cleaned,
    buildingNumber: null,
    streetNumber,
    mainStreet: cleaned,
    isCrossStreet: false,
    crossStreets: [],
  };
}

export function areAddressesClearlyDifferent(p1: ParsedAddress, p2: ParsedAddress): boolean {
  // 1. Both have building numbers, and they differ (e.g. 2915 vs 536)
  if (p1.buildingNumber && p2.buildingNumber && p1.buildingNumber !== p2.buildingNumber) {
    return true;
  }

  // 2. Both have numbered streets, and they differ (e.g. 111th vs 122nd, or 112th vs 116th)
  if (p1.streetNumber && p2.streetNumber && p1.streetNumber !== p2.streetNumber) {
    return true;
  }

  // 3. Both have main streets with building numbers, and main streets differ (e.g. "2915 broadway" vs "2915 amsterdam")
  if (p1.buildingNumber && p2.buildingNumber && p1.mainStreet && p2.mainStreet) {
    const s1 = p1.mainStreet.replace(/\s+/g, "");
    const s2 = p2.mainStreet.replace(/\s+/g, "");
    if (!s1.includes(s2) && !s2.includes(s1)) {
      return true;
    }
  }

  // 4. Both are cross streets, but have conflicting avenues/streets (e.g. broadway vs amsterdam)
  if (p1.isCrossStreet && p2.isCrossStreet) {
    const avenues = [
      "broadway", "amsterdam", "columbus", "claremont", "riverside",
      "lenox", "lexington", "madison", "park", "fifth", "manhattan ave"
    ];
    const ave1 = avenues.find((a) => p1.cleaned.includes(a));
    const ave2 = avenues.find((a) => p2.cleaned.includes(a));
    if (ave1 && ave2 && ave1 !== ave2) {
      return true;
    }
  }

  return false;
}

export function areAddressesSameLocation(p1: ParsedAddress, p2: ParsedAddress): boolean {
  if (areAddressesClearlyDifferent(p1, p2)) {
    return false;
  }

  // 1. Exact cleaned match (e.g. "111th and amsterdam" === "111th and amsterdam")
  if (p1.cleaned === p2.cleaned) {
    return true;
  }

  // 2. One is a substring of the other
  if (p1.cleaned.includes(p2.cleaned) || p2.cleaned.includes(p1.cleaned)) {
    return true;
  }

  // 3. Matching building number and street (e.g. "536 w 112th st" & "536 west 112th street")
  if (p1.buildingNumber && p2.buildingNumber && p1.buildingNumber === p2.buildingNumber) {
    if (p1.mainStreet && p2.mainStreet) {
      const s1 = p1.mainStreet.replace(/\s+/g, "");
      const s2 = p2.mainStreet.replace(/\s+/g, "");
      if (s1.includes(s2) || s2.includes(s1)) {
        return true;
      }
    }
  }

  // 4. Cross streets match regardless of order (e.g. "111th and amsterdam" vs "amsterdam and 111th st")
  if (p1.isCrossStreet && p2.isCrossStreet) {
    const tokens1 = p1.crossStreets.map((s) => s.replace(/\b(st|ave)\b/g, "").trim());
    const tokens2 = p2.crossStreets.map((s) => s.replace(/\b(st|ave)\b/g, "").trim());
    if (
      (tokens1[0].includes(tokens2[0]) || tokens2[0].includes(tokens1[0])) &&
      (tokens1[1].includes(tokens2[1]) || tokens2[1].includes(tokens1[1]))
    ) {
      return true;
    }
  }

  // 5. Cross-street vs Building Number with intersection note (e.g. "111th and amsterdam" vs "1030 amsterdam ave at 111th st")
  if (p1.streetNumber && p2.streetNumber && p1.streetNumber === p2.streetNumber) {
    const hasSharedAvenue = [
      "broadway", "amsterdam", "columbus", "claremont", "riverside", "lenox", "madison", "park"
    ].some((ave) => p1.cleaned.includes(ave) && p2.cleaned.includes(ave));
    if (hasSharedAvenue) {
      return true;
    }
  }

  return false;
}

export function mergeDiscoveries(existing: Discovery, incoming: Discovery): Discovery {
  // 1. Merge categories
  const categories = Array.from(
    new Set([...existing.categories, ...incoming.categories])
  ) as Category[];

  // 2. Select more complete / informative address
  let address = existing.address;
  if (!address) {
    address = incoming.address;
  } else if (incoming.address) {
    const pExist = parseAddress(existing.address);
    const pIn = parseAddress(incoming.address);
    if (!pExist?.buildingNumber && pIn?.buildingNumber) {
      address = incoming.address;
    } else if (incoming.address.length > existing.address.length) {
      address = incoming.address;
    }
  }

  // 3. Select richest description
  let description = existing.description;
  if (!description) {
    description = incoming.description;
  } else if (incoming.description && incoming.description.length > description.length) {
    description = incoming.description;
  }

  // 4. Neighborhood & Borough: prefer non-null
  const neighborhood = existing.neighborhood ?? incoming.neighborhood;
  const borough = existing.borough ?? incoming.borough;

  // 5. Coordinates: prefer non-null
  const latitude = existing.latitude ?? incoming.latitude;
  const longitude = existing.longitude ?? incoming.longitude;

  // 6. Event times: prefer non-null, but force null if discovery_type is place
  let start_time = existing.start_time ?? incoming.start_time;
  let end_time = existing.end_time ?? incoming.end_time;
  if (existing.discovery_type === "place") {
    start_time = null;
    end_time = null;
  }

  // 7. Source URL: preserve existing source URL unless incoming is clearly an authoritative domain (.edu, .gov, .org)
  let source_url = existing.source_url;
  try {
    const existingHost = new URL(existing.source_url).hostname.toLowerCase();
    const incomingHost = new URL(incoming.source_url).hostname.toLowerCase();
    const isPreferredDomain = (host: string) =>
      host.endsWith(".edu") || host.endsWith(".gov") || host.endsWith(".org");
    if (!isPreferredDomain(existingHost) && isPreferredDomain(incomingHost)) {
      source_url = incoming.source_url;
    }
  } catch {
    // Keep existing.source_url
  }

  return {
    ...existing,
    categories,
    address,
    description,
    neighborhood,
    borough,
    latitude,
    longitude,
    start_time,
    end_time,
    source_url,
  };
}

export function deduplicateDiscoveries(discoveries: Discovery[]): Discovery[] {
  const result: Discovery[] = [];

  for (const discovery of discoveries) {
    let matchedIndex = -1;

    for (let i = 0; i < result.length; i++) {
      const existing = result[i];

      // Step 1: Names must match
      if (!namesMatch(existing.name, discovery.name)) {
        continue;
      }

      // Step 2: Names match. Evaluate addresses.
      const pExisting = parseAddress(existing.address);
      const pIncoming = parseAddress(discovery.address);

      if (pExisting && pIncoming) {
        // Both have addresses
        if (areAddressesClearlyDifferent(pExisting, pIncoming)) {
          // Different physical locations of the same business (e.g. Book Culture 2915 Broadway vs 536 W 112th St)
          continue;
        }

        if (areAddressesSameLocation(pExisting, pIncoming)) {
          matchedIndex = i;
          break;
        }
      } else {
        // One or both lack an address
        if (
          existing.borough &&
          discovery.borough &&
          existing.borough.toLowerCase() !== discovery.borough.toLowerCase()
        ) {
          continue;
        }
        if (
          existing.neighborhood &&
          discovery.neighborhood &&
          existing.neighborhood.toLowerCase() !== discovery.neighborhood.toLowerCase()
        ) {
          continue;
        }

        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex >= 0) {
      result[matchedIndex] = mergeDiscoveries(result[matchedIndex], discovery);
    } else {
      result.push({ ...discovery });
    }
  }

  return result;
}

// ==================================================
// 8. EVENT EXPIRATION & NYC TIMEZONE HANDLING
// ==================================================

export function getNycOffsetString(year: number, month: number, day: number): string {
  try {
    const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(utcDate);
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value;
    if (tzPart) {
      const match = tzPart.match(/GMT([+-]\d+)/);
      if (match) {
        const offsetHours = parseInt(match[1], 10);
        const sign = offsetHours >= 0 ? "+" : "-";
        const absHours = Math.abs(offsetHours).toString().padStart(2, "0");
        return `${sign}${absHours}:00`;
      }
    }
  } catch {
    // Fallback if Intl is unavailable or fails
  }

  // NYC Daylight Saving Time rules fallback:
  // Starts 2nd Sunday in March, ends 1st Sunday in November
  if (month > 3 && month < 11) return "-04:00"; // EDT
  if (month === 3 && day >= 14) return "-04:00";
  if (month === 11 && day <= 7) return "-04:00";
  return "-05:00"; // EST
}

export function parseNycTimestamp(dateStr: string, isEndOfDay: boolean = false): number | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Case 1: Already has explicit timezone offset (e.g. Z, +00:00, -04:00, -05:00)
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    const ms = Date.parse(trimmed);
    return isNaN(ms) ? null : ms;
  }

  // Case 2: Date-only format (e.g. "2026-09-27")
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = parseInt(dateOnlyMatch[1], 10);
    const month = parseInt(dateOnlyMatch[2], 10);
    const day = parseInt(dateOnlyMatch[3], 10);
    const offset = getNycOffsetString(year, month, day);
    const timePart = isEndOfDay ? "23:59:59" : "00:00:00";
    const isoString = `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}T${timePart}${offset}`;
    const ms = Date.parse(isoString);
    return isNaN(ms) ? null : ms;
  }

  // Case 3: Date and time without timezone offset (e.g. "2026-09-27T19:00:00" or "2026-09-27 19:00")
  const dateTimeMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (dateTimeMatch) {
    const year = parseInt(dateTimeMatch[1], 10);
    const month = parseInt(dateTimeMatch[2], 10);
    const day = parseInt(dateTimeMatch[3], 10);
    const offset = getNycOffsetString(year, month, day);
    const seconds = dateTimeMatch[6] ? dateTimeMatch[6] : "00";
    const isoString = `${dateTimeMatch[1]}-${dateTimeMatch[2]}-${dateTimeMatch[3]}T${dateTimeMatch[4]}:${dateTimeMatch[5]}:${seconds}${offset}`;
    const ms = Date.parse(isoString);
    return isNaN(ms) ? null : ms;
  }

  // Standard fallback
  const ms = Date.parse(trimmed);
  return isNaN(ms) ? null : ms;
}

export function isEventExpired(discovery: Discovery, nowMs: number = Date.now()): boolean {
  if (discovery.discovery_type !== "event") {
    return false; // Persistent places never expire
  }

  // 1. If end_time is provided and has already passed
  if (discovery.end_time) {
    const endMs = parseNycTimestamp(discovery.end_time, true);
    if (endMs !== null) {
      return endMs < nowMs;
    }
  }

  // 2. If end_time is null but start_time exists:
  // Conservative rule: assume the event lasts 4 hours after start_time.
  // If (start_time + 4 hours) is in the past, it has concluded.
  if (discovery.start_time) {
    const startMs = parseNycTimestamp(discovery.start_time, false);
    if (startMs !== null) {
      const CONSERVATIVE_DURATION_MS = 4 * 60 * 60 * 1000;
      return startMs + CONSERVATIVE_DURATION_MS < nowMs;
    }
  }

  return false;
}

// ==================================================
// 9. MAIN REQUEST HANDLER
// ==================================================

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const tavilyApiKey = getApiKey("TAVILY_API_KEY");
    if (!tavilyApiKey) {
      throw new Error("TAVILY_API_KEY is not configured in environment");
    }

    const geminiApiKey = getApiKey("GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured in environment");
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Request body must be valid JSON" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const validation = validateRequest(rawBody);
    if (!validation.isValid || !validation.data) {
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { neighborhood, categories } = validation.data;

    // STEP 1: Concurrently search Tavily for requested categories with Promise.allSettled
    const searchSettled = await Promise.allSettled(
      categories.map(async (category) => {
        const query = buildSearchQuery(category, neighborhood);
        console.log(`Tavily search [${category}]: ${query}`);
        const results = await searchTavily(tavilyApiKey, query);
        return { category, query, results };
      })
    );

    const successfulSearches: Array<{
      category: Category;
      query: string;
      results: TavilyResult[];
    }> = [];

    const searchDiagnostics: Array<{
      category: Category;
      query: string;
      results_found: number;
      error?: string;
    }> = [];

    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const outcome = searchSettled[i];
      if (outcome.status === "fulfilled") {
        successfulSearches.push(outcome.value);
        searchDiagnostics.push({
          category,
          query: outcome.value.query,
          results_found: outcome.value.results.length,
        });
      } else {
        console.error(`Tavily search failed for ${category}:`, outcome.reason);
        searchDiagnostics.push({
          category,
          query: buildSearchQuery(category, neighborhood),
          results_found: 0,
          error: "Search failed for category",
        });
      }
    }

    // STEP 2: Prepare and batch source documents for extraction
    const sources = prepareSourcesForExtraction(successfulSearches, neighborhood);
    const validSourceUrls = new Set(sources.map((s) => s.url));

    // STEP 3: LLM Structured Extraction via Google Gemini (1 batched call)
    let rawDiscoveries: RawExtractedDiscovery[] = [];
    if (sources.length > 0) {
      try {
        rawDiscoveries = await extractDiscoveriesWithGemini(
          geminiApiKey,
          sources,
          neighborhood
        );
      } catch (aiError) {
        console.error("Gemini extraction failed:", aiError);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to extract discoveries from web sources",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // STEP 4: Server-Side Validation & Filtering
    const validatedDiscoveries: Discovery[] = [];
    for (const raw of rawDiscoveries) {
      const valid = validateExtractedDiscovery(raw, validSourceUrls, neighborhood, categories);
      if (valid) {
        validatedDiscoveries.push(valid);
      }
    }

    // STEP 5: Deduplication & Category Merging
    const uniqueDiscoveries = deduplicateDiscoveries(validatedDiscoveries);

    // STEP 6: Remove Expired Events (using current NYC time)
    const activeDiscoveries = uniqueDiscoveries.filter((d) => !isEventExpired(d));

    // STEP 7: Return standard response
    return new Response(
      JSON.stringify(
        {
          success: true,
          neighborhood,
          categories,
          searches: searchDiagnostics,
          count: activeDiscoveries.length,
          discoveries: activeDiscoveries,
        },
        null,
        2
      ),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("live-discovery request failed:", error);
    // Sanitize error message to ensure no secrets or auth tokens are leaked
    const safeMessage =
      error instanceof Error && !error.message.includes("key") && !error.message.includes("Bearer")
        ? error.message
        : "An unexpected error occurred during live discovery";

    return new Response(
      JSON.stringify({
        success: false,
        error: safeMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

// In Supabase / Deno runtime, start the server
// @ts-ignore Deno global is provided at runtime in Supabase Edge Functions
if (typeof Deno !== "undefined" && typeof Deno.serve === "function") {
  // @ts-ignore Deno global
  Deno.serve(handleRequest);
}