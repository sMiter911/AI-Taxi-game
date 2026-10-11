// Map data pipeline: fetch → validate → transform → emit. See docs/sop/data-pipeline.md.
// Decisions: docs/adr/0001-data-source.md, 0004-projection.md.
import { createHash } from "node:crypto";
import { emit } from "./emit";
import { transform, type TransformOptions } from "./transform";
import { validateExtract } from "./validate";
import type { Bbox, CityModel } from "./types";

export { clipExtract, readLocalExtract, JHB_BBOX } from "./fetch";
export type { ClipResult } from "./fetch";
export { emit } from "./emit";
export { transform } from "./transform";
export { validateExtract } from "./validate";
export { PipelineError } from "./types";
export type { Bbox, Building, CityModel, OsmElement, Road } from "./types";

export interface BakeOptions extends TransformOptions {
  bbox: Bbox;
}

export interface BakeResult {
  model: CityModel;
  json: string;
  sha256: string;
}

// Pure and deterministic: same raw input and bbox always give the same json and sha256.
export function bake(raw: unknown, opts: BakeOptions): BakeResult {
  const { elements, skipped } = validateExtract(raw);
  const { origin, buildings, roads } = transform(elements, opts.bbox, opts);
  const model: CityModel = { origin, buildings, roads, stats: { skipped } };
  const json = emit(model);
  const sha256 = createHash("sha256").update(json).digest("hex");
  return { model, json, sha256 };
}
