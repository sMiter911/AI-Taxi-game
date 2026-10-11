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

function buildingHeight(tags: Record<string, string>, defaultHeightM: number): number {
  const h = parseFloat(tags.height ?? "");
  if (Number.isFinite(h) && h > 0) return h;
  const levels = parseFloat(tags["building:levels"] ?? "");
  if (Number.isFinite(levels) && levels > 0) return levels * METRES_PER_LEVEL;
  return defaultHeightM;
}

const ONEWAY_TRUE = new Set(["yes", "true", "1"]);

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
      roads.push({
        id: way.id,
        highway: tags.highway,
        oneway: ONEWAY_TRUE.has(tags.oneway ?? ""),
        points,
      });
    }
  }

  return { origin, buildings, roads };
}
