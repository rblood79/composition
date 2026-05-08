import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const removedLegacyCanvasFiles = [
  "sceneGraph/StoreBridge.ts",
  "sceneGraph/SceneGraph.ts",
  "sceneGraph/types.ts",
  "sprites/useResolvedElement.ts",
] as const;

describe("ADR-122 legacy canvas surface cleanup", () => {
  it("does not reintroduce unused legacy sceneGraph or sprite resolution files", async () => {
    for (const relativePath of removedLegacyCanvasFiles) {
      await expect(
        access(resolve(__dirname, relativePath)),
        relativePath,
      ).rejects.toMatchObject({ code: "ENOENT" });
    }
  });
});
