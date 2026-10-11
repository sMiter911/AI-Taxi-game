# ADR 0002: Renderer

Status: proposed

## Context

We need a 3D map for a game. Google Photorealistic 3D Tiles prohibit caching, offline use and data extraction. Clicking roads on tile geometry is close to extraction.

## Decision

Use three.js (already in the project) with our own geometry baked from OSM. Do not use Google Photorealistic tiles.

## Consequences

- Lower visual fidelity than photorealistic tiles; acceptable for a game.
- No Google API key or ToS constraints on rendering.
- CesiumJS and 3d-tiles-renderer are not adopted now. Revisit if tiles are ever needed; CesiumJS licence must be verified first.

See `docs/research/jhb-3d-map.md`.
