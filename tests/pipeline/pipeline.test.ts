import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bake, emit, PipelineError, transform, validateExtract, type OsmElement } from "../../src/pipeline";

const fixturePath = fileURLToPath(new URL("./fixtures/sample-extract.json", import.meta.url));
const raw: unknown = JSON.parse(readFileSync(fixturePath, "utf8"));

// Central Johannesburg bbox: CBD, Braamfontein, Sandton corridor.
const bbox = { minLat: -26.21, maxLat: -26.19, minLon: 28.03, maxLon: 28.06 };

describe("validateExtract", () => {
  it("rejects input that is not an Overpass-style object", () => {
    expect(() => validateExtract(null)).toThrow(PipelineError);
    expect(() => validateExtract("not json")).toThrow(PipelineError);
  });

  it("rejects input with no elements array, naming the validate stage", () => {
    try {
      validateExtract({ version: 0.6 });
      expect.unreachable("validateExtract should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PipelineError);
      expect((err as PipelineError).stage).toBe("validate");
    }
  });

  it("skips ways with a missing node reference or fewer than two nodes, and counts them", () => {
    const { elements, skipped } = validateExtract(raw);
    const wayIds = elements.filter((e) => e.type === "way").map((e) => e.id);
    expect(wayIds).not.toContain(13);
    expect(wayIds).not.toContain(14);
    expect(skipped).toBe(2);
  });
});

describe("transform", () => {
  it("uses the height tag when present", () => {
    const { buildings } = transform(validateExtract(raw).elements, bbox);
    expect(buildings.find((b) => b.id === 10)?.heightM).toBe(30);
  });

  it("derives height from building:levels at 3 m per level when no height tag", () => {
    const { buildings } = transform(validateExtract(raw).elements, bbox);
    expect(buildings.find((b) => b.id === 11)?.heightM).toBe(12);
  });

  it("falls back to the default height when neither height nor levels is tagged", () => {
    const { buildings } = transform(validateExtract(raw).elements, bbox, { defaultHeightM: 9 });
    expect(buildings.find((b) => b.id === 15)?.heightM).toBe(9);
  });

  it("excludes features whose nodes all lie outside the bbox", () => {
    const { buildings } = transform(validateExtract(raw).elements, bbox);
    expect(buildings.map((b) => b.id)).not.toContain(16);
  });

  it("keeps the oneway flag on roads", () => {
    const { roads } = transform(validateExtract(raw).elements, bbox);
    expect(roads.find((r) => r.id === 12)?.oneway).toBe(true);
  });

  it("projects to local metres around the bbox centre", () => {
    const { buildings } = transform(validateExtract(raw).elements, bbox);
    for (const b of buildings) {
      for (const [x, y] of b.footprint) {
        expect(Math.abs(x)).toBeLessThan(5000);
        expect(Math.abs(y)).toBeLessThan(5000);
      }
    }
  });
});

// Inline elements for the hardening cases, so the shared fixture counts stay as they are.
const insideNodes: OsmElement[] = [
  { type: "node", id: 101, lat: -26.2, lon: 28.04 },
  { type: "node", id: 102, lat: -26.2, lon: 28.041 },
  { type: "node", id: 103, lat: -26.201, lon: 28.041 },
];

function buildingHeight(tags: Record<string, string>): number | undefined {
  const way: OsmElement = { type: "way", id: 1, nodes: [101, 102, 103, 101], tags: { building: "yes", ...tags } };
  return transform([...insideNodes, way], bbox).buildings[0]?.heightM;
}

function roadWith(tags: Record<string, string>) {
  const way: OsmElement = { type: "way", id: 2, nodes: [101, 102, 103], tags: { highway: "primary", ...tags } };
  return transform([...insideNodes, way], bbox).roads[0];
}

describe("transform height rule hardening", () => {
  it("ignores a height tag with trailing non-numeric text and falls through to levels", () => {
    expect(buildingHeight({ height: "20abc", "building:levels": "4" })).toBe(12);
  });

  it("accepts a height tag with a metre unit suffix", () => {
    expect(buildingHeight({ height: "30 m", "building:levels": "4" })).toBe(30);
  });

  it("falls through a non-numeric, negative or zero height tag", () => {
    expect(buildingHeight({ height: "tall", "building:levels": "4" })).toBe(12);
    expect(buildingHeight({ height: "-5", "building:levels": "4" })).toBe(12);
    expect(buildingHeight({ height: "0", "building:levels": "4" })).toBe(12);
  });

  it("falls through to the 9 m default when height is invalid and levels are absent", () => {
    expect(buildingHeight({ height: "0" })).toBe(9);
    expect(buildingHeight({ height: "abc" })).toBe(9);
  });

  it("ignores building:levels with trailing non-numeric text and uses the default", () => {
    expect(buildingHeight({ "building:levels": "3abc" })).toBe(9);
  });

  it("falls through a zero or negative building:levels to the default", () => {
    expect(buildingHeight({ "building:levels": "0" })).toBe(9);
    expect(buildingHeight({ "building:levels": "-2" })).toBe(9);
  });
});

describe("transform oneway hardening", () => {
  it("sets oneway for oneway=yes and keeps the node order", () => {
    const yes = roadWith({ oneway: "yes" });
    expect(yes.oneway).toBe(true);
    expect(yes.points).toEqual(roadWith({}).points);
  });

  it("sets oneway for oneway=-1 and reverses the points so the order follows travel", () => {
    const reversed = roadWith({ oneway: "-1" });
    expect(reversed.oneway).toBe(true);
    expect(reversed.points).toEqual([...roadWith({ oneway: "yes" }).points].reverse());
  });

  it("does not set oneway for oneway=no and keeps the node order", () => {
    const no = roadWith({ oneway: "no" });
    expect(no.oneway).toBe(false);
    expect(no.points).toEqual(roadWith({}).points);
  });

  it("does not set oneway when the tag is absent", () => {
    expect(roadWith({}).oneway).toBe(false);
  });
});

describe("bake", () => {
  it("is deterministic: the same input gives byte-identical output and hash", () => {
    const a = bake(raw, { bbox });
    const b = bake(raw, { bbox });
    expect(a.json).toBe(b.json);
    expect(a.sha256).toBe(b.sha256);
  });

  it("emits sorted keys and sorted features so re-runs do not churn", () => {
    const { json } = bake(raw, { bbox });
    const parsed = JSON.parse(json);
    const ids = parsed.buildings.map((b: { id: number }) => b.id);
    expect(ids).toEqual([...ids].sort((x: number, y: number) => x - y));
    expect(Object.keys(parsed)).toEqual([...Object.keys(parsed)].sort());
  });

  it("emits the expected counts for the fixture", () => {
    const { model } = bake(raw, { bbox });
    expect(model.buildings.length).toBe(3);
    expect(model.roads.length).toBe(1);
    expect(model.stats.skipped).toBe(2);
  });

  it("emit on its own produces the same string as bake", () => {
    const { model, json } = bake(raw, { bbox });
    expect(emit(model)).toBe(json);
  });

  it("throws PipelineError for malformed input, naming the failing stage", () => {
    expect(() => bake({ elements: "nope" }, { bbox })).toThrow(PipelineError);
  });
});
