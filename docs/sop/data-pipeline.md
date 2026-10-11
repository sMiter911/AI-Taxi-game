# SOP: map data pipeline

Code: `src/pipeline/`. Entry point: `scripts/bake-map.ts`. Decisions: `docs/adr/0001` (data source), `0004` (projection), `0005` (pipeline stages).

## Stages

1. **fetch**: obtain an Overpass-style JSON extract. Not automated yet. Use a local file (for example a clipped Geofabrik extract converted to Overpass JSON). Network fetch is a later slice.
2. **validate**: structural checks. Skips malformed or dangling ways and counts them. Throws on non-object input or a missing `elements` array.
3. **transform**: clip to the bbox, build buildings (height from `height`, else `building:levels × 3 m`, else 9 m) and roads (with a oneway flag), project to local metres.
4. **emit**: canonical JSON (fixed key order, sorted features, 2 decimal places) and a sha256.

## Run

```sh
npm run test                                  # pipeline tests
npx vite-node scripts/bake-map.ts in.json out.json
```

The script prints counts and the sha256. Running it twice on the same input must give the same hash.

## Change the pipeline

1. Update the acceptance criteria in `docs/spec/jhb-map.md` first.
2. Write or change the test in `tests/pipeline/` and watch it fail for the right reason.
3. Change `src/pipeline/`.
4. Run `npm run test` and `npm run build`.
5. Check determinism: bake twice and compare the sha256.
6. If a decision changed, add or amend an ADR in `docs/adr/`.

## Licence

Output derived from OpenStreetMap is ODbL. Attribution must be shown in the UI (AC-6).
