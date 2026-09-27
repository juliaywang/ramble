import { boroughName, cleanNYCValue as clean, deterministicId, fetchSocrata, joinValues, numeric, nycCoordinates, upsertDiscoveries, type DiscoveryRow, type NYCRow, type SupabaseClient } from "./helpers.ts";

// API field names verified against /api/views/{id}.json and live samples.
// Each source keeps its own transformation and sync function.
function placeDefaults(source: string, dataset: string) {
  return { discovery_type: "place", source, source_url: `https://data.cityofnewyork.us/resource/${dataset}.json`, start_time: null, end_time: null, neighborhood: null, last_synced_at: new Date().toISOString() };
}
function present<T>(row: T | null): row is T { return row !== null; }

export function communityGarden(row: NYCRow): DiscoveryRow | null {
  const name = clean(row.gardenname);
  const coords = nycCoordinates(row.lat, row.lon);
  if (!name || !coords) return null;
  const borough = boroughName(row.borough);
  return {
    ...placeDefaults("NYC GreenThumb Gardens", "p78i-pat6"), ...coords,
    external_id: clean(row.parksid) ?? deterministicId("garden", [name, row.address, borough]),
    name, categories: ["sustainability", "culture"], borough,
    address: joinValues([row.address, row.zipcode]),
    // NTA codes are not human-readable neighborhood names.
    description: joinValues(["Community garden", clean(row.crossstreets) ? `Cross streets: ${clean(row.crossstreets)}` : null,
      clean(row.status) ? `Listed status: ${clean(row.status)}` : null], ". "),
  };
}
export async function syncCommunityGardens(supabase: SupabaseClient) {
  const data = await fetchSocrata("p78i-pat6", "GreenThumb Gardens");
  const records = data.map(communityGarden).filter(present);
  return { fetched: data.length, imported: await upsertDiscoveries(supabase, "GreenThumb Gardens", records) };
}

export function culturalOrganization(row: NYCRow): DiscoveryRow | null {
  const name = clean(row.organization_name);
  const address = clean(row.address);
  const borough = boroughName(row.borough);
  // This dataset has neither a record ID nor coordinates. Keep useful addresses;
  // do not fabricate a map point or import organizations outside NYC.
  if (!name || !address || !borough) return null;
  const discipline = clean(row.discipline);
  const text = `${name} ${discipline ?? ""}`.toLowerCase();
  const categories = ["culture"];
  if (/\b(art|arts|gallery|galleries|museum|painting|sculpture|photography|design)\b/.test(text)) categories.push("art");
  if (/\b(music|musical|orchestra|opera|choir|choral|jazz|symphony)\b/.test(text)) categories.push("music");
  return {
    ...placeDefaults("NYC Cultural Organizations", "pfja-tk2j"),
    external_id: deterministicId("culture", [name, address, borough]), name, categories,
    description: discipline ? `Cultural organization: ${discipline}.` : "NYC cultural organization.",
    address: joinValues([address, row.city, row.state, row.postcode]), borough,
    latitude: null, longitude: null,
  };
}
export async function syncCulturalOrganizations(supabase: SupabaseClient) {
  const data = await fetchSocrata("pfja-tk2j", "Cultural Organizations");
  const records = data.map(culturalOrganization).filter(present);
  return { fetched: data.length, imported: await upsertDiscoveries(supabase, "Cultural Organizations", records), warning: "Source has no coordinates; address-only places require geocoding to appear on a map." };
}

export function library(row: NYCRow): DiscoveryRow | null {
  const name = clean(row.name);
  const point = row.the_geom?.type === "Point" ? row.the_geom.coordinates : [];
  const coords = nycCoordinates(point?.[1], point?.[0]);
  if (!name || !coords) return null;
  const address = joinValues([row.housenum, row.streetname], " ");
  const borough = boroughName(row.borocode);
  return {
    ...placeDefaults("NYC Libraries", "feuq-due4"), ...coords,
    // BIN/BBL identify buildings/lots, not branches. Keep branches distinct.
    external_id: deterministicId("library", [row.system, name, address, borough]),
    name, categories: ["books", "culture", "technology"],
    description: clean(row.system) ? `Public library in the ${clean(row.system)} system.` : "Public library.",
    address: joinValues([address, row.city, row.zip]), borough,
    source_url: clean(row.url) ?? "https://data.cityofnewyork.us/resource/feuq-due4.json",
  };
}
export async function syncLibraries(supabase: SupabaseClient) {
  const data = await fetchSocrata("feuq-due4", "Libraries");
  return { fetched: data.length, imported: await upsertDiscoveries(supabase, "Libraries", data.map(library).filter(present)) };
}

