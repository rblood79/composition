import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("StoreRenderBridge layout publish contract", () => {
  it("forces full rebuild after layout publish and async image materialization", async () => {
    const source = await readFile(
      resolve(__dirname, "StoreRenderBridge.ts"),
      "utf-8",
    );

    expect(source).toMatch(/forceFullRebuild = false/);
    expect(source).toMatch(/this\.pendingResync = \(\) => resync\(true\);/);
    expect(source).toMatch(/resync\(true\);/);
    expect(source).toMatch(
      /this\.unsubscribeLayout = onLayoutPublished\(\(\) => resync\(true\)\);/,
    );
    expect(source).toMatch(/forceFullRebuild \|\| themeChanged/);
  });

  it("does not independently resolve canonical refs inside the bridge sync path", async () => {
    const source = await readFile(
      resolve(__dirname, "StoreRenderBridge.ts"),
      "utf-8",
    );

    expect(source).not.toContain("resolveCanonicalRefTree");
    expect(source).not.toMatch(/const resolvedTree = resolveCanonicalRefTree/);
  });

  it("routes active catalog components through generic Skia before spec shapes", async () => {
    const source = await readFile(
      resolve(__dirname, "StoreRenderBridge.ts"),
      "utf-8",
    );

    expect(source).toContain("buildGenericResolvedSkiaNodeData");
    expect(source).toContain("toResolvedSkiaNode");

    const genericIndex = source.indexOf("buildGenericResolvedSkiaNodeData");
    const specIndex = source.indexOf("buildSpecNodeData({");
    expect(genericIndex).toBeGreaterThanOrEqual(0);
    expect(specIndex).toBeGreaterThanOrEqual(0);
    expect(genericIndex).toBeLessThan(specIndex);
  });

  it("tracks projectionVersion instead of inferring projection changes from map identity", async () => {
    const source = await readFile(
      resolve(__dirname, "StoreRenderBridge.ts"),
      "utf-8",
    );

    expect(source).toContain("getProjectionVersion");
    expect(source).toContain("projectionVersion: number");
    expect(source).toContain("private prevProjectionVersion");
    expect(source).toContain("projectionChanged");
  });
});
