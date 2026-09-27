# NYC discovery sync

The existing Edge Function entry point and Supabase client are retained. Parks and Public Art keep their source names, identifiers, category logic, and response samples. Expired-event deletion is unchanged and runs after those two syncs, before the new place syncs. There is no generic `syncDataset()` dispatcher.

`index.ts` owns Parks, Public Art, event cleanup, and orchestration. `places.ts` contains the six independent source transformations and sync functions. `helpers.ts` contains only shared value cleaning, coordinate validation, deterministic IDs, paginated fetches, and deduplicated/batched upserts.

## Sources and identity

Live metadata and samples were checked on 2026-09-27. Every endpoint uses `https://data.cityofnewyork.us/resource/` plus the dataset ID and `.json`.

| Sync function | Dataset | `source` | `external_id` |
| --- | --- | --- | --- |
| `syncParksEvents` | `w3wp-dpdi` | NYC Parks | Existing `guid` |
| `syncPublicArt` | `2pg3-gcaa` | NYC Public Art | Existing title/location/address/borough slug (unchanged) |
| `syncCommunityGardens` | `p78i-pat6` | NYC GreenThumb Gardens | `parksid`; fallback garden name/address/borough tuple |
| `syncCulturalOrganizations` | `pfja-tk2j` | NYC Cultural Organizations | Organization name/address/borough tuple |
| `syncLibraries` | `feuq-due4` | NYC Libraries | System/branch name/street address/borough tuple |
| `syncFarmersMarkets` | `8vwk-6iz2` | NYC Farmers Markets | Market name/street address/borough tuple; year excluded |
| `syncRestaurants` | `43nn-pn8j` | NYC Restaurants | `camis` |
| `syncPOPS` | `rvih-nhyn` | NYC POPS | `pops_number`; fallback building/street address/borough tuple |

Fallback IDs encode normalized tuples, preserving punctuation and field boundaries. They are deterministic, not random. Changes to identity fields (such as a renamed library or a relocated market) can produce a new ID; source-stable IDs are used where available. BIN and BBL are building/lot identifiers, not unique library branch identifiers.

## Source differences

- Gardens use `gardenname`, `lat`, `lon`, and coded `borough`. NTA codes are not mislabeled as neighborhood names.
- Cultural Organizations has **no coordinate fields or stable organization ID**. Records with a name, address, and recognized NYC borough are imported with null coordinates. Map placement requires separate geocoding. The summary includes a warning. Category additions use `discipline` and organization name.
- Libraries use GeoJSON `the_geom.coordinates` in **longitude, latitude** order; addresses combine `housenum`, `streetname`, city, and zip.
- Markets contain multiple annual versions. The newest valid version of each name/address/borough identity wins. This does not imply every historical market is still operating. Records without valid coordinates are skipped.
- Restaurants are queried with a SoQL grouping over establishment fields plus `max(inspection_date)` for each tuple. Inspection/violation text is not fetched. This avoids downloading raw violation rows while keeping coherent name/address/coordinate tuples. Local deduplication selects the newest usable tuple for each CAMIS, with deterministic tie order. `fetched` counts grouped tuples, not raw inspection rows. Descriptions use cuisine only. Coffee categorization requires coffee/cafe/espresso/cappuccino evidence.
- POPS uses `pops_number`, `building_name`, address fields, and numeric coordinates. Unnamed spaces receive an address-based name. Required hours/amenities are labeled as required, not asserted as verified current conditions.

All new place records have null event times. Except for address-only cultural organizations, new places require valid NYC coordinates and a usable name. Empty values and literal `NULL` are cleaned. Coordinates are numeric and zero/swapped/out-of-NYC points are rejected. No new source invents neighborhood names.

## Transport, errors, and reruns

All sources paginate with an explicit order, limit, and offset until a short page. Restaurant ordering includes all grouped fields. Data changes during a multi-page fetch can still change page boundaries; nightly reruns converge, but Socrata does not provide a snapshot here.

Every source is deduplicated before upserts, then written in batches of 500 with `onConflict: "source,external_id"`. Empty writes are skipped. Errors name the source, with API offsets or database batch numbers. Existing Public Art's last-row duplicate selection is retained. A source failure returns HTTP 500 and stops remaining syncs; already committed batches are safe to upsert again. No place deletion or schema migration is performed.

## Validation and deployment

Run `npm test` for fixture-based transformation, pagination, and deduplication tests. The regular app build does not type-check this Deno function; check with `deno check supabase/functions/sync-nyc-data/index.ts` in a Deno-enabled environment before deploying.

A read-only live-data dry run prepared: 578 gardens, 73 cultural organizations (address-only), 216 libraries, 564 market identities, 30,566 restaurants from 31,361 grouped tuples, and 392 POPS. Counts change with the source feeds. No Supabase rows were written during validation.

No new tables or SQL changes are required **if** the existing `discoveries` schema matches the supplied schema, allows null coordinates, and has the `(source, external_id)` unique constraint. If latitude/longitude are NOT NULL, resolve that before importing address-only cultural organizations; this implementation does not silently change the database. Existing source/category constraints must also allow these new source strings and requested category values.

Deploy the updated `sync-nyc-data` function to activate the new sources. Preserve the existing invocation/authentication configuration. This change does not deploy the function or trigger a production sync.