export function farmersMarket(row: NYCRow): DiscoveryRow | null {
  const name = clean(row.marketname);
  const coords = nycCoordinates(row.latitude, row.longitude);
  if (!name || !coords) return null;
  const borough = boroughName(row.borough);
  return {
    ...placeDefaults("NYC Farmers Markets", "8vwk-6iz2"), ...coords,
    external_id: deterministicId("market", [name, row.streetaddress, borough]),
    name, categories: ["food", "sustainability"], borough, address: clean(row.streetaddress),
    description: joinValues(["Farmers market", joinValues([row.daysoperation, row.hoursoperations], " "),
      clean(row.open_year_round) === "Yes" ? "Open year-round" : null,
      clean(row.accepts_ebt) === "Yes" ? "Accepts EBT" : null], ". "),
  };
}
export async function syncFarmersMarkets(supabase: SupabaseClient) {
  const data = await fetchSocrata("8vwk-6iz2", "Farmers Markets");
  // If the source contains several annual versions, keep the newest useful one.
  data.sort((a, b) => (numeric(b.year) ?? 0) - (numeric(a.year) ?? 0));
  return { fetched: data.length, imported: await upsertDiscoveries(supabase, "Farmers Markets", data.map(farmersMarket).filter(present)) };
}

const RESTAURANT_FIELDS = "camis,dba,boro,building,street,zipcode,cuisine_description,latitude,longitude";
export const RESTAURANT_QUERY = {
  "$select": `${RESTAURANT_FIELDS},max(inspection_date) as latest_inspection_date`,
  "$group": RESTAURANT_FIELDS,
  "$where": "camis is not null",
  "$order": "camis,latest_inspection_date DESC,dba,boro,building,street,zipcode,cuisine_description,latitude,longitude",
};
export function restaurant(row: NYCRow): DiscoveryRow | null {
  const external_id = clean(row.camis);
  const name = clean(row.dba);
  const coords = nycCoordinates(row.latitude, row.longitude);
  if (!external_id || !name || !coords) return null;
  const cuisine = clean(row.cuisine_description);
  const categories = ["food"];
  if (/\b(coffee|caf[eé]|espresso|cappuccino)(?=$|[^\p{L}\p{N}])/iu.test(`${name} ${cuisine ?? ""}`)) categories.push("coffee");
  return {
    ...placeDefaults("NYC Restaurants", "43nn-pn8j"), ...coords,
    external_id, name, categories, description: cuisine ? `${cuisine} establishment.` : "Local food establishment.",
    address: joinValues([joinValues([row.building, row.street], " "), row.zipcode]), borough: boroughName(row.boro),
  };
}
export function restaurantDiscoveries(data: NYCRow[]): DiscoveryRow[] {
  // Latest useful establishment tuple wins, never a mixture of unrelated MAX fields.
  const ordered = [...data].sort((a, b) => String(b.latest_inspection_date ?? "").localeCompare(String(a.latest_inspection_date ?? "")));
  const byCamis = new Map<string, DiscoveryRow>();
  for (const row of ordered) {
    const discovery = restaurant(row);
    if (discovery && !byCamis.has(discovery.external_id)) byCamis.set(discovery.external_id, discovery);
  }
  return [...byCamis.values()];
}
export async function syncRestaurants(supabase: SupabaseClient) {
  // Group server-side to collapse all violation/inspection repeats of each
  // establishment tuple. Pagination still covers every grouped establishment.
  const data = await fetchSocrata("43nn-pn8j", "Restaurants", RESTAURANT_QUERY);
  return { fetched: data.length, imported: await upsertDiscoveries(supabase, "Restaurants", restaurantDiscoveries(data)) };
}

export function pops(row: NYCRow): DiscoveryRow | null {
  const coords = nycCoordinates(row.latitude, row.longitude);
  const street = joinValues([row.address_number, row.street_name], " ");
  const address = clean(row.building_address_with_zip) ?? joinValues([street, row.zip_code]);
  const building = clean(row.building_name);
  if (!coords || (!building && !street)) return null;
  const borough = boroughName(row.borough_name) ?? boroughName(row.borocode);
  return {
    ...placeDefaults("NYC POPS", "rvih-nhyn"), ...coords,
    external_id: clean(row.pops_number) ?? deterministicId("pops", [building, street, borough]),
    name: building ? `${building} public space` : `Public space at ${street}`,
    categories: ["culture"], address, borough,
    description: joinValues([clean(row.public_space_type) ?? "Privately owned public space",
      clean(row.hour_of_access_required) ? `Required access hours: ${clean(row.hour_of_access_required)}` : null,
      clean(row.amenities_required) ? `Required amenities: ${clean(row.amenities_required)}` : null], ". "),
  };
}
export async function syncPOPS(supabase: SupabaseClient) {
  const data = await fetchSocrata("rvih-nhyn", "POPS");
  return { fetched: data.length, imported: await upsertDiscoveries(supabase, "POPS", data.map(pops).filter(present)) };
}
