import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const removedLegacyCanvasFiles = [
  "sceneGraph/StoreBridge.ts",
  "sceneGraph/SceneGraph.ts",
  "sceneGraph/types.ts",
  // `sprites/` 는 2026-08-15 에 `styleConversion/` 으로 리네임됐다. 옛 경로와 새 경로를 **둘 다**
  //   확인한다 — 옛 경로만 두면 디렉터리가 없어 가드가 공허하게 통과하고,
  //   새 경로만 두면 `sprites/` 를 다시 만드는 회귀를 놓친다.
  "sprites/useResolvedElement.ts",
  "styleConversion/useResolvedElement.ts",
] as const;

describe("ADR-122 legacy canvas surface cleanup", () => {
  it("does not reintroduce unused legacy sceneGraph or element resolution files", async () => {
    for (const relativePath of removedLegacyCanvasFiles) {
      await expect(
        access(resolve(__dirname, relativePath)),
        relativePath,
      ).rejects.toMatchObject({ code: "ENOENT" });
    }
  });
});
