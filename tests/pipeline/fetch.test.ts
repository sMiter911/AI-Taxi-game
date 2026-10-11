import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bake, PipelineError, validateExtract } from "../../src/pipeline";
import { clipExtract, JHB_BBOX, readLocalExtract } from "../../src/pipeline/fetch";

const fixturePath = fileURLToPath(new URL("./fixtures/fetch-extract.json", import.meta.url));
const raw: unknown = JSON.parse(readFileSync(fixturePath, "utf8"));

const ids = (els: unknown[]) =>
  els.map((e) => (e as { id: number | string }).id);

describe("clipExtract", () => {
  it("keeps ways with at least one node inside the bbox and drops fully outside ways", () => {
    const { extract } = clipExtract(raw, JHB_BBOX);
    const wayIds = extract.elements
      .filter((e) => (e as { type: string }).type === "way")
      .map((e) => (e as { id: number }).id);
    expect(wayIds).toEqual([601, 602, 603, 605]);
  });

  it("keeps nodes inside the bbox and nodes referenced by kept ways, so crossing ways stay whole", () => {
    const { extract } = clipExtract(raw, JHB_BBOX);
    const nodeIds = extract.elements
      .filter((e) => (e as { type: string; id: unknown }).type === "node" && typeof (e as { id: unknown }).id === "number")
      .map((e) => (e as { id: number }).id);
    // 402 lies outside but is referenced by the crossing way 603.
    expect(nodeIds).toEqual([101, 102, 103, 104, 201, 202, 402, 501]);
  });

  it("drops nodes outside the bbox that no kept way references", () => {
    const { extract } = clipExtract(raw, JHB_BBOX);
    const nodeIds = ids(extract.elements);
    expect(nodeIds).not.toContain(301);
    expect(nodeIds).not.toContain(302);
    expect(nodeIds).not.toContain(401);
  });

  it("passes malformed elements through untouched so validate can count them", () => {
    const { extract } = clipExtract(raw, JHB_BBOX);
    expect(ids(extract.elements)).toContain("bad");
  });

  it("reports kept and dropped counts that account for every input element", () => {
    const { kept, dropped } = clipExtract(raw, JHB_BBOX);
    // 17 input elements: 1 malformed passes through, so 16 are classified.
    expect(kept).toBe(12);
    expect(dropped).toBe(4);
    expect(kept + dropped).toBe(16);
  });

  it("leaves the clipped extract with a dangling way for validate to skip and count", () => {
    const { extract } = clipExtract(raw, JHB_BBOX);
    const { elements, skipped } = validateExtract(extract);
    expect(elements.map((e) => e.id)).not.toContain(605);
    // Dangling way 605 and the malformed element.
    expect(skipped).toBe(2);
  });

  it("is deterministic: the same input and bbox give the same output", () => {
    const a = JSON.stringify(clipExtract(raw, JHB_BBOX).extract);
    const b = JSON.stringify(clipExtract(raw, JHB_BBOX).extract);
    expect(a).toBe(b);
  });

  it("keeps the input order of elements", () => {
    const { extract } = clipExtract(raw, JHB_BBOX);
    const inputOrder = (raw as { elements: { id: number | string }[] }).elements.map((e) => e.id);
    const outIds = ids(extract.elements);
    const positions = outIds.map((id) => inputOrder.indexOf(id as number));
    expect(positions).toEqual([...positions].sort((x, y) => x - y));
  });

  it("does not mutate the input", () => {
    const before = JSON.stringify(raw);
    clipExtract(raw, JHB_BBOX);
    expect(JSON.stringify(raw)).toBe(before);
  });

  it("clipped output bakes to the same hash on repeat runs (AC-7)", () => {
    const first = bake(clipExtract(raw, JHB_BBOX).extract, { bbox: JHB_BBOX });
    const second = bake(clipExtract(raw, JHB_BBOX).extract, { bbox: JHB_BBOX });
    expect(first.sha256).toBe(second.sha256);
  });

  it("throws a fetch-stage error on non-object input", () => {
    try {
      clipExtract(null);
      expect.unreachable("clipExtract should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PipelineError);
      expect((err as PipelineError).stage).toBe("fetch");
    }
  });

  it("throws a fetch-stage error when the elements array is missing", () => {
    expect(() => clipExtract({ version: 0.6 })).toThrow(PipelineError);
  });

  it("rejects an inverted bbox", () => {
    expect(() =>
      clipExtract(raw, { minLat: -26.0, maxLat: -26.2, minLon: 28.0, maxLon: 28.1 }),
    ).toThrow(PipelineError);
  });

  it("the provisional JHB bbox contains the CBD, Braamfontein and Sandton reference points", () => {
    const points = [
      [-26.2041, 28.0473], // Johannesburg centre
      [-26.19, 28.034], // Braamfontein
      [-26.1076, 28.0567], // Sandton
    ];
    for (const [lat, lon] of points) {
      expect(lat).toBeGreaterThanOrEqual(JHB_BBOX.minLat);
      expect(lat).toBeLessThanOrEqual(JHB_BBOX.maxLat);
      expect(lon).toBeGreaterThanOrEqual(JHB_BBOX.minLon);
      expect(lon).toBeLessThanOrEqual(JHB_BBOX.maxLon);
    }
  });
});

describe("readLocalExtract", () => {
  it("reads the committed fixture from disk", () => {
    const data = readLocalExtract(fixturePath) as { elements: unknown[] };
    expect(Array.isArray(data.elements)).toBe(true);
    expect(data.elements.length).toBe(17);
  });

  it("throws a fetch-stage error for a missing file, without touching the network", () => {
    try {
      readLocalExtract(fixturePath.replace("fetch-extract.json", "does-not-exist.json"));
      expect.unreachable("readLocalExtract should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PipelineError);
      expect((err as PipelineError).stage).toBe("fetch");
    }
  });
});
