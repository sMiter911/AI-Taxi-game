import type { CityModel } from "./types";

const DECIMALS = 2;

// Round and normalise -0 to 0 so the same geometry always serialises the same way.
function round(v: number): number {
  return Math.round(v * 10 ** DECIMALS) / 10 ** DECIMALS + 0;
}

function roundPoints(points: [number, number][]): [number, number][] {
  return points.map(([x, y]) => [round(x), round(y)]);
}

// Canonical JSON: fixed key order, features sorted by id, fixed decimals.
// The same input always gives the same bytes, so re-running the bake does not churn the asset.
export function emit(model: CityModel): string {
  const canonical = {
    buildings: [...model.buildings]
      .sort((a, b) => a.id - b.id)
      .map((b) => ({
        footprint: roundPoints(b.footprint),
        heightM: round(b.heightM),
        id: b.id,
      })),
    origin: { lat: model.origin.lat, lon: model.origin.lon },
    roads: [...model.roads]
      .sort((a, b) => a.id - b.id)
      .map((r) => ({
        highway: r.highway,
        id: r.id,
        oneway: r.oneway,
        points: roundPoints(r.points),
      })),
    stats: { skipped: model.stats.skipped },
  };
  return JSON.stringify(canonical, null, 2) + "\n";
}
