// Bake a local OSM extract (Overpass JSON) into the city model. See docs/sop/data-pipeline.md.
// Usage: npx vite-node scripts/bake-map.ts <input.json> <output.json>
import { readFileSync, writeFileSync } from "node:fs";
import { bake, clipExtract, JHB_BBOX } from "../src/pipeline";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: npx vite-node scripts/bake-map.ts <input.json> <output.json>");
  process.exit(2);
}

// Fetch stage: clip the local extract to the bbox first, then bake the clipped data.
const raw: unknown = clipExtract(JSON.parse(readFileSync(input, "utf8")), JHB_BBOX).extract;
const { json, sha256, model } = bake(raw, { bbox: JHB_BBOX });
writeFileSync(output, json);
console.log(
  `baked ${model.buildings.length} buildings, ${model.roads.length} roads, ` +
    `skipped ${model.stats.skipped} -> ${output} sha256=${sha256}`,
);
