# ADR 0001: Map data source

Status: proposed

## Context

We need roads and buildings for a bbox of central Johannesburg. Overpass rate limits cap bulk use. Overture has partial height data outside the US.

## Decision

Use a Geofabrik South Africa OSM extract, clipped to a fixed bbox at bake time.

## Consequences

- Attribution to OpenStreetMap contributors (ODbL) must appear in the UI (AC-6).
- The bake step is repeatable and offline (AC-7).
- Overture can be re-evaluated later for height data.

See `docs/research/jhb-3d-map.md`.
