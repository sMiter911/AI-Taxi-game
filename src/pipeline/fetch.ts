// Fetch stage: read a local Overpass-style JSON extract and clip it to the fixed bbox.
// Offline by design (ADR 0001, ADR 0005): no network access. The Geofabrik download and
// conversion to Overpass JSON are not automated yet.
import { readFileSync } from "node:fs";
import { PipelineError, type Bbox } from "./types";

// PROVISIONAL. Final bbox coordinates are an open question in docs/spec/jhb-map.md.
// Covers the CBD (about -26.205, 28.040), Braamfontein (about -26.19, 28.034) and the Sandton
// node (about -26.107, 28.056). Change only with a spec update.
export const JHB_BBOX: Bbox = {
  minLat: -26.22,
  maxLat: -26.09,
  minLon: 28.02,
  maxLon: 28.07,
};

export interface ClipResult {
  // Same shape as the input, with `elements` filtered. Malformed elements are passed through
  // untouched so the validate stage can count them.
  extract: { elements: unknown[]; [key: string]: unknown };
  kept: number;
  dropped: number;
}

function assertBbox(bbox: Bbox): void {
  const values = [bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon];
  if (!values.every((v) => Number.isFinite(v))) {
    throw new PipelineError("fetch", "bbox has a non-finite coordinate");
  }
  if (bbox.minLat > bbox.maxLat || bbox.minLon > bbox.maxLon) {
    throw new PipelineError("fetch", "bbox min is greater than max");
  }
}

interface RawNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
}

interface RawWay {
  type: "way";
  id: number;
  nodes: number[];
}

function isRawNode(el: unknown): el is RawNode {
  const e = el as Partial<RawNode> | null;
  return (
    typeof e === "object" &&
    e !== null &&
    e.type === "node" &&
    typeof e.id === "number" &&
    typeof e.lat === "number" &&
    typeof e.lon === "number"
  );
}

function isRawWay(el: unknown): el is RawWay {
  const e = el as Partial<RawWay> | null;
  return (
    typeof e === "object" &&
    e !== null &&
    e.type === "way" &&
    typeof e.id === "number" &&
    Array.isArray(e.nodes) &&
    e.nodes.every((n) => typeof n === "number")
  );
}

// Clip to the bbox. A way is kept when any of its nodes lies inside the bbox, and every node it
// references is kept too, so ways that cross the edge stay whole. Input order is preserved, so
// the same input and bbox always give the same output.
export function clipExtract(raw: unknown, bbox: Bbox = JHB_BBOX): ClipResult {
  assertBbox(bbox);
  if (typeof raw !== "object" || raw === null) {
    throw new PipelineError("fetch", "input is not an object");
  }
  const input = raw as { elements?: unknown };
  if (!Array.isArray(input.elements)) {
    throw new PipelineError("fetch", "input has no elements array");
  }
  const elements = input.elements as unknown[];

  const insideIds = new Set<number>();
  for (const el of elements) {
    if (
      isRawNode(el) &&
      el.lat >= bbox.minLat &&
      el.lat <= bbox.maxLat &&
      el.lon >= bbox.minLon &&
      el.lon <= bbox.maxLon
    ) {
      insideIds.add(el.id);
    }
  }

  const keptWays = new Set<unknown>();
  const referenced = new Set<number>();
  for (const el of elements) {
    if (isRawWay(el) && el.nodes.some((n) => insideIds.has(n))) {
      keptWays.add(el);
      for (const n of el.nodes) referenced.add(n);
    }
  }

  let kept = 0;
  let dropped = 0;
  const out: unknown[] = [];
  for (const el of elements) {
    if (isRawNode(el)) {
      if (insideIds.has(el.id) || referenced.has(el.id)) {
        out.push(el);
        kept++;
      } else {
        dropped++;
      }
    } else if (isRawWay(el)) {
      if (keptWays.has(el)) {
        out.push(el);
        kept++;
      } else {
        dropped++;
      }
    } else {
      // Malformed: let validate count it.
      out.push(el);
    }
  }

  return { extract: { ...input, elements: out }, kept, dropped };
}

// Read a local extract file. Synchronous, no network. Strips a UTF-8 BOM if present.
export function readLocalExtract(path: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    throw new PipelineError("fetch", `cannot read ${path}: ${(err as Error).message}`);
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    throw new PipelineError("fetch", `${path} is not valid JSON: ${(err as Error).message}`);
  }
}
