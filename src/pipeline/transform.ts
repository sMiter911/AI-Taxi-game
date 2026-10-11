import type { Bbox, Building, OsmElement, OsmNode, OsmWay, Road } from "./types";

const METRES_PER_DEG_LAT = 110_574;
const METRES_PER_DEG_LON_AT_EQUATOR = 111_320;
const METRES_PER_LEVEL = 3;
const DEFAULT_HEIGHT_M = 9;

export interface TransformOptions {
  defaultHeightM?: number;
}

export interface TransformResult {
  origin: { lat: number; lon: number };
  buildings: Building[];
  roads: Road[];
}

// Local equirectangular ENU around the bbox centre. Accurate enough for a city-sized bbox (ADR 0004).
function makeProjector(bbox: Bbox) {
  const lat0 = (bbox.minLat + bbox.maxLat) / 2;
  const lon0 = (bbox.minLon + bbox.maxLon) / 2;
  const lonScale = METRES_PER_DEG_LON_AT_EQUATOR * Math.cos((lat0 * Math.PI) / 180);
  return {
    origin: { lat: lat0, lon: lon0 },
    project: (lat: number, lon: number): [number, number] => [
      (lon - lon0) * lonScale,
      (lat - lat0) * METRES_PER_DEG_LAT,
    ],
  };
}

function inBbox(n: OsmNode, b: Bbox): boolean {
  return n.lat >= b.minLat && n.lat <= b.maxLat && n.lon >= b.minLon && n.lon <= b.maxLon;
}

// Strict positive decimal: "30", "12.5", optionally followed by " m" for height. Anything else is malformed.
const HEIGHT_PATTERN = /^(\d+(?:\.\d+)?)\s*(?:m)?$/i;
const LEVELS_PATTERN = /^(\d+(?:\.\d+)?)$/;

function parsePositive(raw: string | undefined, pattern: RegExp): number | undefined {
  const match = pattern.exec((raw ?? "").trim());
  if (!match) return undefined;
  const value = Number(match[1]);
  return value > 0 ? value : undefined;
}

// SOP rule: height tag, else building:levels x 3 m, else the default. Malformed values fall through.
function buildingHeight(tags: Record<string, string>, defaultHeightM: number): number {
  const h = parsePositive(tags.height, HEIGHT_PATTERN);
  if (h !== undefined) return h;
  const levels = parsePositive(tags["building:levels"], LEVELS_PATTERN);
  if (levels !== undefined) return levels * METRES_PER_LEVEL;
  return defaultHeightM;
}

// Returns whether the way is one-way, and whether its node order must be reversed so that
// the drawn order always follows the direction of travel (oneway=-1 means against node order).
function onewayOf(tags: Record<string, string>): { oneway: boolean; reverse: boolean } {
  const value = (tags.oneway ?? "").trim().toLowerCase();
  if (value === "-1") return { oneway: true, reverse: true };
  if (value === "yes" || value === "true" || value === "1") return { oneway: true, reverse: false };
  return { oneway: false, reverse: false };
}

// Keeps a way only if at least one of its nodes is inside the bbox.
export function transform(
  elements: OsmElement[],
  bbox: Bbox,
  opts: TransformOptions = {},
): TransformResult {
  const defaultHeightM = opts.defaultHeightM ?? DEFAULT_HEIGHT_M;
  const { origin, project } = makeProjector(bbox);

  const nodes = new Map<number, OsmNode>();
  for (const el of elements) if (el.type === "node") nodes.set(el.id, el);

  const buildings: Building[] = [];
  const roads: Road[] = [];

  for (const el of elements) {
    if (el.type !== "way") continue;
    const way: OsmWay = el;
    const members = way.nodes.map((id) => nodes.get(id) as OsmNode);
    if (!members.some((n) => inBbox(n, bbox))) continue;

    const tags = way.tags ?? {};
    const points = members.map((n) => project(n.lat, n.lon));

    if (tags.building !== undefined) {
      buildings.push({
        id: way.id,
        footprint: points,
        heightM: buildingHeight(tags, defaultHeightM),
      });
    } else if (tags.highway !== undefined) {
      const { oneway, reverse } = onewayOf(tags);
      roads.push({
        id: way.id,
        highway: tags.highway,
        oneway,
        points: reverse ? points.reverse() : points,
      });
    }
  }

  return { origin, buildings, roads };
}
