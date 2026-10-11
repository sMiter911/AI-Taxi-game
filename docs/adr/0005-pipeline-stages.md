# ADR 0005: Pipeline stages and determinism

Status: accepted (first slice)

## Context

The bake turns an OSM extract into a city model the game can load. It must be repeatable (AC-7) and must not fail on one bad element.

## Decision

- Four stages: fetch → validate → transform → emit. Fetch is a local file for now.
- Validation skips and counts bad elements. It throws only on structurally invalid input.
- Output is canonical JSON: fixed key order, features sorted by id, coordinates to 2 decimals, `-0` normalised. The sha256 of that output is reported.
- Node's `crypto` is used for the hash. `@types/node` is a devDependency for that reason.

## Consequences

- Same input and bbox give the same bytes and hash, so re-runs do not churn the asset.
- Tests run on a committed fixture, not the network.
- The Geofabrik download and clipping are not yet automated. That is the next slice.

See `docs/sop/data-pipeline.md` and `docs/spec/jhb-map.md`.
