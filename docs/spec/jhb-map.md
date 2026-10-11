# Spec: Johannesburg 3D map

Status: draft. Source of decisions: `docs/research/jhb-3d-map.md`, `docs/adr/`.

## Scope

A fixed bbox of central Johannesburg (CBD, Braamfontein, Sandton). Roads and buildings only. Flat terrain. No live data at runtime.

Out of scope: whole-city coverage, terrain, Google Photorealistic tiles, traffic, live routing.

## Acceptance criteria

Each criterion must be testable. "Visual" criteria need a captured screenshot committed to `docs/research/` or attached to the PR.

| ID | Criterion | How to check |
|---|---|---|
| AC-1 | The baked bbox asset loads in under 5 s on a mid-range laptop over a cold cache. | Timed load in the dev server, logged. |
| AC-2 | A click on the ground snaps to the nearest road node within 15 m. | Unit test with fixed click points. |
| AC-3 | A route between two picked nodes returns in under 500 ms. | Timed test on the baked graph. |
| AC-4 | Renders at 60 fps at 1080p with fewer than N draw calls (N set once the bbox is measured). | Browser perf capture; N recorded in an ADR. |
| AC-5 | Route is drawn over the map and the taxi animates along it. | Screenshot evidence. |
| AC-6 | OSM attribution (ODbL) is visible in the UI whenever the map is shown. | Visual check. |
| AC-7 | The bake script is repeatable: same input extract gives the same output asset. | Run twice, compare hashes. |
| AC-8 | No Google Photorealistic tile data is fetched, cached or stored. | Code search and network capture. |

## Gates

- `npm run build` (runs `tsc -b`) passes.
- Every claim in `docs/research/jhb-3d-map.md` has a source or is marked unverified.
- Git tree is clean on the mission branch.

## Open questions

- Final bbox coordinates.
- Value of N in AC-4.
- Acceptable gap rate in building heights (default height rule must be stated).
