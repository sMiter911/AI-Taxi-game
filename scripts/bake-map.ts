// Bake a local OSM extract (Overpass JSON) into the city model. See docs/sop/data-pipeline.md.
// Usage: npx vite-node scripts/bake-map.ts <input.json> <output.json>
import { readFileSync, writeFileSync } from "node:fs";
import { bake } from "../src/pipeline";

// Central Johannesburg: CBD, Braamfontein, Sandton corridor (docs/spec/jhb-map.md).
const BBOX = { minLat: -26.21, maxLat: -26.19, minLon: 28.03, maxLon: 28.06 };

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: npx vite-node scripts/bake-map.ts <input.json> <output.json>");
  process.exit(2);
}

const raw: unknown = JSON.parse(readFileSync(input, "utf8"));
const { json, sha256, model } = bake(raw, { bbox: BBOX });
writeFileSync(output, json);
console.log(
  `baked ${model.buildings.length} buildings, ${model.roads.length} roads, ` +
    `skipped ${model.stats.skipped} -> ${output} sha256=${sha256}`,
);
