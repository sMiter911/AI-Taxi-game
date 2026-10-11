// AC-7: the bake is repeatable. Same input extract gives the same output asset.
// Runs the real CLI (scripts/bake-map.ts) twice on the committed fixture and compares bytes and sha256.
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const script = join(root, "scripts", "bake-map.ts");
const viteNode = join(root, "node_modules", "vite-node", "vite-node.mjs");
const fixture = join(root, "tests", "pipeline", "fixtures", "sample-extract.json");

let workDir: string;

function bakeOnce(out: string): { stdout: string; bytes: Buffer } {
  const stdout = execFileSync(process.execPath, [viteNode, script, fixture, out], {
    cwd: root,
    encoding: "utf8",
  });
  return { stdout, bytes: readFileSync(out) };
}

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "bake-determinism-"));
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("bake determinism (AC-7)", () => {
  it("bakes the committed fixture twice to identical bytes and sha256", () => {
    const first = bakeOnce(join(workDir, "first.json"));
    const second = bakeOnce(join(workDir, "second.json"));

    const sha1 = createHash("sha256").update(first.bytes).digest("hex");
    const sha2 = createHash("sha256").update(second.bytes).digest("hex");

    expect(first.bytes.length).toBeGreaterThan(0);
    expect(sha2).toBe(sha1);
    expect(second.bytes.equals(first.bytes)).toBe(true);
  });

  it("reports the sha256 of the bytes it wrote", () => {
    const out = join(workDir, "reported.json");
    const { stdout, bytes } = bakeOnce(out);
    const actual = createHash("sha256").update(bytes).digest("hex");

    const match = /sha256=([0-9a-f]{64})/.exec(stdout);
    expect(match?.[1]).toBe(actual);
  });
});
