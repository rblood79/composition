import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("rendererInput projection contract", () => {
  it("does not independently resolve canonical refs after projection input is built", async () => {
    const source = await readFile(
      resolve(__dirname, "rendererInput.ts"),
      "utf-8",
    );

    expect(source).not.toContain("resolveCanonicalRefTree");
    expect(source).not.toMatch(/resolveCanvasSceneGraph/);
  });

  it("exposes a projectionVersion for downstream layout and bridge consumers", async () => {
    const source = await readFile(
      resolve(__dirname, "rendererInput.ts"),
      "utf-8",
    );

    expect(source).toContain("projectionVersion: number;");
    expect(source).toContain("projectionVersion: sceneSnapshot.sceneVersion,");
    expect(source).toContain(
      "projectionVersion: input.sceneSnapshot.sceneVersion,",
    );
  });
});
