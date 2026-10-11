# Johannesburg 3D map: research findings

Status: research pass, single researcher. Sources are cited inline. Claims without a source are marked **unverified**.

## Why rounds 1–5 missed

Rounds 1–5 (`src/road.ts`, `src/main.ts`) built a scrolling road: procedural segments, generic facades from `src/textures.ts`, no real geography. Taxi and map were never tied to real coordinates, so there was no real road network to route on. The visual result was a toy, and the game loop had nothing to route against.

Reusable from that work: the chase camera and HUD in `src/main.ts`, the vehicle meshes and taper in `src/vehicle.ts`, the sky in `src/sky.ts`, and the `three@0.169` / Vite / TypeScript setup in `package.json`.

## Data

| Source | What it gives | Findings | Licence / limits |
|---|---|---|---|
| OSM via Overpass | roads, buildings, landuse for a bbox | Global building height coverage is low: a global study found about 2.9% of buildings with `height` and 4.6% with `building:levels` ([ScienceDirect, 2023](https://www.sciencedirect.com/science/article/pii/S0360132323003220)). No Johannesburg-specific figure found. | ODbL, attribution required. Overpass guideline ~10,000 requests/day and ~1 GB/day ([Overpass API manual](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html)). Heavy use should go to a Geofabrik extract instead. |
| Geofabrik South Africa extract | full OSM extract | Not checked in this pass. | ODbL. |
| Overture Maps buildings | building footprints | Google Open Buildings filled southern-hemisphere gaps ([Overture](https://overturemaps.org/blog/2023/overture-buildings-theme-hits-2-3b-buildings-with-addition-of-google-open-buildings-data/)). Only about 27.9M of ~785M features had height in a 2023 release, and most of those are US lidar ([Overture docs](https://docs.overturemaps.org/guides/buildings)). South African height coverage **unverified**. | Overture data licences vary by source; check per theme before shipping. |
| Copernicus GLO-30 DEM | 30 m terrain | Free for general public ([AWS registry](https://registry.opendata.aws/copernicus-dem/), [Earth Engine catalog](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_DEM_GLO30_2024_1?hl=en)). Per-tile availability for South Africa **unverified**. | Attribution and liability notice terms. |
| SRTM 1-arc-second | 30 m terrain | Covers Africa in 1°×1° tiles ([NASA Earthdata](https://www.earthdata.nasa.gov/news/nasa-shuttle-radar-topography-mission-srtm-version-3.0-global-1-arc-second-data-released-over)). | Free via Earthdata login. |

**Terrain:** The Highveld is roughly flat at ~1,750 m (figure from the mission brief, not sourced). Terrain is low priority. Flat ground at a fixed elevation is enough for the first build.

## Renderer

| Option | Fit for a game | Licence / ToS | Trade-off |
|---|---|---|---|
| three.js (in repo, `three@0.169`) | Direct fit. Already the project engine. | MIT (from the project's dependency, not re-checked) | We build our own geometry from OSM. |
| 3d-tiles-renderer (NASA-AMMOS) on three.js | Can stream 3D Tiles. | Apache-2.0 ([Yarn listing](https://classic.yarnpkg.com/en/package/3d-tiles-renderer)) | Google tiles need a Google API key; see below. |
| Google Photorealistic 3D Tiles | Highest visual fidelity. | **Restricted.** Caching, offline use and data extraction are prohibited. Machine interpretation and object identification are off-limits ([Map Tiles API policies](https://developers.google.com/maps/documentation/tile/policies?authuser=1)). Attribution must stay visible. | Clicking and snapping to roads on tile geometry is close to "data extraction". **Not recommended for a game.** |
| CesiumJS | Full 3D globe stack. | Licence **unverified** in this pass. | Heavy for a game. Cesium ion adds a quota on top of Google's rules ([Cesium community](https://community.cesium.com/t/google-tiles-limitations/31034)). |
| MapLibre + deck.gl | Good 2D/2.5D map. | Not researched. | Not a 3D game engine. |

## Routing

| Option | Turn restrictions / one-way | Licence | Notes |
|---|---|---|---|
| Client-side graph + A* (baked at build time) | We control it. | Our code. | No server, works offline, matches the "no backend" rule in `CONTEXT.md`. Needs our own turn handling. |
| GraphHopper | Turn restrictions supported; enable per vehicle with `turn_costs=true`; conditional restrictions supported ([GraphHopper docs](https://github.com/FreemapSlovakia/graphhopper/blob/master/docs/core/turn-restrictions.md)). | Apache-2.0 (from memory, **verify**). | Needs a server process. |
| OSRM | Not verified. | BSD-2 (from memory, **verify**). | Needs a server process. |
| Valhalla | Not verified. | MIT (from memory, **verify**). | Needs a server process. |

## Projection

Johannesburg (≈ -26.2041, 28.0473) sits in UTM zone 35S (EPSG:32735, central meridian 27°E). Distortion at 1° east of the central meridian is small over a city-sized bbox. A local ENU frame with a fixed origin is simpler still and avoids zone lookups in the game. Recommended: local ENU, origin at the Braamfontein-CBD midpoint, metres.

## Recommendation

1. **Data:** Geofabrik South Africa extract (Gauteng), clipped to a fixed bbox at bake time. Avoids Overpass rate limits.
2. **Geometry:** Extrude OSM building footprints using `height` or `building:levels × 3 m`, falling back to a default height. Roads from OSM highway tags. Flat terrain.
3. **Projection:** Local ENU, metres, fixed origin.
4. **Routing:** Client-side graph baked at build time, A* in the browser, respecting one-way and turn restrictions where tagged.
5. **Renderer:** three.js, the existing stack. Do not use Google Photorealistic tiles for the game.
6. **Picking:** raycast onto a ground plane, snap to nearest graph node; route rendered as `TubeGeometry` or `Line2`; taxi animated along `CatmullRomCurve3`.

## Build order

1. Data pipeline: fetch extract, clip bbox, bake buildings, roads and graph to a static asset.
2. Tiles: chunk the baked geometry for streaming.
3. Router: graph load, A* and turn handling, tested against known routes.
4. Renderer: three.js scene from baked tiles, camera, OSM attribution in the UI.
5. Route UI: click to pick start and end, render the route, animate the taxi.

## Unknowns

- Actual building height and road completeness for the chosen bbox. Needs a measurement run against the extract.
- South African DEM tile availability (only matters if terrain is later added).
- OSRM and Valhalla turn/one-way details and licences.
- CesiumJS licence (only matters if it is later adopted).
- Bbox size and triangle counts. **Not measured.** The mission plan asked for these; they need the data pipeline first.
- Whether Overture adds height coverage for Gauteng.
