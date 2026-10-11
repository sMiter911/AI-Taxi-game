# ADR 0004: Projection

Status: proposed

## Context

Geographic coordinates must become game units in metres. Johannesburg is in UTM zone 35S (EPSG:32735).

## Decision

Use a local ENU frame in metres with a fixed origin at the Braamfontein-CBD midpoint.

## Consequences

- No zone lookups at runtime.
- Distortion over a city-sized bbox is small; re-check if the bbox grows.
- Origin coordinates are recorded in the bake script.
