import { PipelineError, type OsmElement, type OsmNode, type OsmWay } from "./types";

export interface ValidatedExtract {
  elements: OsmElement[];
  skipped: number;
}

function isNode(el: unknown): el is OsmNode {
  const e = el as Partial<OsmNode> | null;
  return (
    typeof e === "object" &&
    e !== null &&
    e.type === "node" &&
    typeof e.id === "number" &&
    typeof e.lat === "number" &&
    typeof e.lon === "number"
  );
}

function isWayShape(el: unknown): el is OsmWay {
  const e = el as Partial<OsmWay> | null;
  return (
    typeof e === "object" &&
    e !== null &&
    e.type === "way" &&
    typeof e.id === "number" &&
    Array.isArray(e.nodes) &&
    e.nodes.every((n) => typeof n === "number")
  );
}

// Structural checks only. Malformed or dangling elements are skipped and counted,
// not fatal: a bad way should not stop the whole bake.
export function validateExtract(raw: unknown): ValidatedExtract {
  if (typeof raw !== "object" || raw === null) {
    throw new PipelineError("validate", "input is not an object");
  }
  const elements = (raw as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) {
    throw new PipelineError("validate", "input has no elements array");
  }

  const nodeIds = new Set<number>();
  for (const el of elements) {
    if (isNode(el)) nodeIds.add(el.id);
  }

  const kept: OsmElement[] = [];
  let skipped = 0;
  for (const el of elements) {
    if (isNode(el)) {
      kept.push(el);
    } else if (isWayShape(el) && el.nodes.length >= 2 && el.nodes.every((n) => nodeIds.has(n))) {
      kept.push(el);
    } else {
      skipped++;
    }
  }
  return { elements: kept, skipped };
}
