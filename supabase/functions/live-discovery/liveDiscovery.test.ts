import { describe, expect, it, vi } from "vitest";
import {
  buildSearchQuery,
  deduplicateDiscoveries,
  extractDiscoveriesWithGemini,
  getNycOffsetString,
  handleRequest,
  isAggregateAddress,
  isEntityRelevantToCategory,
  isEventExpired,
  parseNycTimestamp,
  prepareSourcesForExtraction,
  validateExtractedDiscovery,
  validateRequest,
  type Discovery,
  type RawExtractedDiscovery,
  type SourceDocument,
  type TavilyResult,
} from "./index.ts";

describe("live-discovery pipeline with Gemini", () => {
  describe("validateRequest", () => {
    it("validates and parses correct request body", () => {
      const result = validateRequest({
        neighborhood: "Morningside Heights",
        categories: ["books", "coffee", "music"],
      });
      expect(result.isValid).toBe(true);
      expect(result.data?.neighborhood).toBe("Morningside Heights");
      expect(result.data?.categories).toEqual(["books", "coffee", "music"]);
    });

    it("caps categories to MAX_CATEGORIES (3)", () => {
      const result = validateRequest({
        neighborhood: "Morningside Heights",
        categories: ["books", "coffee", "music", "art", "food"],
      });
      expect(result.isValid).toBe(true);
      expect(result.data?.categories).toHaveLength(3);
      expect(result.data?.categories).toEqual(["books", "coffee", "music"]);
    });

    it("rejects missing or empty categories", () => {
      const result = validateRequest({
        neighborhood: "Morningside Heights",
        categories: [],
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("non-empty array");
    });

    it("rejects invalid categories", () => {
      const result = validateRequest({
        neighborhood: "Morningside Heights",
        categories: ["invalid_category"],
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("No valid Ramble categories");
    });
  });

  describe("buildSearchQuery", () => {
    it("builds physically constrained queries for specific neighborhoods", () => {
      const query = buildSearchQuery("coffee", "Morningside Heights");
      expect(query).toContain("physically located in Morningside Heights Manhattan NYC address");
      expect(query).toContain("independent coffee shops cafes");
    });

    it("builds generic queries when neighborhood is NYC", () => {
      const query = buildSearchQuery("books", "New York City");
      expect(query).toContain("physically located in New York City address");
    });
  });

  describe("prepareSourcesForExtraction", () => {
    it("deduplicates URLs and filters blocked aggregator domains", () => {
      const searches: Array<{ category: "books"; results: TavilyResult[] }> = [
        {
          category: "books",
          results: [
            {
              title: "Book Culture",
              url: "https://www.bookculture.com",
              content: "Independent bookstore on 112th St",
            },
            {
              title: "Book Culture Duplicate",
              url: "https://www.bookculture.com",
              content: "Duplicate content",
            },
            {
              title: "Yelp Book Culture",
              url: "https://www.yelp.com/biz/book-culture-new-york",
              content: "Yelp reviews",
            },
            {
              title: "Moving Company Spam",
              url: "https://www.movers.com/ny/morningside",
              content: "Movers in NY",
            },
          ],
        },
      ];

      const sources = prepareSourcesForExtraction(searches, "Morningside Heights");
      expect(sources).toHaveLength(1);
      expect(sources[0].url).toBe("https://www.bookculture.com");
      expect(sources[0].source_id).toBe("src_1");
    });
  });

  describe("validateExtractedDiscovery", () => {
    const validUrls = new Set(["https://www.bookculture.com", "https://millertheatre.com"]);

    it("accepts valid places with supported source URLs", () => {
      const raw: RawExtractedDiscovery = {
        name: "Book Culture",
        discovery_type: "place",
        categories: ["books"],
        description: "Neighborhood independent bookstore.",
        address: "536 W 112th St",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: null,
        end_time: null,
        source_url: "https://www.bookculture.com",
      };

      const result = validateExtractedDiscovery(raw, validUrls, "Morningside Heights");
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Book Culture");
      expect(result?.discovery_type).toBe("place");
      expect(result?.address).toBe("536 W 112th St");
      expect(result?.source).toBe("Live Discovery");
      expect(result?.verified).toBe(false);
    });

    it("rejects discoveries with unapproved source URLs", () => {
      const raw: RawExtractedDiscovery = {
        name: "Invented Place",
        discovery_type: "place",
        categories: ["books"],
        description: "Fake bookstore.",
        address: "123 Fake St",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: null,
        end_time: null,
        source_url: "https://www.hallucinated-url.com",
      };

      const result = validateExtractedDiscovery(raw, validUrls, "Morningside Heights");
      expect(result).toBeNull();
    });

    it("rejects article titles, guides, and listicles as discovery names", () => {
      const listicles = [
        "The Best Independent Bookstores In NYC",
        "10 Cozy Morningside Heights Cafes",
        "Perk Up! The Buzz on Upper West Side Coffee Spots",
        "A Guide to Books in Manhattan",
        "Calendar of Events in Morningside Heights",
      ];

      for (const title of listicles) {
        const raw: RawExtractedDiscovery = {
          name: title,
          discovery_type: "place",
          categories: ["books"],
          description: "Article content.",
          address: null,
          neighborhood: null,
          borough: null,
          latitude: null,
          longitude: null,
          start_time: null,
          end_time: null,
          source_url: "https://www.bookculture.com",
        };
        const result = validateExtractedDiscovery(raw, validUrls, "Morningside Heights");
        expect(result).toBeNull();
      }
    });

    it("rejects apartment buildings, movers, and movies", () => {
      const nonPlaces = [
        "One Morningside Park Apartments",
        "Avalon Morningside Park Condos",
        "Morningside Heights Movers",
        "Spider-Man 2",
      ];

      for (const name of nonPlaces) {
        const raw: RawExtractedDiscovery = {
          name,
          discovery_type: "place",
          categories: ["books"],
          description: "Not a discovery.",
          address: "1 Morningside Park",
          neighborhood: "Morningside Heights",
          borough: "Manhattan",
          latitude: null,
          longitude: null,
          start_time: null,
          end_time: null,
          source_url: "https://www.bookculture.com",
        };
        const result = validateExtractedDiscovery(raw, validUrls, "Morningside Heights");
        expect(result).toBeNull();
      }
    });

    it("rejects discoveries with conflicting boroughs or neighborhoods", () => {
      // Morningside Heights is in Manhattan; reject if borough is Brooklyn
      const rawBrooklyn: RawExtractedDiscovery = {
        name: "Shrine World Music Venue",
        discovery_type: "place",
        categories: ["music"],
        description: "Music venue in Brooklyn.",
        address: "2271 Bedford Ave",
        neighborhood: "Williamsburg",
        borough: "Brooklyn",
        latitude: null,
        longitude: null,
        start_time: null,
        end_time: null,
        source_url: "https://millertheatre.com",
      };

      const result = validateExtractedDiscovery(rawBrooklyn, validUrls, "Morningside Heights");
      expect(result).toBeNull();

      // Reject if neighborhood is explicitly Upper East Side during Morningside Heights search
      const rawUES: RawExtractedDiscovery = {
        name: "Ralph's Coffee",
        discovery_type: "place",
        categories: ["coffee"],
        description: "Madison Ave cafe.",
        address: "888 Madison Ave",
        neighborhood: "Upper East Side",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: null,
        end_time: null,
        source_url: "https://millertheatre.com",
      };

      const uesResult = validateExtractedDiscovery(rawUES, validUrls, "Morningside Heights");
      expect(uesResult).toBeNull();
    });

    it("rejects out-of-neighborhood locations like Piano in Bryant Park for Morningside Heights search", () => {
      const distantEvents = [
        {
          name: "Piano in Bryant Park",
          address: "42nd St & 6th Ave",
          description: "Live outdoor piano concerts at Bryant Park in Midtown Manhattan.",
        },
        {
          name: "Lincoln Center Summer for the City",
          address: "Columbus Ave & 63rd St",
          description: "Dance and music festival at Lincoln Center.",
        },
        {
          name: "Carnegie Hall Citywide Concert",
          address: "881 7th Ave",
          description: "Performance in Midtown.",
        },
        {
          name: "Times Square Street Performers",
          address: "Broadway & 45th St",
          description: "Music in Times Square.",
        },
      ];

      for (const item of distantEvents) {
        const raw: RawExtractedDiscovery = {
          name: item.name,
          discovery_type: "event",
          categories: ["music"],
          description: item.description,
          address: item.address,
          neighborhood: null,
          borough: "Manhattan",
          latitude: null,
          longitude: null,
          start_time: "2026-09-28T18:00:00-04:00",
          end_time: "2026-09-28T20:00:00-04:00",
          source_url: "https://millertheatre.com",
        };
        const result = validateExtractedDiscovery(raw, validUrls, "Morningside Heights");
        expect(result).toBeNull();
      }
    });

    it("enforces place vs event consistency: places MUST have start_time and end_time as null", () => {
      const rawPlaceWithTimes: RawExtractedDiscovery = {
        name: "Smoke Jazz & Supper Club",
        discovery_type: "place",
        categories: ["music", "food"],
        description: "Intimate Upper West Side / Morningside Heights jazz club with nightly live sets.",
        address: "2751 Broadway",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: 40.8016,
        longitude: -73.9682,
        start_time: "2026-09-27T19:00:00-04:00",
        end_time: "2026-09-27T21:00:00-04:00",
        source_url: "https://millertheatre.com",
      };

      const result = validateExtractedDiscovery(rawPlaceWithTimes, validUrls, "Morningside Heights");
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Smoke Jazz & Supper Club");
      expect(result?.discovery_type).toBe("place");
      // MUST be forced to null for places!
      expect(result?.start_time).toBeNull();
      expect(result?.end_time).toBeNull();
    });

    it("preserves start_time and end_time for valid events", () => {
      const rawEvent: RawExtractedDiscovery = {
        name: "Bach Virtuosi Concert",
        discovery_type: "event",
        categories: ["music"],
        description: "Chamber music performance at Miller Theatre on Columbia campus.",
        address: "2960 Broadway",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: "2026-09-28T19:30:00-04:00",
        end_time: "2026-09-28T21:30:00-04:00",
        source_url: "https://millertheatre.com",
      };

      const result = validateExtractedDiscovery(rawEvent, validUrls, "Morningside Heights");
      expect(result).not.toBeNull();
      expect(result?.discovery_type).toBe("event");
      expect(result?.start_time).toBe("2026-09-28T19:30:00-04:00");
      expect(result?.end_time).toBe("2026-09-28T21:30:00-04:00");
    });

    it("requires positive geographic evidence for neighborhood-specific requests", () => {
      // 1. Completely missing geographic evidence
      const rawNoLocation: RawExtractedDiscovery = {
        name: "General Concert",
        discovery_type: "event",
        categories: ["music"],
        description: "A concert somewhere.",
        address: null,
        neighborhood: null,
        borough: null,
        latitude: null,
        longitude: null,
        start_time: "2026-09-28T19:00:00-04:00",
        end_time: "2026-09-28T21:00:00-04:00",
        source_url: "https://millertheatre.com",
      };
      expect(validateExtractedDiscovery(rawNoLocation, validUrls, "Morningside Heights")).toBeNull();

      // 2. Borough of "Manhattan" alone is insufficient evidence
      const rawManhattanOnly: RawExtractedDiscovery = {
        name: "Midtown Symphony",
        discovery_type: "event",
        categories: ["music"],
        description: "An orchestra concert in Manhattan.",
        address: null,
        neighborhood: null,
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: "2026-09-28T19:00:00-04:00",
        end_time: "2026-09-28T21:00:00-04:00",
        source_url: "https://millertheatre.com",
      };
      expect(validateExtractedDiscovery(rawManhattanOnly, validUrls, "Morningside Heights")).toBeNull();

      // 3. Generic neighborhood "Manhattan" without address is insufficient
      const rawGenericHood: RawExtractedDiscovery = {
        name: "City Event",
        discovery_type: "event",
        categories: ["music"],
        description: "Live performance.",
        address: null,
        neighborhood: "Manhattan",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: "2026-09-28T19:00:00-04:00",
        end_time: "2026-09-28T21:00:00-04:00",
        source_url: "https://millertheatre.com",
      };
      expect(validateExtractedDiscovery(rawGenericHood, validUrls, "Morningside Heights")).toBeNull();

      // 4. Valid discovery with specific neighborhood is accepted
      const rawSupportedHood: RawExtractedDiscovery = {
        name: "Miller Theatre Jazz",
        discovery_type: "event",
        categories: ["music"],
        description: "Jazz performance at Columbia.",
        address: "2960 Broadway",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: "2026-09-28T19:00:00-04:00",
        end_time: "2026-09-28T21:00:00-04:00",
        source_url: "https://millertheatre.com",
      };
      expect(validateExtractedDiscovery(rawSupportedHood, validUrls, "Morningside Heights")).not.toBeNull();
    });

    it("requires entity-level category relevance (rejects non-music garden celebrations)", () => {
      // "The Garden People: 45 Years in Bloom" false positive from test
      const rawGardenEvent: RawExtractedDiscovery = {
        name: "The Garden People: 45 Years in Bloom",
        discovery_type: "event",
        categories: ["music"],
        description: "Join the Garden People in celebrating 45 years of growing together in the community garden.",
        address: "W 112th St",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: "2026-09-28T14:00:00-04:00",
        end_time: "2026-09-28T16:00:00-04:00",
        source_url: "https://millertheatre.com",
      };

      const result = validateExtractedDiscovery(rawGardenEvent, validUrls, "Morningside Heights", ["music"]);
      expect(result).toBeNull();

      // Valid musical event should pass
      const rawMusicEvent: RawExtractedDiscovery = {
        name: "Morningside Heights Jazz Ensemble",
        discovery_type: "event",
        categories: ["music"],
        description: "Live outdoor jazz concert featuring brass and rhythm players.",
        address: "Broadway and 116th St",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: "2026-09-28T18:00:00-04:00",
        end_time: "2026-09-28T20:00:00-04:00",
        source_url: "https://millertheatre.com",
      };

      const musicResult = validateExtractedDiscovery(rawMusicEvent, validUrls, "Morningside Heights", ["music"]);
      expect(musicResult).not.toBeNull();
      expect(musicResult?.name).toBe("Morningside Heights Jazz Ensemble");
    });

    it("detects aggregate addresses and rejects aggregate place records", () => {
      expect(isAggregateAddress("112th and 114th streets")).toBe(true);
      expect(isAggregateAddress("112th & 114th sts")).toBe(true);
      expect(isAggregateAddress("112th and 114th")).toBe(true);
      expect(isAggregateAddress("multiple locations in Manhattan")).toBe(true);
      expect(isAggregateAddress("locations on Broadway and Amsterdam")).toBe(true);
      expect(isAggregateAddress("536 W 112th St and 2915 Broadway")).toBe(true);

      // Single physical addresses and intersections should NOT be aggregate
      expect(isAggregateAddress("536 West 112th Street")).toBe(false);
      expect(isAggregateAddress("111th and Amsterdam")).toBe(false);
      expect(isAggregateAddress("42nd St & 6th Ave")).toBe(false);
      expect(isAggregateAddress("between 112th and 114th on Broadway")).toBe(false);

      // Aggregate address rejected in validateExtractedDiscovery
      const rawAggregatePlace: RawExtractedDiscovery = {
        name: "Book Culture",
        discovery_type: "place",
        categories: ["books"],
        description: "Neighborhood bookstore.",
        address: "112th and 114th streets",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: null,
        end_time: null,
        source_url: "https://www.bookculture.com",
      };
      expect(validateExtractedDiscovery(rawAggregatePlace, validUrls, "Morningside Heights")).toBeNull();

      // Specific individual location accepted
      const rawSinglePlace: RawExtractedDiscovery = {
        name: "Book Culture",
        discovery_type: "place",
        categories: ["books"],
        description: "Neighborhood bookstore.",
        address: "536 West 112th Street",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: null,
        end_time: null,
        source_url: "https://www.bookculture.com",
      };
      const singleResult = validateExtractedDiscovery(rawSinglePlace, validUrls, "Morningside Heights");
      expect(singleResult).not.toBeNull();
      expect(singleResult?.address).toBe("536 West 112th Street");
    });

    it("requires places to be physical places a user can visit", () => {
      // 1. Missing address on a place is rejected
      const rawPlaceNoAddress: RawExtractedDiscovery = {
        name: "Some Bookstore",
        discovery_type: "place",
        categories: ["books"],
        description: "Independent bookstore.",
        address: null,
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: null,
        end_time: null,
        source_url: "https://www.bookculture.com",
      };
      expect(validateExtractedDiscovery(rawPlaceNoAddress, validUrls, "Morningside Heights")).toBeNull();

      // 2. Book club without physical facility is rejected as a place
      const rawBookClub: RawExtractedDiscovery = {
        name: "Books that Bind",
        discovery_type: "place",
        categories: ["books"],
        description: "A student book club that meets to discuss literature.",
        address: "Columbia University Campus",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: null,
        end_time: null,
        source_url: "https://www.bookculture.com",
      };
      expect(validateExtractedDiscovery(rawBookClub, validUrls, "Morningside Heights")).toBeNull();

      // 3. Book club in name is rejected as a place
      const rawClubInName: RawExtractedDiscovery = {
        name: "Morningside Book Club",
        discovery_type: "place",
        categories: ["books"],
        description: "Reading club for locals.",
        address: "116th and Broadway",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: null,
        end_time: null,
        source_url: "https://www.bookculture.com",
      };
      expect(validateExtractedDiscovery(rawClubInName, validUrls, "Morningside Heights")).toBeNull();
    });
  });

  describe("deduplicateDiscoveries", () => {
    it("merges the same place when address formatting differs (e.g. Hungarian Pastry Shop)", () => {
      const d1: Discovery = {
        name: "The Hungarian Pastry Shop",
        discovery_type: "place",
        categories: ["coffee"],
        description: "Classic cafe and bakery near Columbia.",
        address: "111th and Amsterdam",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: null,
        end_time: null,
        source: "Live Discovery",
        source_url: "https://www.westsiderag.com/hungarian-pastry-shop",
        verified: false,
      };

      const d2: Discovery = {
        name: "The Hungarian Pastry Shop",
        discovery_type: "place",
        categories: ["coffee", "food"],
        description: "Historic bakery and cafe serving pastries and coffee on Amsterdam Avenue.",
        address: "corner of 111th and Amsterdam",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: 40.8037,
        longitude: -73.9634,
        start_time: null,
        end_time: null,
        source: "Live Discovery",
        source_url: "https://barnard.edu/hungarian-pastry-shop",
        verified: false,
      };

      const deduplicated = deduplicateDiscoveries([d1, d2]);
      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0].name).toBe("The Hungarian Pastry Shop");
      expect(deduplicated[0].categories).toEqual(expect.arrayContaining(["coffee", "food"]));
      expect(deduplicated[0].latitude).toBe(40.8037);
      expect(deduplicated[0].longitude).toBe(-73.9634);
      expect(deduplicated[0].description).toBe(
        "Historic bakery and cafe serving pastries and coffee on Amsterdam Avenue."
      );
      expect(deduplicated[0].source_url).toBe("https://barnard.edu/hungarian-pastry-shop");
    });

    it("keeps distinct physical locations of the same business separate (e.g. Book Culture)", () => {
      const broadwayLoc: Discovery = {
        name: "Book Culture",
        discovery_type: "place",
        categories: ["books"],
        description: "Broadway bookstore branch.",
        address: "2915 Broadway",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: null,
        end_time: null,
        source: "Live Discovery",
        source_url: "https://www.bookculture.com/broadway",
        verified: false,
      };

      const street112Loc: Discovery = {
        name: "Book Culture",
        discovery_type: "place",
        categories: ["books"],
        description: "Original 112th St bookstore branch.",
        address: "536 West 112th Street",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: null,
        end_time: null,
        source: "Live Discovery",
        source_url: "https://www.bookculture.com/112th",
        verified: false,
      };

      const deduplicated = deduplicateDiscoveries([broadwayLoc, street112Loc]);
      expect(deduplicated).toHaveLength(2);
      expect(deduplicated[0].address).toBe("2915 Broadway");
      expect(deduplicated[1].address).toBe("536 West 112th Street");
    });

    it("merges abbreviations of the same location (e.g. 536 W 112th St and 536 West 112th Street)", () => {
      const loc1: Discovery = {
        name: "Book Culture",
        discovery_type: "place",
        categories: ["books"],
        description: "Independent bookstore.",
        address: "536 W 112th St",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: null,
        end_time: null,
        source: "Live Discovery",
        source_url: "https://www.bookculture.com/112th",
        verified: false,
      };

      const loc2: Discovery = {
        name: "Book Culture",
        discovery_type: "place",
        categories: ["culture"],
        description: "Beloved neighborhood independent bookstore.",
        address: "536 West 112th Street",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: null,
        end_time: null,
        source: "Live Discovery",
        source_url: "https://www.bookculture.com/about",
        verified: false,
      };

      const deduplicated = deduplicateDiscoveries([loc1, loc2]);
      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0].categories).toEqual(expect.arrayContaining(["books", "culture"]));
      expect(deduplicated[0].address).toBe("536 West 112th Street");
    });

    it("merges categories and retains richest information for duplicate entities", () => {
      const d1: Discovery = {
        name: "Hex & Company",
        discovery_type: "place",
        categories: ["gaming"],
        description: "Board game cafe with espresso.",
        address: "2914 Broadway",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: null,
        end_time: null,
        source: "Live Discovery",
        source_url: "https://hexnyc.com",
        verified: false,
      };

      const d2: Discovery = {
        name: "Hex & Company",
        discovery_type: "place",
        categories: ["coffee"],
        description: null,
        address: "2914 Broadway",
        neighborhood: null,
        borough: null,
        latitude: null,
        longitude: null,
        start_time: null,
        end_time: null,
        source: "Live Discovery",
        source_url: "https://hexnyc.com/games",
        verified: false,
      };

      const deduplicated = deduplicateDiscoveries([d1, d2]);
      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0].categories).toEqual(expect.arrayContaining(["gaming", "coffee"]));
      expect(deduplicated[0].neighborhood).toBe("Morningside Heights");
      expect(deduplicated[0].description).toBe("Board game cafe with espresso.");
    });
  });

  describe("isEventExpired and NYC timezone handling", () => {
    // Reference reference time: 2026-09-27T10:00:00-04:00 (EDT)
    const fixedNowMs = Date.parse("2026-09-27T10:00:00-04:00");

    it("never expires persistent places", () => {
      const place: Discovery = {
        name: "Hungarian Pastry Shop",
        discovery_type: "place",
        categories: ["coffee"],
        description: "Classic cafe.",
        address: "1030 Amsterdam Ave",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: null,
        end_time: null,
        source: "Live Discovery",
        source_url: "https://barnard.edu",
        verified: false,
      };

      expect(isEventExpired(place, fixedNowMs)).toBe(false);
    });

    it("expires an event whose end_time has passed in NYC time", () => {
      const pastEvent: Discovery = {
        name: "Morning Yoga at the Park",
        discovery_type: "event",
        categories: ["culture"],
        description: "Outdoor yoga session.",
        address: "Morningside Park",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: "2026-09-27T08:00:00-04:00",
        end_time: "2026-09-27T09:00:00-04:00", // Ended an hour ago
        source: "Live Discovery",
        source_url: "https://example.com/yoga",
        verified: false,
      };

      expect(isEventExpired(pastEvent, fixedNowMs)).toBe(true);
    });

    it("expires an event with no end_time if start_time is conservatively in the past (> 4 hours)", () => {
      const pastStartEvent: Discovery = {
        name: "Dawn Bird Watching",
        discovery_type: "event",
        categories: ["sustainability"],
        description: "Early morning bird walk.",
        address: "Riverside Park",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: "2026-09-27T05:00:00-04:00", // Started 5 hours ago (5 + 4 = 9 < 10)
        end_time: null,
        source: "Live Discovery",
        source_url: "https://example.com/birds",
        verified: false,
      };

      expect(isEventExpired(pastStartEvent, fixedNowMs)).toBe(true);
    });

    it("keeps future events whose start_time is later today or tomorrow", () => {
      const eveningEvent: Discovery = {
        name: "Jazz at the Crypt",
        discovery_type: "event",
        categories: ["music"],
        description: "Evening jazz concert.",
        address: "Cathedral of St. John the Divine",
        neighborhood: "Morningside Heights",
        borough: "Manhattan",
        latitude: null,
        longitude: null,
        start_time: "2026-09-27T19:00:00-04:00", // Tonight at 7 PM
        end_time: "2026-09-27T21:00:00-04:00",
        source: "Live Discovery",
        source_url: "https://stjohndivine.org",
        verified: false,
      };

      expect(isEventExpired(eveningEvent, fixedNowMs)).toBe(false);
    });

    it("correctly parses naive NYC local timestamps as America/New_York (EDT in September)", () => {
      // No timezone offset specified in source
      const naiveTimestamp = "2026-09-27T19:00:00";
      const parsedMs = parseNycTimestamp(naiveTimestamp);
      expect(parsedMs).not.toBeNull();

      // In September, NYC is EDT (UTC-4), so 19:00 EDT should be 23:00 UTC
      const expectedMs = Date.parse("2026-09-27T23:00:00Z");
      expect(parsedMs).toBe(expectedMs);
    });

    it("correctly determines NYC Daylight Saving Time offsets", () => {
      expect(getNycOffsetString(2026, 9, 27)).toBe("-04:00"); // September is EDT
      expect(getNycOffsetString(2026, 1, 15)).toBe("-05:00"); // January is EST
    });
  });

  describe("extractDiscoveriesWithGemini", () => {
    it("sends structured output request to Gemini with responseSchema and x-goog-api-key", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      discoveries: [
                        {
                          name: "Book Culture",
                          discovery_type: "place",
                          categories: ["books"],
                          description: "Neighborhood indie bookstore on 112th St.",
                          address: "536 W 112th St",
                          neighborhood: "Morningside Heights",
                          borough: "Manhattan",
                          latitude: null,
                          longitude: null,
                          start_time: null,
                          end_time: null,
                          source_url: "https://www.bookculture.com",
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      const sources: SourceDocument[] = [
        {
          source_id: "src_1",
          url: "https://www.bookculture.com",
          title: "Book Culture Booksellers",
          snippet: "Book Culture at 536 W 112th St in Morningside Heights...",
          category: "books",
          neighborhood: "Morningside Heights",
        },
      ];

      const discoveries = await extractDiscoveriesWithGemini(
        "mock-gemini-key",
        sources,
        "Morningside Heights",
        "gemini-2.5-flash-lite",
        mockFetch as unknown as typeof fetch
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];

      expect(url).toBe(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent"
      );
      expect(options.headers["x-goog-api-key"]).toBe("mock-gemini-key");

      const body = JSON.parse(options.body);
      expect(body.generationConfig.responseMimeType).toBe("application/json");
      expect(body.generationConfig.responseSchema).toBeDefined();
      expect(body.generationConfig.temperature).toBe(0.1);
      expect(body.systemInstruction.parts[0].text).toContain("Ramble, an NYC exploration app");
      expect(discoveries).toHaveLength(1);
      expect(discoveries[0].name).toBe("Book Culture");
    });
  });

  describe("handleRequest end-to-end", () => {
    it("handles CORS OPTIONS preflight", async () => {
      const req = new Request("http://localhost/live-discovery", {
        method: "OPTIONS",
      });
      const res = await handleRequest(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("rejects non-POST methods", async () => {
      const req = new Request("http://localhost/live-discovery", {
        method: "GET",
      });
      const res = await handleRequest(req);
      expect(res.status).toBe(405);
    });
  });
});
