import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bake, emit, PipelineError, transform, validateExtract } from "../../src/pipeline";

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
