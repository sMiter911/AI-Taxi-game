# ADR 0003: Routing

Status: proposed

## Context

Routes must return in under 500 ms (AC-3). The game has no backend (`CONTEXT.md`). Routing engines like GraphHopper need a server process. Turn restriction and one-way handling is required.

## Decision

Build a directed graph from OSM at bake time, honouring one-way tags and turn restrictions where tagged. Run A* in the browser.

## Consequences

- No server; works offline.
- We own turn-handling correctness and must test it.
- OSRM, Valhalla and GraphHopper are fallbacks if the bbox grows. Their licences and turn support must be verified before adoption.

See `docs/research/jhb-3d-map.md`.
